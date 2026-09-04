import { PDFDocument } from "pdf-lib";
import { permitFormTemplates, type PermitFormTemplate } from "./db";
import { sourceLabel, type FlagKey, type PermitContext, type SourceKey } from "./context";

/**
 * Filling the jurisdiction's own permit application from the job.
 *
 * The county forms are real AcroForm PDFs, so this fills the document the
 * counter actually expects rather than generating a look-alike. What goes in
 * which field is not in this file — it is in permit_form_templates.field_mapping,
 * so adding a county is a data change. That matters because Broward's PDF names
 * its fields with bare numbers ("33", "47"), a map worth verifying once and
 * storing rather than re-deriving.
 *
 * Nothing here signs anything. Signature and notary fields are left empty on
 * purpose: the contractor prints the result, gets the signatures, and uploads
 * the executed copy.
 */

/**
 * Blank county forms were collected in the permit project and stay there — the
 * bucket is public, and copying ~1,900 PDFs across would buy nothing.
 */
const FORM_LIBRARY = "https://ujalvgknnbsxqpujxvwk.supabase.co/storage/v1/object/public/permit-form-templates";

export interface FilledForm {
  bytes: Uint8Array;
  fileName: string;
  template: PermitFormTemplate;
  /** Mapped fields the job had nothing to put in, named for a human. */
  blanks: string[];
}

