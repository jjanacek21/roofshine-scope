import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Claim Buddy instant measurement.
 * Thin wrapper over the EXISTING GlobalContractor roof engine
 * (runAutoMeasureForProperty -> roof_measurements / roof_sections).
 * No new geometry code, no new aerial provider.
 */
export const cbInstantMeasureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { workspace_id: string; address: string; lat: number; lng: number }) => input,
  )
  .handler(async ({ data, context }) => {
    // Membership check runs as the caller (RLS scoped).
    const { data: ws } = await context.supabase
      .from("cb_workspaces")
      .select("id, gc_company_id")
      .eq("id", data.workspace_id)
      .maybeSingle();
    if (!ws) return { ok: false as const, reason: "no_workspace" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAutoMeasureForProperty } = await import("@/lib/auto-measure.functions");

    let companyId = ws.gc_company_id as string | null;
    if (!companyId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("id", context.userId)
        .maybeSingle();
      companyId = (profile?.company_id as string | null) ?? null;
    }
    if (!companyId) return { ok: false as const, reason: "no_company" };

    // Reuse a nearby property row for this company, otherwise create one.
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    const d = 0.00015;
    const { data: near } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("company_id", companyId)
      .gte("lat", lat - d)
      .lte("lat", lat + d)
      .gte("lng", lng - d)
      .lte("lng", lng + d)
      .limit(1);

    let propertyId = near?.[0]?.id as string | undefined;
    if (!propertyId) {
      const { data: created, error } = await supabaseAdmin
        .from("properties")
        .insert({
          company_id: companyId,
          address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          lat,
          lng,
        })
        .select("id")
        .single();
      if (error || !created) return { ok: false as const, reason: "property_failed" };
      propertyId = created.id;
    }

    const run = await runAutoMeasureForProperty(supabaseAdmin, context.userId, propertyId, companyId, {
      single: true,
      force: true,
    });
    if (!run.ok) return { ok: false as const, reason: run.reason };

    const { data: m } = await supabaseAdmin
      .from("roof_measurements")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!m) return { ok: false as const, reason: "no_measurement" };

    const { count: facetCount } = await supabaseAdmin
      .from("roof_sections")
      .select("id", { count: "exact", head: true })
      .eq("measurement_id", m.id);

    return {
      ok: true as const,
      property_id: propertyId,
      measurement: {
        total_squares: Number(m.squares ?? 0),
        total_area_sqft: Number(m.total_area_sqft ?? 0),
        waste_pct: Number(m.waste_pct ?? 15),
        pitch: (m.predominant_pitch as string | null) ?? null,
        stories: null as number | null,
        facets: facetCount ?? run.facets ?? null,
        ridge_lf: Number(m.ridges_lf ?? 0),
        hip_lf: Number(m.hips_lf ?? 0),
        valley_lf: Number(m.valleys_lf ?? 0),
        rake_lf: Number(m.rakes_lf ?? 0),
        eave_lf: Number(m.eaves_lf ?? 0),
        drip_edge_lf: Number(m.drip_edge_lf ?? 0) || Number(m.eaves_lf ?? 0) + Number(m.rakes_lf ?? 0),
        starter_lf: Number(m.eaves_lf ?? 0),
        ridge_cap_lf: Number(m.ridges_lf ?? 0) + Number(m.hips_lf ?? 0),
        wall_flashing_lf: Number(m.wall_flashing_lf ?? 0),
        step_flashing_lf: Number(m.step_flashing_lf ?? 0),
        gutter_lf: Number(m.gutters_lf ?? 0) || Number(m.eaves_lf ?? 0),
        source: (m.source as string) ?? "google_solar",
      },
    };
  });
