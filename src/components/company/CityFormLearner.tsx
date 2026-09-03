import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, Loader2, Wand2, Save, AlertTriangle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { permitDepartments, type PermitDepartment } from "@/lib/permits/db";
import { learnForm, saveLearnedTemplate, type LearnedForm, type LearnedField } from "@/lib/permits/learn";
import type { SourceKey } from "@/lib/permits/context";

/**
 * Teaching the app a city's permit form.
 *
 * Company owners already hold the forms for the markets they work in. This
 * turns one of those into a map the filler can use, and the map is shared:
 * `permit_form_templates` carries no company, so a form mapped by one
 * contractor fills for every contractor working that jurisdiction. That is the
 * only route to national coverage that does not involve one person mapping
 * twenty thousand counties.
 *
 * The blank form is published. A filled example, if one is supplied, is read
 * for its geometry and then dropped — it is never uploaded anywhere, because
 * it carries a homeowner's name and address and someone's signature.
 */

const KEY_OPTIONS: { key: SourceKey | ""; label: string }[] = [
  { key: "", label: "— leave blank —" },
  { key: "property_address", label: "Property address" },
  { key: "property_city", label: "Property city" },
  { key: "property_state", label: "Property state" },
  { key: "property_zip", label: "Property ZIP" },
  { key: "folio", label: "Folio / parcel number" },
  { key: "legal_description", label: "Legal description" },
  { key: "square_footage", label: "Square footage" },
  { key: "valuation", label: "Valuation" },
  { key: "scope_description", label: "Scope of work" },
  { key: "today", label: "Today's date" },
  { key: "owner_name", label: "Owner name" },
  { key: "owner_phone", label: "Owner phone" },
  { key: "owner_email", label: "Owner email" },
  { key: "owner_address", label: "Owner address" },
  { key: "contractor_company", label: "Contractor company" },
  { key: "contractor_phone", label: "Contractor phone" },
  { key: "contractor_email", label: "Contractor email" },
  { key: "contractor_address", label: "Contractor address" },
  { key: "qualifier_name", label: "Qualifier name" },
  { key: "license_number", label: "License number" },
  { key: "lender_name", label: "Lender" },
  { key: "surety_name", label: "Surety" },
];

const FORM_TYPES = [
  { v: "permit_application", l: "Permit application" },
  { v: "owners_affidavit", l: "Owner's affidavit" },
  { v: "noc", l: "Notice of Commencement" },
  { v: "mitigation", l: "Mitigation / roof-to-wall" },
  { v: "checklist", l: "Checklist or notice" },
  { v: "other", l: "Other" },
];

