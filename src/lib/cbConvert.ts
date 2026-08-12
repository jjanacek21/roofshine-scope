/**
 * Claim Buddy → GlobalContractor conversion.
 *
 * Visibility is never guessed client-side: `cb_can_convert` is the single
 * source of truth. The push itself is one server-side transaction
 * (`cb_convert_to_job`) and is idempotent.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CbConvertReason =
  | "no_globalcontractor_account"
  | "already_converted"
  | "no_access_to_job"
  | null;

export interface CbCanConvert {
  can_convert: boolean;
  reason: CbConvertReason;
  gc_company_id: string | null;
  gc_company_name: string | null;
  gc_job_id: string | null;
}

export interface CbConvertResult {
  gc_job_id: string;
  gc_client_id: string | null;
  gc_property_id: string | null;
  roof_measurement_id: string | null;
  photos_linked: number;
  already?: boolean;
}

export function cbCanConvertKey(jobId: string) {
  return ["cb-can-convert", jobId] as const;
}

/** Ask the backend whether this inspection can be pushed into GlobalContractor. */
export function useCbCanConvert(jobId: string | undefined) {
  return useQuery({
    queryKey: cbCanConvertKey(jobId ?? ""),
    enabled: !!jobId,
    staleTime: 30_000,
    queryFn: async (): Promise<CbCanConvert> => {
      const { data, error } = await supabase.rpc("cb_can_convert", { _job: jobId! });
      if (error) throw error;
      return data as unknown as CbCanConvert;
    },
  });
}

export interface CbConvertSummary {
  customerName: string | null;
  address: string | null;
  carrier: string | null;
  claimNumber: string | null;
  dateOfLoss: string | null;
  lineItemCount: number;
  hasMeasurement: boolean;
  squares: number | null;
  photoCount: number;
  hasSignedContract: boolean;
  hasReportPdf: boolean;
}

/** Everything the confirm sheet lists out before the push. */
export function useCbConvertSummary(jobId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["cb-convert-summary", jobId],
    enabled: !!jobId && enabled,
    queryFn: async (): Promise<CbConvertSummary> => {
      const [job, report, measurement, photos, contract] = await Promise.all([
        supabase
          .from("cb_jobs")
          .select("customer_name, address, city, state, zip, carrier, claim_number, date_of_loss")
          .eq("id", jobId!)
          .maybeSingle(),
        supabase
          .from("cb_reports")
          .select("line_items, pdf_path")
          .eq("job_id", jobId!)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("cb_measurements").select("total_squares").eq("job_id", jobId!).maybeSingle(),
        supabase.from("cb_photos").select("id", { count: "exact", head: true }).eq("job_id", jobId!),
        supabase
          .from("cb_contracts")
          .select("signed_at")
          .eq("job_id", jobId!)
          .not("signed_at", "is", null)
          .limit(1)
          .maybeSingle(),
      ]);

      const j = job.data;
      const fullAddress = j
        ? [j.address, [j.city, j.state].filter(Boolean).join(", "), j.zip].filter(Boolean).join(" ")
        : null;
      const items = Array.isArray(report.data?.line_items) ? report.data!.line_items : [];

      return {
        customerName: j?.customer_name ?? null,
        address: fullAddress || null,
        carrier: j?.carrier ?? null,
        claimNumber: j?.claim_number ?? null,
        dateOfLoss: j?.date_of_loss ?? null,
        lineItemCount: items.length,
        hasMeasurement: !!measurement.data,
        squares: measurement.data?.total_squares != null ? Number(measurement.data.total_squares) : null,
        photoCount: photos.count ?? 0,
        hasSignedContract: !!contract.data,
        hasReportPdf: !!report.data?.pdf_path,
      };
    },
  });
}

/** One transaction, server-side. Never replicate any of it in the client. */
export async function cbConvertToJob(jobId: string): Promise<CbConvertResult> {
  const { data, error } = await supabase.rpc("cb_convert_to_job", { _job: jobId });
  if (error) throw error;
  return data as unknown as CbConvertResult;
}
