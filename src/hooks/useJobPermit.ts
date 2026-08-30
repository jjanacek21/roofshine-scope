import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  jobPermitDocuments,
  jobPermits,
  type JobPermit,
  type JobPermitDocument,
} from "@/lib/permits/db";
import { buildPermitContext, type PermitContext } from "@/lib/permits/context";
import { buildPacketState, type PacketState } from "@/lib/permits/checklist";
import type { PermitDepartment } from "@/lib/permits/db";
import { loadDepartments, matchJurisdiction } from "@/lib/permits/jurisdiction";

/**
 * The permit tab's data.
 *
 * A permit row is created lazily — opening the tab on a job that will never
 * need one should not litter the table. The first time it is created we also
 * try to work out the jurisdiction from the property, because that is the one
 * field everything else depends on and the address already answers it.
 */
export function useJobPermit(jobId: string) {
  const [permit, setPermit] = useState<JobPermit | null>(null);
  const [context, setContext] = useState<PermitContext | null>(null);
  const [packet, setPacket] = useState<PacketState | null>(null);
  const [documents, setDocuments] = useState<JobPermitDocument[]>([]);
  const [departments, setDepartments] = useState<PermitDepartment[]>([]);
  const [suggestion, setSuggestion] = useState<ReturnType<typeof matchJurisdiction>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const depts = await loadDepartments();
      setDepartments(depts);

      const { data: existing } = await jobPermits().select("*").eq("job_id", jobId).maybeSingle();
      let row = (existing ?? null) as JobPermit | null;

      /* Suggest a jurisdiction from the property whether or not a permit exists,
         so the UI can offer it when the field is still blank. */
      const { data: job } = await supabase
        .from("jobs")
        .select("company_id, property_id, jurisdiction")
        .eq("id", jobId)
        .maybeSingle();
      const j = job as unknown as Record<string, unknown> | null;

      let guess: ReturnType<typeof matchJurisdiction> = null;
      if (j?.property_id) {
        const { data: prop } = await supabase
          .from("properties")
          .select("city, state, zip")
          .eq("id", j.property_id as string)
          .maybeSingle();
        const p = prop as unknown as Record<string, unknown> | null;
        if (p) {
          guess = matchJurisdiction(depts, {
            city: p.city as string,
            zip: p.zip as string,
            county: (j.jurisdiction as string) ?? null,
          });
        }
      }
      setSuggestion(guess);
      setPermit(row);

      let docs: JobPermitDocument[] = [];
      if (row) {
        const { data: d } = await jobPermitDocuments()
          .select("*")
          .eq("permit_id", row.id)
          .order("created_at", { ascending: false });
        docs = (d ?? []) as JobPermitDocument[];
      }
      setDocuments(docs);

      const ctx = await buildPermitContext(jobId);
      setContext(ctx);
      setPacket(await buildPacketState(ctx, docs));
    } catch (e) {
      console.error("permit load failed", e);
      setError(e instanceof Error ? e.message : "Could not load the permit");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Create the permit row on first real interaction, not on page view. */
  const ensurePermit = useCallback(async (): Promise<JobPermit> => {
    if (permit) return permit;
    const { data: job } = await supabase
      .from("jobs")
      .select("company_id")
      .eq("id", jobId)
      .maybeSingle();
    const companyId = (job as unknown as { company_id?: string } | null)?.company_id;
    if (!companyId) throw new Error("This job has no company.");

    const { data, error: insErr } = await jobPermits()
      .insert({
        job_id: jobId,
        company_id: companyId,
        building_dept_id: suggestion?.confident ? suggestion.department.id : null,
      })
      .select("*");
    if (insErr) throw insErr;
    const row = (data ?? [])[0] as JobPermit;
    setPermit(row);
    return row;
  }, [permit, jobId, suggestion]);

  const savePermit = useCallback(
    async (patch: Partial<JobPermit>) => {
      const row = await ensurePermit();
      const { error: updErr } = await jobPermits().update(patch).eq("id", row.id);
      if (updErr) throw updErr;
      await load();
    },
    [ensurePermit, load],
  );

  return {
    permit,
    context,
    packet,
    documents,
    departments,
    suggestion,
    loading,
    error,
    reload: load,
    ensurePermit,
    savePermit,
  };
}
