import { supabase } from "@/integrations/supabase/client";
import { fileJobDocument } from "@/lib/jobDocuments";

/**
 * Turning a Claim Buddy inspection into a CRM job.
 *
 * Claim Buddy and the CRM share one database — `cb_jobs` sits beside `jobs`,
 * `cb_measurements` beside `roof_measurements`. So this is not an integration
 * across a wire; it is a mapping, in one place, inside one transaction's worth
 * of writes. `cb_jobs` already carries `gc_job_id`, `converted_at` and
 * `converted_by`, and `cb_measurements` carries `gc_roof_measurement_id`,
 * which is how the schema says this conversion was always meant to exist.
 *
 * It is deliberately idempotent. Pressing the button twice on a slow connection
 * should not produce two jobs for one roof.
 */

export interface ConvertResult {
  jobId: string;
  created: boolean;
  clientId: string;
  propertyId: string;
  measurementCopied: boolean;
  photosCopied: number;
  photosFailed: number;
  reportFiled: boolean;
}

interface CbJob {
  id: string;
  company_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  carrier: string | null;
  claim_number: string | null;
  gc_job_id: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** The one-line address the CRM shows on a job. */
function fullAddress(j: CbJob): string {
  return [j.address, [j.city, j.state].filter(Boolean).join(", "), j.zip].filter(Boolean).join(" ").trim();
}

/**
 * Convert, or return the job this inspection already became.
 *
 * `onProgress` exists because copying photos is the slow part and the user is
 * watching a button, not a log.
 */
export async function convertCbJobToCrm(
  cbJobId: string,
  onProgress?: (s: string) => void,
): Promise<ConvertResult> {
  onProgress?.("Reading the inspection…");
  const { data: cb, error: cbErr } = await supabase
    .from("cb_jobs")
    .select(
      "id, company_id, customer_name, customer_phone, customer_email, address, city, state, zip, county, lat, lng, carrier, claim_number, gc_job_id",
    )
    .eq("id", cbJobId)
    .maybeSingle();
  if (cbErr) throw cbErr;
  if (!cb) throw new Error("That inspection could not be found.");
  const job = cb as unknown as CbJob;

  if (!job.company_id) {
    throw new Error("This inspection is not attached to a company, so it cannot become a job.");
  }

  // Already converted — hand back what it became rather than making a second.
  if (job.gc_job_id) {
    const { data: existing } = await supabase
      .from("jobs")
      .select("id, client_id, property_id")
      .eq("id", job.gc_job_id)
      .maybeSingle();
    if (existing) {
      const e = existing as { id: string; client_id: string | null; property_id: string | null };
      return {
        jobId: e.id,
        created: false,
        clientId: e.client_id ?? "",
        propertyId: e.property_id ?? "",
        measurementCopied: false,
        photosCopied: 0,
        photosFailed: 0,
        reportFiled: false,
      };
    }
    // The row it pointed at is gone; fall through and make a fresh one.
  }

  const companyId = job.company_id;
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id ?? null;

  /* ── the customer ── */
  onProgress?.("Matching the customer…");
  let clientId: string | null = null;
  if (job.customer_name) {
    const { data: candidates } = await supabase
      .from("clients")
      .select("id, name, phone")
      .eq("company_id", companyId)
      .ilike("name", job.customer_name.trim());
    // Same name AND same phone is the same person; same name alone is not.
    const hit = (candidates ?? []).find(
      (c) =>
        norm((c as { name?: string }).name) === norm(job.customer_name) &&
        (!job.customer_phone ||
          !(c as { phone?: string }).phone ||
          norm((c as { phone?: string }).phone).replace(/\D/g, "") ===
            norm(job.customer_phone).replace(/\D/g, "")),
    ) as { id: string } | undefined;
    clientId = hit?.id ?? null;
  }
  if (!clientId) {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        company_id: companyId,
        name: job.customer_name || "Customer",
        phone: job.customer_phone,
        email: job.customer_email,
        address: fullAddress(job) || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    clientId = (created as { id: string }).id;
  }

  /* ── the property ── */
  onProgress?.("Matching the property…");
  let propertyId: string | null = null;
  if (job.address) {
    const { data: props } = await supabase
      .from("properties")
      .select("id, address")
      .eq("company_id", companyId)
      .ilike("address", job.address.trim());
    const hit = (props ?? []).find(
      (p) => norm((p as { address?: string }).address) === norm(job.address),
    ) as { id: string } | undefined;
    propertyId = hit?.id ?? null;
  }
  if (!propertyId) {
    const { data: created, error } = await supabase
      .from("properties")
      .insert({
        company_id: companyId,
        client_id: clientId,
        address: job.address,
        city: job.city,
        state: job.state,
        zip: job.zip,
        lat: job.lat,
        lng: job.lng,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    propertyId = (created as { id: string }).id;
  }

  /* ── the job ── */
  onProgress?.("Creating the job…");
  const { data: newJob, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      company_id: companyId,
      client_id: clientId,
      property_id: propertyId,
      name: job.customer_name || fullAddress(job) || "New job",
      property_address: fullAddress(job) || null,
      status: "new",
      job_type: job.claim_number ? "insurance" : "retail",
      claim_number: job.claim_number,
      insurance_carrier: job.carrier,
      jurisdiction: job.county,
      created_by: uid,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select("id")
    .single();
  if (jobErr) throw jobErr;
  const jobId = (newJob as { id: string }).id;

  /* ── the measurement ──
     One measurement per property, so this upserts rather than inserts. Claim
     Buddy names its columns differently, hence the explicit mapping. */
  onProgress?.("Copying the measurement…");
  let measurementCopied = false;
  const { data: cbm } = await supabase
    .from("cb_measurements")
    .select(
      "id, total_squares, total_area_sqft, waste_pct, pitch, ridge_lf, hip_lf, valley_lf, rake_lf, eave_lf, drip_edge_lf, gutter_lf, wall_flashing_lf, step_flashing_lf",
    )
    .eq("job_id", cbJobId)
    .maybeSingle();
  if (cbm) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = cbm as any;
    const { data: savedM, error: mErr } = await supabase
      .from("roof_measurements")
      .upsert(
        {
          property_id: propertyId,
          company_id: companyId,
          source: "claim_buddy",
          squares: m.total_squares,
          total_area_sqft: m.total_area_sqft,
          waste_pct: m.waste_pct,
          predominant_pitch: m.pitch,
          ridges_lf: m.ridge_lf,
          hips_lf: m.hip_lf,
          valleys_lf: m.valley_lf,
          rakes_lf: m.rake_lf,
          eaves_lf: m.eave_lf,
          drip_edge_lf: m.drip_edge_lf,
          gutters_lf: m.gutter_lf,
          wall_flashing_lf: m.wall_flashing_lf,
          step_flashing_lf: m.step_flashing_lf,
          created_by: uid,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        { onConflict: "property_id" },
      )
      .select("id")
      .maybeSingle();
    if (!mErr && savedM) {
      measurementCopied = true;
      await supabase
        .from("cb_measurements")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ gc_roof_measurement_id: (savedM as { id: string }).id } as any)
        .eq("id", m.id);
    } else if (mErr) {
      console.warn("measurement could not be copied across", mErr);
    }
  }

  /* ── the photos ──
     Two different buckets, so the bytes have to move. Bounded, because a job
     with two hundred photos should not hold the button hostage. */
  const { data: cbPhotos } = await supabase
    .from("cb_photos")
    .select("id, storage_path, caption, category, taken_at, sort_order")
    .eq("job_id", cbJobId)
    .order("sort_order")
    .limit(120);

  let photosCopied = 0;
  let photosFailed = 0;
  const photos = (cbPhotos ?? []) as {
    id: string;
    storage_path: string;
    caption: string | null;
    category: string | null;
    taken_at: string | null;
  }[];

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    onProgress?.(`Copying photo ${i + 1} of ${photos.length}…`);
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from("cb-photos").download(p.storage_path);
      if (dlErr || !blob) throw dlErr ?? new Error("no file");
      const name = p.storage_path.split("/").pop() ?? `${p.id}.jpg`;
      const dest = `${companyId}/${jobId}/${Date.now()}-${name}`;
      const { error: upErr } = await supabase.storage
        .from("roof-photos")
        .upload(dest, blob, { contentType: blob.type || "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("job_photos").insert({
        job_id: jobId,
        company_id: companyId,
        uploaded_by: uid,
        storage_path: dest,
        caption: p.caption,
        tag: p.category,
        taken_at: p.taken_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (rowErr) throw rowErr;
      photosCopied += 1;
    } catch (e) {
      photosFailed += 1;
      console.warn("a photo could not be copied across", e);
    }
  }

  /* ── the report ──
     The Claim Buddy PDF is filed into the job's Documents tab in place rather
     than copied, so there is one report rather than two that can drift. */
  onProgress?.("Filing the report…");
  let reportFiled = false;
  const { data: cbReport } = await supabase
    .from("cb_reports")
    .select("id, pdf_path, version")
    .eq("job_id", cbJobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rep = cbReport as { id: string; pdf_path: string | null; version: number | null } | null;
  if (rep?.pdf_path) {
    reportFiled = await fileJobDocument({
      jobId,
      companyId,
      kind: "completed_report",
      title: `Claim Buddy report${rep.version ? ` v${rep.version}` : ""}`,
      bucket: "cb-documents",
      storagePath: rep.pdf_path,
      mimeType: "application/pdf",
      sourceTable: "cb_reports",
      sourceId: rep.id,
    });
  }

  /* ── mark it converted ── */
  await supabase
    .from("cb_jobs")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ gc_job_id: jobId, converted_at: new Date().toISOString(), converted_by: uid } as any)
    .eq("id", cbJobId);

  return {
    jobId,
    created: true,
    clientId: clientId!,
    propertyId: propertyId!,
    measurementCopied,
    photosCopied,
    photosFailed,
    reportFiled,
  };
}
