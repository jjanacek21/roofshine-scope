// Server functions for managing master "markets" — geographically-scoped price
// overlays on top of the shared master line_item_master catalog.
// A "market" is a row in price_books where company_id IS NULL AND is_default = true.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TRADE_VALUES = [
  "roofing", "exterior", "windows", "interior", "hvac",
  "plumbing", "electrical", "mitigation", "solar", "general",
] as const;
type Trade = (typeof TRADE_VALUES)[number];

function normalizeTrade(raw: unknown): Trade {
  const t = String(raw ?? "").trim().toLowerCase();
  return (TRADE_VALUES as readonly string[]).includes(t) ? (t as Trade) : "general";
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
    // line_item_prices has ON DELETE CASCADE via price_book_id (verify in DB);
    // if not, explicitly delete prices first.
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
  unit_price: z.number().nonnegative(),
  trade: z.string().max(40).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
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
    for (const r of existing ?? []) idByCode.set(r.code.toUpperCase(), r.id as string);

    // 2. Upsert catalog rows for any codes not yet present.
    const toCreate = data.rows.filter((r) => !idByCode.has(r.code.toUpperCase()));
    const createdCount = toCreate.length;
    const updatedCount = data.rows.length - createdCount;

    const chunkSize = 500;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const batch = toCreate.slice(i, i + chunkSize).map((r) => ({
        company_id: null,
        code: r.code,
        name: r.name,
        unit: r.unit || "EA",
        trade: normalizeTrade(r.trade),
        category: r.category ?? null,
        description: r.description ?? null,
        default_price: r.unit_price,
        status: "active" as const,
      }));
      const { data: inserted, error } = await supabaseAdmin
        .from("line_item_master")
        .insert(batch)
        .select("id, code");
      if (error) throw error;
      for (const row of inserted ?? []) idByCode.set(row.code.toUpperCase(), row.id as string);
    }

    // 3. Optionally wipe existing prices for this market, then insert fresh ones.
    if (data.replace_existing_prices) {
      await supabaseAdmin.from("line_item_prices").delete().eq("price_book_id", data.market_id);
    }

    const priceRows = data.rows
      .map((r) => {
        const id = idByCode.get(r.code.toUpperCase());
        if (!id) return null;
        return {
          price_book_id: data.market_id,
          line_item_master_id: id,
          unit_price: r.unit_price,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    for (let i = 0; i < priceRows.length; i += chunkSize) {
      const batch = priceRows.slice(i, i + chunkSize);
      const { error } = data.replace_existing_prices
        ? await supabaseAdmin.from("line_item_prices").insert(batch)
        : await supabaseAdmin
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
      catalog_items_matched: updatedCount,
      prices_written: priceRows.length,
    };
  });