export function CityFormLearner({ onSaved }: { onSaved?: () => void }) {
  const [depts, setDepts] = useState<PermitDepartment[]>([]);
  const [deptId, setDeptId] = useState("");
  const [formType, setFormType] = useState("permit_application");
  const [formName, setFormName] = useState("");
  const [blank, setBlank] = useState<File | null>(null);
  const [example, setExample] = useState<File | null>(null);
  const [learned, setLearned] = useState<LearnedForm | null>(null);
  const [fields, setFields] = useState<LearnedField[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await permitDepartments().select("id, name, county, city, is_hvhz").order("name");
      setDepts((data ?? []) as PermitDepartment[]);
    })();
  }, []);

  const dept = depts.find((d) => d.id === deptId) ?? null;

  const run = async () => {
    const source = example ?? blank;
    if (!source) {
      toast.error("Add the form first.");
      return;
    }
    setBusy("learn");
    setProgress("Opening the form…");
    try {
      const res = await learnForm(source, setProgress);
      setLearned(res);
      setFields(res.fields);
      if (!res.fields.length) {
        toast.warning("Nothing recognisable was found. A filled copy teaches far more than a blank one.");
      } else {
        toast.success(`${res.fields.length} field${res.fields.length === 1 ? "" : "s"} found — check them below.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that form.");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const save = async () => {
    if (!dept || !blank || !learned) return;
    const mapped = fields.filter((f) => f.key);
    if (!mapped.length) {
      toast.error("Point at least one field at a job value before saving.");
      return;
    }
    setBusy("save");
    try {
      const safe = blank.name.replace(/[^\w.\-]+/g, "_");
      const path = `${dept.id}/${formType}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("permit-form-templates")
        .upload(path, blank, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      await saveLearnedTemplate({
        buildingDeptId: dept.id,
        jurisdictionName: dept.name,
        county: dept.county ?? null,
        city: dept.city ?? null,
        formType,
        formName: formName.trim() || blank.name.replace(/\.pdf$/i, ""),
        filePath: path,
        learned: { ...learned, fields },
      });

      toast.success(`${dept.name} can now be filled automatically — for everyone.`);
      setBlank(null);
      setExample(null);
      setLearned(null);
      setFields([]);
      setFormName("");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that form.");
    } finally {
      setBusy(null);
    }
  };

  const setKey = (i: number, key: string) =>
    setFields((f) => f.map((x, j) => (j === i ? { ...x, key: (key || null) as SourceKey | null } : x)));

  const border = { borderColor: "var(--border)" };
  const fileBox =
    "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[12px] hover:bg-[var(--surface-hover)]";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Jurisdiction
          </span>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-[13px] text-foreground"
            style={border}
          >
            <option value="">Pick the city or county…</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.county ? ` — ${d.county}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What this form is
          </span>
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-[13px] text-foreground"
            style={border}
          >
            {FORM_TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Name it (optional)
        </span>
        <input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g. Uniform Building Permit Application"
          className="w-full rounded-lg border bg-transparent px-2.5 py-2 text-[13px] text-foreground outline-none"
          style={border}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fileBox} style={border}>
          <UploadCloud className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {blank ? blank.name : "Blank form — this gets published"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setBlank(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className={fileBox} style={border}>
          <Wand2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {example ? example.name : "A filled copy — read, then discarded"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setExample(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <p className="text-[11.5px] text-muted-foreground">
        A filled copy teaches far more than a blank one — the values are what say which field is which. It is read
        in your browser and never uploaded. Only the blank form and the resulting map are saved, and both are
        shared with every company filing in this jurisdiction.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void run()}
          disabled={busy !== null || (!blank && !example)}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          {busy === "learn" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy === "learn" ? progress || "Reading…" : "Read the form"}
        </button>
        {learned && (
          <button
            onClick={() => void save()}
            disabled={busy !== null || !dept || !blank}
            title={!blank ? "The blank form is what gets published — add it before saving." : undefined}
            className="inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
            style={border}
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save this map
          </button>
        )}
      </div>

      {learned && (
        <div className="space-y-2">
          {learned.notes.map((n, i) => (
            <p key={i} className="text-[11.5px] text-muted-foreground">
              {n}
            </p>
          ))}

          {fields.length > 0 && (
            <div className="overflow-x-auto rounded-lg border" style={border}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b" style={border}>
                    <th className="px-2.5 py-2 text-left font-semibold">Label on the form</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Example had</th>
                    <th className="px-2.5 py-2 text-left font-semibold">Fill it with</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={`${f.name}-${i}`} className="border-b last:border-0" style={border}>
                      <td className="px-2.5 py-1.5">
                        <div className="max-w-[220px] truncate text-foreground">{f.label || f.name}</div>
                        {f.confidence > 0 && f.confidence < 0.6 && (
                          <span
                            className="inline-flex items-center gap-1 text-[10.5px]"
                            style={{ color: "var(--warning, #b45309)" }}
                          >
                            <AlertTriangle className="h-3 w-3" /> low confidence
                          </span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-2.5 py-1.5 text-muted-foreground">
                        {f.sample ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <select
                          value={f.key ?? ""}
                          onChange={(e) => setKey(i, e.target.value)}
                          className="w-full rounded border bg-transparent px-1.5 py-1 text-[12px] text-foreground"
                          style={border}
                        >
                          {KEY_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono-num text-muted-foreground">{f.page}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11.5px]" style={{ color: "var(--warning, #b45309)" }}>
            Check the first filled copy against the real form before it goes to a counter. A map read off one
            example can sit a few points out, and counties reissue forms without saying so.
          </p>
        </div>
      )}

      {!depts.length && (
        <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" /> No jurisdictions on file yet — add the building department first.
        </p>
      )}
    </div>
  );
}
