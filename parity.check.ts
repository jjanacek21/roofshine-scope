import { createClient } from "@supabase/supabase-js";
import { runCbInstantMeasure } from "@/lib/cb-measure.server";
import { runSolarRoofExtract } from "@/lib/solar-extract.server";
import { roofTotals } from "@/lib/roof-measurement-save";

const token = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN!;
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: claims } = await sb.auth.getClaims(token);
const userId = claims!.claims.sub as string;
const lat = 32.9483, lng = -96.7299;

// --- GC path: exactly what SolarRoofTab posts, then its persistence math ---
const gc = await runSolarRoofExtract({ supabase: sb, userId, lat, lng });
const segs = (gc.body.segments as any[]) ?? [];
const gcTotals = roofTotals(segs.map(s => ({ pitch: s.pitch, plan_area_sqft: s.plan_area_sqft })), 15);

// --- CB path ---
const cb = await runCbInstantMeasure(sb, userId, { workspace_id: "b5250a64-f8dd-4254-9dc3-9a544fdeef35", address: "parity test", lat, lng });

console.log(JSON.stringify({
  gc: { squares: gcTotals.squares, total_area_sqft: gcTotals.slopedTotal, plan_area_sqft: gcTotals.planTotal, pitch: gcTotals.predominantPitch, facets: segs.length, fp: gc.body.footprint_source, cal: gc.body.calibration },
  cb: (cb as any).ok ? { squares: (cb as any).measurement.total_squares, total_area_sqft: (cb as any).measurement.total_area_sqft, plan_area_sqft: (cb as any).measurement.plan_area_sqft, pitch: (cb as any).measurement.pitch, facets: (cb as any).measurement.facets, lf: { ridge:(cb as any).measurement.ridge_lf, hip:(cb as any).measurement.hip_lf, valley:(cb as any).measurement.valley_lf, rake:(cb as any).measurement.rake_lf, eave:(cb as any).measurement.eave_lf } } : cb,
}, null, 1));
