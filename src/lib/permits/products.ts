import { supabase } from "@/integrations/supabase/client";
import {
  productApprovals,
  jobPermitProducts,
  type ProductApproval,
  type JobPermitProduct,
} from "./db";

/**
 * Attaching product approvals to a permit packet.
 *
 * The packet needs, for every product going on the roof, the document that
 * proves it is approved for this jurisdiction. In Florida that is a Miami-Dade
 * NOA inside the High Velocity Hurricane Zone and a Florida Product Approval
 * number outside it.
 *
 * Until now the Permits tab said these were "attached automatically" and told
 * the user to pick them on the Order Form. Neither was true: nothing ever wrote
 * a `job_permit_products` row, and the order form has no link to the approval
 * library at all. This module is that missing link — it suggests approvals from
 * the materials already chosen on the job, and it saves the ones the user
 * confirms.
 *
 * It suggests. It never decides. A wrong approval on a packet is a rejected
 * permit, so the user confirms every row.
 */

export type ProductRole = JobPermitProduct["role"];

export const PRODUCT_ROLES: { role: ProductRole; label: string; hint: string }[] = [
  { role: "roof_covering", label: "Roof covering", hint: "Shingle, tile, metal panel — the surface itself." },
  { role: "underlayment", label: "Underlayment", hint: "The membrane under the covering." },
  { role: "fastener", label: "Fastener", hint: "Nails, screws, clips where the approval names them." },
  { role: "adhesive", label: "Adhesive", hint: "Foam, mortar or bonding products." },
  { role: "accessory", label: "Accessory", hint: "Vents, flashing, edge metal, skylights." },
  { role: "other", label: "Other", hint: "Anything else the counter asks to see." },
];

export const roleLabel = (r: string) =>
  PRODUCT_ROLES.find((x) => x.role === r)?.label ?? r.replace(/_/g, " ");

