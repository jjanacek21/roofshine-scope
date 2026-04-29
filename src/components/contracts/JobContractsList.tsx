import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { ExternalLink, Mail, FileText } from "lucide-react";

type ContractRow = {
  id: string;
  document_id: string;
  contract_type: "residential" | "insurance";
  customer_name: string | null;
  customer_email: string | null;
  signed_at: string | null;
  pdf_url: string | null;
  rep_user_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant_users?: any;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function JobContractsList({ jobId }: { jobId: string }) {
  const { data: tenantData } = useTenant();
  const accent = tenantData?.tenant?.accent_color ?? "#C9A227";

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["job-contracts", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, document_id, contract_type, customer_name, customer_email, signed_at, pdf_url, rep_user_id, tenant_users(rep_name)")
        .eq("job_id", jobId)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractRow[];
    },
  });

  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Contracts
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded bg-[var(--bg-elevated)]" />
          <div className="h-12 animate-pulse rounded bg-[var(--bg-elevated)]" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">
            No contracts yet. Open the Contract tab above to sign one.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contracts.map((c) => {
            const repName = c.tenant_users?.rep_name ?? "—";
            const isResidential = c.contract_type === "residential";
            return (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num text-[12px] text-foreground">
                      {c.document_id}
                    </span>
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={
                        isResidential
                          ? { background: accent, color: "#1a1300" }
                          : {
                              background: "var(--bg-card)",
                              color: "var(--text-dim)",
                              border: "1px solid var(--border)",
                            }
                      }
                    >
                      {isResidential ? "Construction" : "Insurance Contingency"}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {c.customer_name ?? "—"} · {fmtDate(c.signed_at)} · {repName}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {c.pdf_url && (
                    <a
                      href={c.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
                    >
                      <ExternalLink className="h-3 w-3" strokeWidth={2.4} />
                      View PDF
                    </a>
                  )}
                  {c.customer_email && c.pdf_url && (
                    <a
                      href={`mailto:${c.customer_email}?subject=${encodeURIComponent(
                        "Your signed contract",
                      )}&body=${encodeURIComponent(
                        `Your signed contract is available here:\n\n${c.pdf_url}`,
                      )}`}
                      className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
                    >
                      <Mail className="h-3 w-3" strokeWidth={2.4} />
                      Email
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