function templateUrl(filePath: string): string {
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `${FORM_LIBRARY}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Which application this jurisdiction uses. The department's own row wins; the
 * county is the fallback, because a Broward city permit is pulled on the
 * Broward countywide form. Only templates with a verified map are eligible — an
 * unmapped one would hand back a blank PDF and read as a bug.
 */
export async function findApplicationTemplate(dept: {
  id?: string | null;
  county?: string | null;
}): Promise<PermitFormTemplate | null> {
  return findTemplate(dept, "permit_application");
}

const TEMPLATE_COLS =
  "id, building_dept_id, jurisdiction_name, county, form_type, form_name, file_path, field_mapping, fill_method, is_fillable, requires_notary, instructions, notes";

/**
 * The same resolution for any form type, so the packet can ask for the pieces
 * the manifest names rather than only the application.
 */
export async function findTemplate(
  dept: { id?: string | null; county?: string | null },
  formType: string,
): Promise<PermitFormTemplate | null> {
  const { data, error } = await permitFormTemplates()
    .select(TEMPLATE_COLS)
    .eq("form_type", formType);
  if (error) throw error;

  const mapped = (data ?? []).filter(
    (t) => t.fill_method === "acroform" && t.field_mapping && t.field_mapping.text,
  );
  return (
    mapped.find((t) => dept.id && t.building_dept_id === dept.id) ??
    mapped.find((t) => dept.county && t.county === dept.county) ??
    null
  );
}

/**
 * Whether a mapped form exists for each of these types in this jurisdiction.
 *
 * The packet planner needs to distinguish "this county wants a Section 1524
 * disclosure and we can fill it" from "this county wants one and we have never
 * seen the form". Both look like a missing document to a checklist; only the
 * second is something the contractor has to go and solve.
 *
 * One query for the whole set, because the planner asks about a dozen types at
 * once and a round trip each would show as a stutter on the panel.
 */
export async function fillableTypes(
  dept: { id?: string | null; county?: string | null },
  formTypes: string[],
): Promise<Map<string, PermitFormTemplate>> {
  const out = new Map<string, PermitFormTemplate>();
  if (formTypes.length === 0) return out;
  const { data, error } = await permitFormTemplates().select(TEMPLATE_COLS).in("form_type", formTypes);
  if (error) return out;

  const mapped = (data ?? []).filter(
    (t) => t.fill_method === "acroform" && t.field_mapping && t.field_mapping.text,
  );
  for (const type of formTypes) {
    const forType = mapped.filter((t) => t.form_type === type);
    const hit =
      forType.find((t) => dept.id && t.building_dept_id === dept.id) ??
      forType.find((t) => dept.county && t.county === dept.county);
    if (hit) out.set(type, hit);
  }
  return out;
}

/**
 * Set a dropdown or option list, if that is what this field turns out to be.
 *
 * Returns false when the field is not a list, so the caller falls through to
 * the ordinary text path. A value the list does not offer is also false rather
 * than an error: "Florida" where the list wants "FL" is a mapping problem to
 * see in the console, not a reason to fail the form.
 */
function selectOption(
  form: ReturnType<PDFDocument["getForm"]>,
  pdfField: string,
  value: string,
): boolean {
  for (const get of ["getDropdown", "getOptionList"] as const) {
    let field: { getOptions(): string[]; select(v: string): void } | null = null;
    try {
      field = form[get](pdfField);
    } catch {
      continue;
    }
    const options = field.getOptions();
    const match =
      options.find((o) => o === value) ??
      options.find((o) => o.toLowerCase() === value.toLowerCase());
    if (!match) {
      console.warn(`permit form: "${value}" is not an option for "${pdfField}"`);
      return true; /* It is a list; there is nothing the text path could do. */
    }
    field.select(match);
    return true;
  }
  return false;
}

export async function fillApplication(ctx: PermitContext): Promise<FilledForm> {
  if (!ctx.department) {
    throw new Error("Pick the building department for this job first.");
  }
  const template = await findApplicationTemplate({
    id: ctx.department.id,
    county: ctx.department.county,
  });
  if (!template) {
    throw new Error(
      `No mapped permit application for ${ctx.department.name} yet — ${ctx.department.county ?? "that county"} has not been built.`,
    );
  }

  const res = await fetch(templateUrl(template.file_path));
  if (!res.ok) throw new Error(`Could not load ${template.form_name} (${res.status}).`);
  const blank = await res.arrayBuffer();

  /* County forms are often saved with permissions encryption set. That flag
     only asks a viewer to be polite about editing; a contractor is entitled to
     fill their own application, so it is ignored. */
  const pdf = await PDFDocument.load(blank, { ignoreEncryption: true });
  const form = pdf.getForm();

  /* Some county PDFs ship with a damaged cross-reference table. The pages still
     render but the form dictionary reads as empty, and filling it would hand
     back an untouched blank. Say so rather than pretend. */
  if (form.getFields().length === 0) {
    throw new Error(
      `${template.form_name} needs a repaired copy uploaded — its form fields are unreadable.`,
    );
  }

  const blanks: string[] = [];
  const map = template.field_mapping;

  for (const [pdfField, sourceKey] of Object.entries(map.text ?? {})) {
    const key = sourceKey as SourceKey;
    const value = ctx.values[key] ?? "";
    if (!value) {
      const label = sourceLabel(key);
      if (!blanks.includes(label)) blanks.push(label);
      continue;
    }
    try {
      /* Some answers are a list, not a box. Miami-Dade's state fields are
         option lists of the fifty states, and the old filler asked for a text
         field, got an error, and logged "no text field State: Contractor
         Information" for a field that was sitting right there. Try the list
         first when the value looks like a list entry. */
      if (selectOption(form, pdfField, value)) continue;

      const spill = map.overflow?.[pdfField];
      if (spill && value.length > spill.chars) {
        /* Break on a space so a word is not cut in half on the printed form. */
        let cut = value.lastIndexOf(" ", spill.chars);
        if (cut < spill.chars * 0.6) cut = spill.chars;
        form.getTextField(pdfField).setText(value.slice(0, cut).trim());
        try {
          form.getTextField(spill.into).setText(value.slice(cut).trim());
        } catch {
          console.warn(`permit form: no overflow field "${spill.into}"`);
        }
      } else {
        form.getTextField(pdfField).setText(value);
      }
    } catch {
      /* A field named in the map is missing from this build of the PDF. Counties
         reissue these forms; skip it rather than failing the whole packet. */
      console.warn(`permit form: no text field "${pdfField}" in ${template.form_name}`);
    }
  }

  for (const [pdfField, flag] of Object.entries(map.checks ?? {})) {
    if (!ctx.flags[flag as FlagKey]) continue;
    try {
      form.getCheckBox(pdfField).check();
    } catch {
      console.warn(`permit form: no checkbox "${pdfField}" in ${template.form_name}`);
    }
  }

  /* Left editable on purpose. There is usually one correction to make at the
     kitchen table, and flattening forces a reprint. */
  const bytes = await pdf.save();

  const who = ctx.values.owner_name || "permit";
  const fileName = `${template.form_name.replace(/[^\w]+/g, "-")}-${who.replace(/[^\w]+/g, "-")}.pdf`;

  return { bytes, fileName, template, blanks };
}

/** Hand a filled form to the browser as a download. */
export function downloadForm(filled: Pick<FilledForm, "bytes" | "fileName">) {
  const blob = new Blob([filled.bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filled.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
