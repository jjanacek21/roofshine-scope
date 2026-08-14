import type { SupabaseClient } from "@supabase/supabase-js";
import { polygonAreaSqft } from "@/lib/roof-math";

type CbPlanSection = {
  name: string;
  ring: number[][];
  pitch: string;
  structureKey: string;
  pin: { lat: number; lng: number } | null;
  aiRing: number[][] | null;
};

function closeRing(ring: number[][]): number[][] {
  if (!ring.length) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export async function saveCbRoofCorrection(
  supabase: SupabaseClient,
  userId: string,
  data: { jobId: string; section: CbPlanSection },
) {
  const { data: job } = await supabase
    .from("cb_jobs")
    .select("id, workspace_id, address, lat, lng")
    .eq("id", data.jobId)
    .maybeSingle();
  if (!job) throw new Error("Job not found");

  const { data: workspace } = await supabase
    .from("cb_workspaces")
    .select("gc_company_id")
    .eq("id", job.workspace_id)
    .maybeSingle();
  const { data: measurementId } = await supabase.rpc("cb_ensure_roof_measurement", {
    _job: data.jobId,
  });
  if (!measurementId) throw new Error("Roof measurement not found");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: measurement } = await supabaseAdmin
    .from("roof_measurements")
    .select("property_id, company_id")
    .eq("id", measurementId as string)
    .maybeSingle();
  if (!measurement?.property_id) throw new Error("Property not found");

  const section = data.section;
  const pin = section.pin ?? { lat: Number(job.lat), lng: Number(job.lng) };
  if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) {
    throw new Error("Structure pin is missing");
  }
  const correctedArea = Math.round(polygonAreaSqft(closeRing(section.ring)));
  const aiRing = section.aiRing?.length ? section.aiRing : section.ring;
  const aiArea = Math.round(polygonAreaSqft(closeRing(aiRing)));
  const correctedFacet = [{
    ring: closeRing(section.ring),
    pitch: section.pitch,
    pitch_degrees: 0,
    plan_area_sqft: correctedArea,
  }];
  const aiFacet = [{
    ring: closeRing(aiRing),
    pitch: section.pitch,
    pitch_degrees: 0,
    plan_area_sqft: aiArea,
  }];
  const companyId = measurement.company_id ?? workspace?.gc_company_id ?? null;

  const row = {
    company_id: companyId,
    property_id: measurement.property_id,
    job_id: data.jobId,
    structure_key: section.structureKey,
    lat: pin.lat,
    lng: pin.lng,
    pin_name: section.name,
    pitch: section.pitch,
    kind: section.name.toLowerCase().replaceAll(" ", "_"),
    corrected_facets: correctedFacet,
    ai_facets: aiFacet,
    corrected_plan_sqft: correctedArea,
    ai_plan_sqft: aiArea,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("roof_corrections")
    .upsert(row as never, { onConflict: "property_id,structure_key" });
  if (error) throw error;

  const { data: priorExample } = await supabaseAdmin
    .from("training_examples")
    .select("id")
    .eq("source_measurement_id", measurementId as string)
    .eq("source", "vertex_edit")
    .contains("ground_truth", { structure_key: section.structureKey })
    .maybeSingle();
  const example = {
    address: job.address || `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`,
    lat: pin.lat,
    lng: pin.lng,
    source: "vertex_edit",
    source_measurement_id: measurementId as string,
    ground_truth: { structure_key: section.structureKey, facets: correctedFacet },
    solar_response: { structure_key: section.structureKey, ai_facets: aiFacet },
    notes: "Claim Buddy corrected roof footprint",
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  if (priorExample?.id) {
    await supabaseAdmin.from("training_examples").update(example as never).eq("id", priorExample.id);
  } else {
    await supabaseAdmin.from("training_examples").insert(example as never);
  }

  return { ok: true as const };
}