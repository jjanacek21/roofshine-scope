import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const convertDispositionToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dispositionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Load the disposition (RLS-scoped to this user)
    const { data: disp, error: dispErr } = await supabase
      .from("property_dispositions")
      .select("*")
      .eq("id", data.dispositionId)
      .single();
    if (dispErr || !disp) throw new Error(dispErr?.message || "Disposition not found");
    if (disp.converted_job_id) {
      return { jobId: disp.converted_job_id, alreadyConverted: true };
    }

    // 2. Get user's company
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();
    if (profErr || !profile?.company_id) {
      throw new Error("You must belong to a company to convert a disposition into a job.");
    }
    const companyId: string = profile.company_id;

    // 3. Collect related notes & photos for transfer summary
    const [{ data: notes }, { data: photos }] = await Promise.all([
      supabase.from("property_notes").select("note, created_at").eq("property_id", disp.id).order("created_at", { ascending: true }),
      supabase.from("property_photos").select("photo_url, caption, photo_type").eq("property_id", disp.id),
    ]);

    const notesBlock: string[] = [];
    notesBlock.push(`Converted from Door-to-Door disposition (${disp.disposition ?? "n/a"}).`);
    if (disp.notes) notesBlock.push(`\nOriginal notes:\n${disp.notes}`);
    if (notes && notes.length) {
      notesBlock.push("\nNote history:");
      for (const n of notes) notesBlock.push(`• [${new Date(n.created_at).toLocaleString()}] ${n.note}`);
    }
    if (photos && photos.length) {
      notesBlock.push(`\nPhotos (${photos.length}):`);
      for (const p of photos) notesBlock.push(`• ${p.photo_type}: ${p.photo_url}${p.caption ? ` — ${p.caption}` : ""}`);
    }
    if (disp.customer_phone) notesBlock.push(`\nPhone: ${disp.customer_phone}`);
    if (disp.customer_email) notesBlock.push(`Email: ${disp.customer_email}`);
    if (disp.roof_type) notesBlock.push(`Roof type: ${disp.roof_type}`);
    if (disp.roof_condition) notesBlock.push(`Roof condition: ${disp.roof_condition}`);
    if (disp.insurance_claim) notesBlock.push(`Insurance claim: yes`);
    if (disp.storm_date) notesBlock.push(`Storm date: ${disp.storm_date}`);
    if (disp.tags && disp.tags.length) notesBlock.push(`Tags: ${disp.tags.join(", ")}`);

    const jobName = disp.customer_name?.trim() || disp.address?.trim() || `D2D Lead ${(disp.lat ?? 0).toFixed(4)}, ${(disp.lng ?? 0).toFixed(4)}`;

    // 4. Insert job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        company_id: companyId,
        name: jobName,
        property_address: disp.address ?? null,
        status: "lead",
        notes: notesBlock.join("\n"),
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message || "Failed to create job");

    // 5. Copy photo references into job_photos (storage_path stores URL for D2D photos)
    if (photos && photos.length) {
      const photoRows = photos.map((p) => ({
        job_id: job.id,
        company_id: companyId,
        uploaded_by: userId,
        storage_path: p.photo_url,
        caption: p.caption ?? null,
        tag: p.photo_type ?? null,
      }));
      await supabase.from("job_photos").insert(photoRows);
    }

    // 6. Mark disposition as converted
    await supabase
      .from("property_dispositions")
      .update({ converted_job_id: job.id, converted_at: new Date().toISOString() })
      .eq("id", disp.id);

    return { jobId: job.id, alreadyConverted: false };
  });
