import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  buildSystemItems,
  buildFlCodeItems,
  type Measurements,
  type RoofSystem,
} from "@/lib/roof-system-templates";

type PhotoAnalysis = {
  roof_system?: string;
  condition_score?: number;
  observed_items?: Array<{
    description?: string;
    suggested_code?: string;
    suggested_qty?: number;
    unit?: string;
    confidence?: string;
  }>;
};

const ROOF_SYSTEM_VALUES: ReadonlyArray<RoofSystem> = [
  "laminated_shingle", "3tab_shingle", "concrete_tile", "clay_tile",
  "metal_standing_seam", "metal_screw_down", "modified_bitumen",
  "tpo", "epdm", "spf", "coating",
];

function decideRoofSystem(photos: Array<{ ai_analysis: PhotoAnalysis | null }>): RoofSystem | null {
  const tally = new Map<RoofSystem, number>();
  for (const p of photos) {
    const sys = p.ai_analysis?.roof_system as RoofSystem | undefined;
    if (!sys || !ROOF_SYSTEM_VALUES.includes(sys)) continue;
    const weight = 1 + (100 - Math.min(100, p.ai_analysis?.condition_score ?? 50)) / 100;
    tally.set(sys, (tally.get(sys) ?? 0) + weight);
  }
  let best: RoofSystem | null = null;
  let bestScore = 0;
  for (const [k, v] of tally) {
    if (v > bestScore) { best = k; bestScore = v; }
  }
  return best;
}

