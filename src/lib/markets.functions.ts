// Server functions for managing master "markets" — geographically-scoped price
// overlays on top of the shared master line_item_master catalog.
// A "market" is a row in price_books where company_id IS NULL AND is_default = true.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TRADE_VALUES = [
  "roofing", "exterior", "windows", "interior", "hvac",
  "plumbing", "electrical", "mitigation",
] as const;
type Trade = (typeof TRADE_VALUES)[number];

// Map free-form CSV "trade" labels onto the trade_type enum.
function normalizeTrade(raw: unknown): Trade {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return "interior";
  if (/(roof)/.test(t)) return "roofing";
  if (/(window)/.test(t)) return "windows";
  if (/(hvac|mechanical|air)/.test(t)) return "hvac";
  if (/(electric)/.test(t)) return "electrical";
  if (/(plumb)/.test(t)) return "plumbing";
  if (/(water|fire|mold|mitigat|abatement|asbestos|lead)/.test(t)) return "mitigation";
  if (/(siding|stucco|exterior|gutter|fence|deck|concrete|masonry|landscap)/.test(t)) return "exterior";
  // Everything else (Drywall, Painting, Contents, Site Protection, Cabinetry,
  // Flooring, Doors, Tile, Cleaning, Demolition, Framing, Trim, Stairs, etc.)
  return "interior";
}

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error) throw new Error("Profile lookup failed");
  if (data?.role !== "super_admin") throw new Error("Forbidden: super admin only");
}

/* ============================== List markets ============================== */

export const listMarkets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const { data: books, error } = await supabaseAdmin
      .from("price_books")
      .select("id, name, region_name, jurisdiction, zip_codes, item_count, effective_month, notes, created_at")
      .is("company_id", null)
      .eq("is_default", true)
      .order("region_name", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return { markets: books ?? [] };
  });

/* ======================= Public market list (onboarding) ================== */
// Any authenticated user can read the available master markets so they can
// pick one when creating a new company.
export const listMarketsPublic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("price_books")
      .select("id, name, region_name, jurisdiction, item_count")
      .is("company_id", null)
      .eq("is_default", true)
      .eq("is_active", true)
      .order("region_name", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return { markets: data ?? [] };
  });

/* ========================= Get one market with prices ===================== */

export const getMarketDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { data: book, error: bookErr } = await supabaseAdmin
      .from("price_books")
      .select("id, name, region_name, jurisdiction, zip_codes, item_count, notes")
      .eq("id", data.id)
      .single();
    if (bookErr) throw bookErr;
    const { data: prices, error: pErr } = await supabaseAdmin
      .from("line_item_prices")
      .select("unit_price, remove_price, line_item_master_id, line_item_master:line_item_master_id(code, name, unit, trade, subgroup)")
      .eq("price_book_id", data.id)
      .order("line_item_master_id");
    if (pErr) throw pErr;
    return { market: book, prices: prices ?? [] };
  });

/* ============================== Upsert market ============================= */

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  region_name: z.string().min(1).max(120),
  jurisdiction: z.string().max(120).nullable().optional(),
  zip_codes: z.array(z.string().regex(/^\d{3,5}$/)).max(2000),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    const payload = {
      company_id: null as string | null,
      is_default: true,
      is_active: true,
      pricing_type: "insurance" as const,
      source: "csv",
      status: "active" as const,
      name: data.region_name,
      region_name: data.region_name,
      jurisdiction: data.jurisdiction ?? null,
      zip_codes: data.zip_codes,
      notes: data.notes ?? null,
      created_by: context.userId,
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("price_books")
        .update({
          region_name: payload.region_name,
          name: payload.name,
          jurisdiction: payload.jurisdiction,
          zip_codes: payload.zip_codes,
          notes: payload.notes,
        })
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("price_books")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

/* ============================== Delete market ============================= */

export const deleteMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    await supabaseAdmin.from("line_item_prices").delete().eq("price_book_id", data.id);
    const { error } = await supabaseAdmin.from("price_books").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* =========================== Ingest CSV into market ======================== */

const IngestRowSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(16).default("EA"),
  replace_price: z.number().nonnegative(),
  remove_price: z.number().nonnegative().default(0),
  trade: z.string().max(80).optional().nullable(),
  subgroup: z.string().max(160).optional().nullable(),
});

const IngestSchema = z.object({
  market_id: z.string().uuid(),
  replace_existing_prices: z.boolean().default(true),
  rows: z.array(IngestRowSchema).min(1).max(5000),
});

export const ingestMarketCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IngestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // 1. Load existing master catalog (company_id NULL) keyed by uppercase code.
    const { data: existing, error: existErr } = await supabaseAdmin
      .from("line_item_master")
      .select("id, code")
      .is("company_id", null);
    if (existErr) throw existErr;
    const idByCode = new Map<string, string>();
    for (const r of existing ?? []) idByCode.set(String(r.code).toUpperCase(), r.id as string);

    // 2. Dedupe incoming rows by code (last occurrence wins) to avoid violating
    //    the unique (price_book_id, line_item_master_id) constraint when a CSV
    //    happens to contain the same item_number twice.
    const dedupedByCode = new Map<string, typeof data.rows[number]>();
    for (const r of data.rows) dedupedByCode.set(r.code.toUpperCase(), r);
    const rows = Array.from(dedupedByCode.values());

    // 3. Insert catalog rows for any codes not yet present (the first CSV seeds).
    const toCreate = rows.filter((r) => !idByCode.has(r.code.toUpperCase()));
    const createdCount = toCreate.length;
    const matchedCount = rows.length - createdCount;

    const chunkSize = 500;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const batch = toCreate.slice(i, i + chunkSize).map((r) => ({
        company_id: null,
        code: r.code,
        name: r.name,
        unit: r.unit || "EA",
        trade: normalizeTrade(r.trade),
        category: r.subgroup ?? null,
        subgroup: r.subgroup ?? null,
        description: r.name,
        default_price: r.replace_price,
        replace_price: r.replace_price,
        remove_price: r.remove_price,
        status: "active" as const,
      }));
      const { data: inserted, error } = await supabaseAdmin
        .from("line_item_master")
        .insert(batch)
        .select("id, code");
      if (error) throw error;
      for (const row of inserted ?? []) idByCode.set(String(row.code).toUpperCase(), row.id as string);
    }

    // 4. Optionally wipe existing prices for this market, then insert fresh ones.
    if (data.replace_existing_prices) {
      await supabaseAdmin.from("line_item_prices").delete().eq("price_book_id", data.market_id);
    }

    const priceRows = rows
      .map((r) => {
        const id = idByCode.get(r.code.toUpperCase());
        if (!id) return null;
        return {
          price_book_id: data.market_id,
          line_item_master_id: id,
          unit_price: r.replace_price,
          remove_price: r.remove_price,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    for (let i = 0; i < priceRows.length; i += chunkSize) {
      const batch = priceRows.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin
        .from("line_item_prices")
        .upsert(batch, { onConflict: "price_book_id,line_item_master_id" });
      if (error) throw error;
    }

    // 4. Refresh item_count on the price_book.
    await supabaseAdmin
      .from("price_books")
      .update({ item_count: priceRows.length, updated_at: new Date().toISOString() })
      .eq("id", data.market_id);

    return {
      ok: true,
      total_rows: data.rows.length,
      catalog_items_created: createdCount,
      catalog_items_matched: matchedCount,
      prices_written: priceRows.length,
    };
  });
