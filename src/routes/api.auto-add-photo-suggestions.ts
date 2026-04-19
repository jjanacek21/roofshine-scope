import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type SuggestedItem = {
  suggested_code?: string;
  suggested_qty?: number;
  unit?: string;
};

export const Route = createFileRoute("/api/auto-add-photo-suggestions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.replace("Bearer ", "");

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { job_id?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { job_id } = body;
        if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

        const { data: job } = await supabase
          .from("jobs")
          .select("id, company_id, price_book_id")
          .eq("id", job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

        const { data: company } = await supabase
          .from("companies")
          .select("auto_add_photo_suggestions")
          .eq("id", job.company_id)
          .maybeSingle();
        if (!company?.auto_add_photo_suggestions) {
          return Response.json({ skipped: true, reason: "toggle_off" });
        }

        const { data: estimate } = await supabase
          .from("estimates")
          .select("id")
          .eq("job_id", job_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!estimate) return Response.json({ skipped: true, reason: "no_estimate" });

        const { data: photos } = await supabase
          .from("job_photos")
          .select("matched_line_items, status")
          .eq("job_id", job_id)
          .eq("status", "analyzed");

        const { data: existing } = await supabase
          .from("estimate_line_items")
          .select("code, source")
          .eq("estimate_id", estimate.id);
        const existingAiCodes = new Set(
          (existing ?? []).filter((r) => r.source === "ai_photo" && r.code).map((r) => r.code as string),
        );

        const aggregate = new Map<string, { qty: number; unit?: string }>();
        for (const p of photos ?? []) {
          const items = (p.matched_line_items ?? []) as SuggestedItem[];
          for (const it of items) {
            if (!it.suggested_code) continue;
            if (existingAiCodes.has(it.suggested_code)) continue;
            const prev = aggregate.get(it.suggested_code);
            const qty = Number(it.suggested_qty ?? 1) || 1;
            if (!prev || qty > prev.qty) {
              aggregate.set(it.suggested_code, { qty, unit: it.unit });
            }
          }
        }

        if (aggregate.size === 0) {
          return Response.json({ inserted: 0 });
        }

        const codes = Array.from(aggregate.keys());
        const { data: matches } = await supabase
          .from("line_item_master")
          .select("id, code, name, unit, trade, default_price")
          .or(`company_id.eq.${job.company_id},company_id.is.null`)
          .in("code", codes);

        if (!matches?.length) return Response.json({ inserted: 0 });

        let priceMap: Record<string, number> = {};
        if (job.price_book_id) {
          const { data: prices } = await supabase
            .from("line_item_prices")
            .select("line_item_master_id, unit_price")
            .eq("price_book_id", job.price_book_id)
            .in("line_item_master_id", matches.map((m) => m.id));
          priceMap = Object.fromEntries(
            (prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]),
          );
        }

        const { data: existingCount } = await supabase
          .from("estimate_line_items")
          .select("id", { count: "exact", head: true })
          .eq("estimate_id", estimate.id);
        const baseSort = existingCount?.length ?? 0;

        const rows = matches.map((m, idx) => {
          const agg = aggregate.get(m.code)!;
          const unit_price = priceMap[m.id] ?? Number(m.default_price ?? 0);
          const qty = agg.qty;
          return {
            estimate_id: estimate.id,
            line_item_id: m.id,
            code: m.code,
            name: m.name,
            trade: m.trade,
            unit: agg.unit ?? m.unit,
            qty,
            unit_price,
            total: qty * unit_price,
            source: "ai_photo",
            sort_order: baseSort + idx,
          };
        });

        const { error } = await supabase.from("estimate_line_items").insert(rows);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }
        return Response.json({ inserted: rows.length });
      },
    },
  },
});
