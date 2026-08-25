/**
 * Claim Buddy AI report narrative — shared types and client-safe helpers.
 *
 * The model writes the narrative; the takeoff stays the authority for scope.
 * Everything here is browser-safe: the gateway call lives in
 * `cb-report-ai.server.ts` behind the server function in
 * `cb-report-ai.functions.ts`.
 */
import type { CbLineItem } from "@/lib/cbReport";
import type { CbSheet, CbVentResult } from "@/lib/cbSheet";

export interface CbAiScopeRow {
  component: string;
  condition: string;
  action: string;
}

export interface CbAiCaption {
  photo_id: string;
  title: string;
  description: string;
}

export interface CbAiReport {
  summary: string[];
  roof_scope: CbAiScopeRow[];
  exterior_scope: CbAiScopeRow[];
  interior_note: string;
  storm_context: string;
  cover_caption: string;
  photo_captions: CbAiCaption[];
  missing: string[];
}

export interface CbAiInput {
  company: { name: string; short_name: string };
  job: {
    address: string;
    owner: string;
    carrier: string;
    claim_number: string;
    date_of_loss: string;
    peril: string;
    inspection_date: string;
    structure_type: string;
    project_manager: string;
    rep_name: string;
  };
  roof: Record<string, string | number>;
  ventilation: { providedNfa: number; requiredNfa: number; deficit: number; under: boolean };
  takeoff: { description: string; quantity: number; unit: string; note?: string }[];
  photos: { id: string; index: number; category: string; elevation: string; shot_type: string; item_key: string; rep_note: string }[];
  has_priced_estimate: boolean;
}

export const CB_TBC = "To be confirmed";

/** Anything empty prints "To be confirmed" — a bare em dash is never printed. */
export function tbc(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  if (!s || s === "—" || s === "-" || s === "null" || s === "undefined") return CB_TBC;
  return s;
}

/** Strip stray em dashes used as an empty placeholder inside generated prose. */
export function cleanText(s: string): string {
  return String(s ?? "")
    .replace(/(^|[\s(])[—–-](?=$|[\s).,])/g, (m, p1: string) => `${p1}${CB_TBC}`)
    .trim();
}

const MONEY = /(\$\s?[\d,]+(?:\.\d{2})?)|(\b\d[\d,]*(?:\.\d{2})?\s?(?:dollars|USD)\b)/gi;
const APPROVAL =
  /\b(will be (?:approved|covered|paid)|is (?:approved|covered)|guaranteed (?:approval|coverage)|the carrier must (?:pay|approve)|bad faith|acting in bad faith)\b/gi;

/** Guard the model output: no prices unless a priced estimate exists, no approval or bad-faith claims. */
export function guardText(s: string, allowMoney: boolean): string {
  let out = cleanText(s);
  if (!allowMoney) out = out.replace(MONEY, "as established by the line-item estimate");
  out = out.replace(APPROVAL, "is documented for the carrier's review");
  return out;
}

export function guardReport(r: CbAiReport, allowMoney: boolean): CbAiReport {
  const row = (x: CbAiScopeRow): CbAiScopeRow => ({
    component: guardText(x.component, allowMoney),
    condition: guardText(x.condition, allowMoney),
    action: guardText(x.action, allowMoney),
  });
  return {
    summary: (r.summary ?? []).map((p) => guardText(p, allowMoney)).filter(Boolean),
    roof_scope: (r.roof_scope ?? []).filter((x) => x?.component).map(row),
    exterior_scope: (r.exterior_scope ?? []).filter((x) => x?.component).map(row),
    interior_note: guardText(r.interior_note ?? "", allowMoney),
    storm_context: guardText(r.storm_context ?? "", allowMoney),
    cover_caption: guardText(r.cover_caption ?? "", allowMoney),
    photo_captions: (r.photo_captions ?? [])
      .filter((c) => c?.photo_id)
      .map((c) => ({
        photo_id: c.photo_id,
        title: guardText(c.title ?? "", allowMoney),
        description: guardText(c.description ?? "", allowMoney),
      })),
    missing: (r.missing ?? []).map((m) => cleanText(m)).filter(Boolean),
  };
}