export const Route = createFileRoute("/api/build-roof-estimate")({
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
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: { job_id?: string; insert?: boolean };
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const { job_id, insert = false } = body;
        if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

        const { data: job } = await supabase
          .from("jobs")
          .select("id, company_id, price_book_id, property_id, primary_trade")
          .eq("id", job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

        const { data: company } = await supabase
          .from("companies")
          .select("include_fl_code_package")
          .eq("id", job.company_id)
          .maybeSingle();

        const { data: photos = [] } = await supabase
          .from("job_photos")
          .select("id, ai_analysis, matched_line_items")
          .eq("job_id", job_id)
          .eq("status", "analyzed");

        type Photo = { id: string; ai_analysis: PhotoAnalysis | null; matched_line_items: unknown };
        const typedPhotos = (photos ?? []) as Photo[];

        const system = decideRoofSystem(typedPhotos);
        if (!system) {
          return Response.json({ system: null, items: [], reason: "no_roof_system_detected" });
        }

        // Measurements: prefer roof_measurements via property, else fall back to estimates from photos.
        let m: Measurements | null = null;
        if (job.property_id) {
          const { data: rm } = await supabase
            .from("roof_measurements")
            .select("squares, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, gutters_lf, drip_edge_lf")
            .eq("property_id", job.property_id)
            .maybeSingle();
          if (rm) {
            m = {
              squares: Number(rm.squares) || 0,
              eaves_lf: Number(rm.eaves_lf) || 0,
              rakes_lf: Number(rm.rakes_lf) || 0,
              ridges_lf: Number(rm.ridges_lf) || 0,
              hips_lf: Number(rm.hips_lf) || 0,
              valleys_lf: Number(rm.valleys_lf) || 0,
              gutters_lf: Number(rm.gutters_lf) || 0,
              pipe_count: 0,
              has_ridge_vent: false,
              has_off_ridge_vents: false,
              off_ridge_vent_count: 0,
              has_gutters: (Number(rm.gutters_lf) || 0) > 0,
            };
          }
        }
        if (!m) {
          // Ratio fallback off photo-suggested squares.
          let sq = 0;
          for (const p of typedPhotos) {
            for (const it of p.ai_analysis?.observed_items ?? []) {
              if ((it.unit ?? "").toUpperCase() === "SQ") sq = Math.max(sq, Number(it.suggested_qty) || 0);
            }
          }
          if (sq <= 0) sq = 25; // conservative default
          m = {
            squares: sq,
            eaves_lf: sq * 8,
            rakes_lf: sq * 6,
            ridges_lf: sq * 2,
            hips_lf: sq * 1.5,
            valleys_lf: sq * 1,
            gutters_lf: 0,
            pipe_count: 2,
            has_ridge_vent: true,
            has_off_ridge_vents: false,
            off_ridge_vent_count: 0,
            has_gutters: false,
          };
        }

        // Augment from photo cues (vents, pipes, gutters).
        let pipeCount = 0;
        let offRidgeCount = 0;
        let sawRidgeVent = false;
        let sawGutters = false;
        for (const p of typedPhotos) {
          for (const it of p.ai_analysis?.observed_items ?? []) {
            const d = `${it.description ?? ""} ${it.suggested_code ?? ""}`.toLowerCase();
            if (d.includes("pipe") && (d.includes("boot") || d.includes("flash") || d.includes("jack"))) {
              pipeCount = Math.max(pipeCount, Math.round(Number(it.suggested_qty) || 1));
            }
            if (d.includes("ridge vent")) sawRidgeVent = true;
            if (d.includes("off-ridge") || d.includes("box vent") || d.includes("turtle")) {
              offRidgeCount = Math.max(offRidgeCount, Math.round(Number(it.suggested_qty) || 1));
            }
            if (d.includes("gutter")) sawGutters = true;
          }
        }
        if (pipeCount > 0) m.pipe_count = pipeCount;
        if (sawRidgeVent) m.has_ridge_vent = true;
        if (offRidgeCount > 0) { m.has_off_ridge_vents = true; m.off_ridge_vent_count = offRidgeCount; }
        if (sawGutters) m.has_gutters = true;

        const systemItems = buildSystemItems(system, m);
        const flItems = company?.include_fl_code_package ? buildFlCodeItems(m) : [];

        // Damage items: dedupe across photos with MAX qty, skip codes covered by system/FL.
        const reservedCodes = new Set([...systemItems, ...flItems].map((i) => i.code));
        const damage = new Map<string, { qty: number; unit: string; description: string }>();
        for (const p of typedPhotos) {
          for (const it of p.ai_analysis?.observed_items ?? []) {
            if (!it.suggested_code) continue;
            if (reservedCodes.has(it.suggested_code)) continue;
            const qty = Number(it.suggested_qty) || 1;
            const prev = damage.get(it.suggested_code);
            if (!prev || qty > prev.qty) {
              damage.set(it.suggested_code, { qty, unit: it.unit ?? "EA", description: it.description ?? "" });
            }
          }
        }

        // Resolve catalog (codes -> id/name/price)
        const allCodes = [
          ...systemItems.map((i) => i.code),
          ...flItems.map((i) => i.code),
          ...damage.keys(),
        ];
        const { data: catalog = [] } = await supabase
          .from("line_item_master")
          .select("id, code, name, unit, trade, default_price")
          .or(`company_id.eq.${job.company_id},company_id.is.null`)
          .in("code", allCodes);
        const catByCode = new Map<string, { id: string; code: string; name: string; unit: string; trade: string; default_price: number }>();
        for (const c of catalog ?? []) catByCode.set(c.code, c as never);

        let priceMap: Record<string, number> = {};
        if (job.price_book_id && catByCode.size) {
          const { data: prices } = await supabase
            .from("line_item_prices")
            .select("line_item_master_id, unit_price")
            .eq("price_book_id", job.price_book_id)
            .in("line_item_master_id", Array.from(catByCode.values()).map((c) => c.id));
          priceMap = Object.fromEntries((prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]));
        }

        type PreviewItem = { code: string; name: string; qty: number; unit: string; unit_price: number; source: "system" | "fl_code" | "ai_photo"; line_item_id: string | null; trade: string };
        const preview: PreviewItem[] = [];

        const push = (code: string, qty: number, unit: string, source: PreviewItem["source"], fallbackName?: string) => {
          const cat = catByCode.get(code);
          const id = cat?.id ?? null;
          const price = id && priceMap[id] != null ? priceMap[id] : Number(cat?.default_price ?? 0);
          preview.push({
            code,
            name: cat?.name ?? fallbackName ?? code,
            qty,
            unit: cat?.unit ?? unit,
            unit_price: price,
            source,
            line_item_id: id,
            trade: cat?.trade ?? "roofing",
          });
        };

        for (const i of systemItems) push(i.code, i.qty, i.unit, "system");
        for (const i of flItems) push(i.code, i.qty, i.unit, "fl_code");
        for (const [code, d] of damage) push(code, d.qty, d.unit, "ai_photo", d.description);

        // Persist detected roof_system on the job for future runs.
        await supabase.from("jobs").update({ roof_system: system }).eq("id", job_id);

        if (insert) {
          const { data: estimate } = await supabase
            .from("estimates")
            .select("id")
            .eq("job_id", job_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!estimate) return Response.json({ system, items: preview, inserted: 0, reason: "no_estimate" });

          // Replace prior ai_photo / system / fl_code rows for this estimate.
          await supabase.from("estimate_line_items")
            .delete()
            .eq("estimate_id", estimate.id)
            .in("source", ["ai_photo", "system", "fl_code"]);

          const { count: existingCount } = await supabase
            .from("estimate_line_items")
            .select("id", { count: "exact", head: true })
            .eq("estimate_id", estimate.id);
          const baseSort = existingCount ?? 0;

          const rows = preview
            .filter((i) => i.line_item_id) // only insert resolved catalog items
            .map((i, idx) => ({
              estimate_id: estimate.id,
              line_item_id: i.line_item_id!,
              code: i.code,
              name: i.name,
              trade: i.trade,
              unit: i.unit,
              qty: i.qty,
              unit_price: i.unit_price,
              total: i.qty * i.unit_price,
              source: i.source,
              sort_order: baseSort + idx,
            }));
          if (rows.length) {
            const { error } = await supabase.from("estimate_line_items").insert(rows);
            if (error) return Response.json({ error: error.message }, { status: 500 });
          }
          return Response.json({ system, items: preview, inserted: rows.length, measurements: m });
        }

        return Response.json({ system, items: preview, measurements: m });
      },
    },
  },
});