/** Days until an approval lapses. Negative means it already has. */
export function approvalDaysLeft(a: Pick<ProductApproval, "expiration_date">): number | null {
  if (!a.expiration_date) return null;
  return Math.floor(
    (new Date(a.expiration_date).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
  );
}

export interface ApprovalStatus {
  state: "current" | "expiring" | "expired" | "unknown";
  text: string;
}

/** How an approval's date reads to someone about to file. */
export function approvalStatus(a: Pick<ProductApproval, "expiration_date">): ApprovalStatus {
  const d = approvalDaysLeft(a);
  if (d === null) return { state: "unknown", text: "No expiry on file" };
  if (d < 0) return { state: "expired", text: `Expired ${Math.abs(d)} days ago` };
  if (d <= 60) return { state: "expiring", text: `Expires in ${d} days` };
  return { state: "current", text: `Current until ${new Date(a.expiration_date!).toLocaleDateString()}` };
}

const APPROVAL_COLS =
  "id, manufacturer, product_name, product_category, noa_number, fl_product_approval, expiration_date, hvhz_approved, noa_pdf_url, fl_approval_pdf_url, file_url";

export interface ApprovalSearch {
  /** Free text across manufacturer and product name. */
  q?: string;
  /** True inside the High Velocity Hurricane Zone — Miami-Dade and Broward. */
  hvhzOnly?: boolean;
  /** Hide approvals that have already lapsed. Default true. */
  hideExpired?: boolean;
  limit?: number;
}

export async function searchApprovals(opts: ApprovalSearch = {}): Promise<ProductApproval[]> {
  let q = productApprovals().select(APPROVAL_COLS).eq("is_active", true);
  if (opts.hvhzOnly) q = q.eq("hvhz_approved", true);
  if (opts.q?.trim()) {
    const term = opts.q.trim().replace(/[%,()]/g, " ");
    q = q.or(
      `manufacturer.ilike.%${term}%,product_name.ilike.%${term}%,noa_number.ilike.%${term}%,fl_product_approval.ilike.%${term}%`,
    );
  }
  const { data, error } = await q.order("manufacturer").limit(opts.limit ?? 40);
  if (error) throw error;
  let rows = (data ?? []) as ProductApproval[];
  if (opts.hideExpired !== false) {
    rows = rows.filter((r) => (approvalDaysLeft(r) ?? 0) >= 0);
  }
  return rows;
}

/* ── suggesting from the job's own materials ───────────────────────────── */

/** Words that appear in nearly every product name and so carry no signal. */
const STOP = new Set([
  "roof", "roofing", "shingle", "shingles", "tile", "tiles", "metal", "panel", "panels",
  "underlayment", "felt", "cap", "sheet", "system", "the", "and", "for", "with", "self",
  "adhered", "adhesive", "nail", "nails", "screw", "screws", "in", "of", "sq", "ft", "lf",
  "bundle", "roll", "each", "ea", "box", "bd",
]);

const tokens = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/**
 * How strongly a material name and an approval describe the same product.
 * Distinctive shared words score; a bare category match does not.
 */
function score(materialName: string, a: ProductApproval): number {
  const m = new Set(tokens(materialName));
  if (!m.size) return 0;
  const target = tokens(`${a.manufacturer ?? ""} ${a.product_name ?? ""}`);
  if (!target.length) return 0;
  let hits = 0;
  for (const t of new Set(target)) if (m.has(t)) hits += 1;
  if (!hits) return 0;
  // Favour a manufacturer match: it is the strongest single signal.
  const manuHit = tokens(a.manufacturer ?? "").some((t) => m.has(t)) ? 1 : 0;
  return hits / Math.max(m.size, 3) + manuHit * 0.5;
}

export interface ApprovalSuggestion {
  material: string;
  approval: ProductApproval;
  role: ProductRole;
  confidence: number;
}

const ROLE_BY_CATEGORY: [RegExp, ProductRole][] = [
  [/underlay|felt|membrane|peel|ice.?water/i, "underlayment"],
  [/nail|screw|fasten|clip|anchor/i, "fastener"],
  [/adhesive|foam|mortar|cement|sealant/i, "adhesive"],
  [/vent|flash|edge|drip|skylight|boot|valley/i, "accessory"],
  [/shingle|tile|panel|metal|cap|coating|shake|slate/i, "roof_covering"],
];

const roleFor = (text: string): ProductRole => {
  for (const [rx, role] of ROLE_BY_CATEGORY) if (rx.test(text)) return role;
  return "other";
};

/**
 * Read the materials chosen on this job's order draft and suggest the approval
 * that covers each one.
 *
 * Materials and approvals are two separate catalogues with no key between them,
 * so this matches on words. It is a starting point for the user to confirm,
 * which is why every suggestion carries its confidence and the material name it
 * came from.
 */
export async function suggestApprovalsForJob(
  jobId: string,
  opts: { hvhzOnly?: boolean } = {},
): Promise<ApprovalSuggestion[]> {
  const { data: draft } = await supabase
    .from("job_order_drafts")
    .select("material_overrides")
    .eq("job_id", jobId)
    .maybeSingle();

  const overrides = ((draft as { material_overrides?: { material_id?: string | null; excluded?: boolean }[] } | null)
    ?.material_overrides ?? []) as { material_id?: string | null; excluded?: boolean }[];
  const ids = overrides.filter((o) => o.material_id && !o.excluded).map((o) => o.material_id!) as string[];
  if (!ids.length) return [];

  const { data: mats } = await supabase
    .from("material_catalog")
    .select("id, name, brand")
    .in("id", ids);
  const materials = (mats ?? []) as { id: string; name: string; brand?: string | null }[];
  if (!materials.length) return [];

  const pool = await searchApprovals({ hvhzOnly: opts.hvhzOnly, limit: 400 });

  const out: ApprovalSuggestion[] = [];
  const used = new Set<string>();
  for (const m of materials) {
    const text = `${m.brand ?? ""} ${m.name}`.trim();
    let best: { a: ProductApproval; s: number } | null = null;
    for (const a of pool) {
      const s = score(text, a);
      if (s > 0 && (!best || s > best.s)) best = { a, s };
    }
    // A weak word overlap is noise, not a suggestion.
    if (best && best.s >= 0.34 && !used.has(best.a.id)) {
      used.add(best.a.id);
      out.push({ material: m.name, approval: best.a, role: roleFor(text), confidence: Math.min(best.s, 1) });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/* ── saving ─────────────────────────────────────────────────────────────── */

export async function attachApproval(
  permitId: string,
  approvalId: string,
  role: ProductRole,
  sortOrder = 0,
): Promise<void> {
  const { error } = await jobPermitProducts().insert({
    permit_id: permitId,
    product_approval_id: approvalId,
    role,
    sort_order: sortOrder,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // 23505 means it is already on the packet, which is the outcome asked for.
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

export async function detachApproval(permitId: string, approvalId: string): Promise<void> {
  const { error } = await jobPermitProducts()
    .delete()
    .eq("permit_id", permitId)
    .eq("product_approval_id", approvalId);
  if (error) throw error;
}

export async function attachMany(
  permitId: string,
  picks: { approvalId: string; role: ProductRole }[],
): Promise<number> {
  let n = 0;
  for (let i = 0; i < picks.length; i++) {
    try {
      await attachApproval(permitId, picks[i].approvalId, picks[i].role, i);
      n += 1;
    } catch (e) {
      console.warn("could not attach a product approval", e);
    }
  }
  return n;
}
