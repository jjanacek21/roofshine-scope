import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { readDelivery, type LeadReportRow, type ReportDelivery } from "@/lib/leads/report-delivery";

export type ReportWithLead = LeadReportRow & {
  delivery: ReportDelivery | null;
  address: string;
  city: string | null;
  owner: string | null;
  status: string;
};

/**
 * Every report this company has produced, newest first, with the property it
 * belongs to attached.
 *
 * The lead lookup is a second query rather than an embedded select: there is no
 * declared foreign key between `lead_reports` and `leads` in the generated
 * types, so PostgREST cannot embed one in the other.
 */
export function useCompanyReports() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;

  return useQuery({
    queryKey: ["company-reports", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<ReportWithLead[]> => {
      const { data: reports, error } = await supabase
        .from("lead_reports")
        .select("id, lead_id, company_id, kind, name, pdf_path, created_at, inputs")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows = (reports ?? []) as LeadReportRow[];
      const leadIds = Array.from(new Set(rows.map((r) => r.lead_id)));
      if (leadIds.length === 0) return [];

      const byLead = new Map<
        string,
        { address: string; city: string | null; owner: string | null; status: string }
      >();
      const CHUNK = 200;
      for (let i = 0; i < leadIds.length; i += CHUNK) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, address, city, owner, status")
          .in("id", leadIds.slice(i, i + CHUNK));
        for (const l of leads ?? []) {
          byLead.set(l.id, {
            address: l.address,
            city: l.city,
            owner: l.owner,
            status: l.status as string,
          });
        }
      }

      return rows.map((r) => {
        const lead = byLead.get(r.lead_id);
        return {
          ...r,
          delivery: readDelivery(r.inputs),
          address: lead?.address ?? "—",
          city: lead?.city ?? null,
          owner: lead?.owner ?? null,
          status: lead?.status ?? "",
        };
      });
    },
  });
}