export const CB_EMPTY_AI: CbAiReport = {
  summary: [],
  roof_scope: [],
  exterior_scope: [],
  interior_note: "",
  storm_context: "",
  cover_caption: "",
  photo_captions: [],
  missing: [],
};

/** Fallback scope rows built straight from the takeoff when the model is unavailable. */
export function scopeFromLineItems(items: CbLineItem[]): { roof: CbAiScopeRow[]; exterior: CbAiScopeRow[] } {
  const roof: CbAiScopeRow[] = [];
  const exterior: CbAiScopeRow[] = [];
  for (const li of items) {
    const row: CbAiScopeRow = {
      component: li.description.split(" — ")[0],
      condition: li.note ? cleanText(li.note) : "Documented during the inspection.",
      action: `${li.description} — ${li.quantity} ${li.unit}.`,
    };
    (li.source === "takeoff" && /elevation|gutter|downspout|siding|window|fence|screen/i.test(li.description)
      ? exterior
      : roof
    ).push(row);
  }
  return { roof, exterior };
}

/** Compact everything the model needs into one payload. */
export function buildAiInput(args: {
  company: Record<string, unknown> | null;
  job: Record<string, unknown> | null;
  sheet: CbSheet;
  squares: number;
  measurement: Record<string, number | string | null> | null;
  vent: CbVentResult;
  lineItems: CbLineItem[];
  photos: { id: string; category: string; elevation: string | null; shot_type: string | null; item_key: string | null; caption: string | null }[];
  repName: string | null;
  hasPricedEstimate: boolean;
}): CbAiInput {
  const { company, job, sheet, squares, measurement, vent, lineItems, photos, repName, hasPricedEstimate } = args;
  const m = (k: string) => Number(measurement?.[k] ?? 0) || 0;
  const name = String(company?.name ?? "the contractor");
  return {
    company: { name, short_name: String(company?.short_name ?? name) },
    job: {
      address: tbc(job?.address),
      owner: tbc(job?.customer_name),
      carrier: tbc(job?.carrier),
      claim_number: tbc(job?.claim_number),
      date_of_loss: tbc(job?.date_of_loss),
      peril: tbc(job?.peril ?? "Hail / Wind"),
      inspection_date: tbc(job?.inspection_date ?? job?.created_at),
      structure_type: tbc(sheet.roof_system.stories ? `${sheet.roof_system.stories}-story` : null),
      project_manager: tbc(job?.project_manager),
      rep_name: tbc(repName),
    },
    roof: {
      system: tbc(sheet.roof_system.roof_type),
      pitch: tbc(sheet.roof_system.pitch ?? measurement?.pitch),
      stories: tbc(sheet.roof_system.stories),
      layers: tbc(sheet.roof_system.layers),
      decking: tbc(sheet.decking.type ?? sheet.roof_system.decking_type),
      decking_condition: tbc(sheet.decking.condition ?? sheet.roof_system.decking_condition),
      squares: squares.toFixed(2),
      ridge_lf: m("ridge_lf"),
      hip_lf: m("hip_lf"),
      valley_lf: m("valley_lf"),
      eave_lf: m("eave_lf"),
      rake_lf: m("rake_lf"),
    },
    ventilation: {
      providedNfa: vent.providedNfa,
      requiredNfa: vent.requiredNfa,
      deficit: vent.deficit,
      under: vent.under,
    },
    takeoff: lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      note: li.note,
    })),
    photos: photos.map((p, i) => ({
      id: p.id,
      index: i + 1,
      category: p.category ?? "other",
      elevation: p.elevation ?? "",
      shot_type: p.shot_type ?? "",
      item_key: p.item_key ?? "",
      rep_note: p.caption ?? "",
    })),
    has_priced_estimate: hasPricedEstimate,
  };
}
