import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, Ruler, Search, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbButton, CbLoading } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { CB_LEAD_STAGES, cbStageOf, type CbLeadRow, type CbLeadStage } from "@/lib/cbLeads";

export const Route = createFileRoute("/cb/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Claim Buddy" },
      {
        name: "description",
        content:
          "Track every lead from first knock to signed contract. Filter by stage, search any detail, and open the full file.",
      },
      { property: "og:title", content: "Leads — Claim Buddy" },
      { property: "og:description", content: "Every lead, every stage, one screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbLeadsPage,
});

type SortMode = "recent" | "value" | "stage";

function CbLeadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, loading: sessionLoading } = useCbSession();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<CbLeadStage | "all">("all");
  const [sort, setSort] = useState<SortMode>("recent");

  /* Same key shape the dashboard uses, different suffix so neither
     invalidates the other by accident. */
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["cb-leads", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async (): Promise<CbLeadRow[]> => {
      const { data, error } = await supabase
        .from("cb_jobs")
        .select(
          "id, address, city, state, zip, customer_name, customer_phone, customer_email, status, carrier, claim_number, date_of_loss, deductible, updated_at, created_at",
        )
        .eq("workspace_id", workspace!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CbLeadRow[];
    },
  });

  const ids = useMemo(() => jobs.map((j) => j.id), [jobs]);

  /* Photo counts, one query for the whole list rather than one per card. */
  const { data: photoCounts = {} } = useQuery({
    queryKey: ["cb-leads-photos", workspace?.id, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_photos").select("job_id").in("job_id", ids);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, r) => {
        const k = (r as { job_id: string }).job_id;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    },
  });

  /* Squares off the takeoff, so a card can say whether the roof is measured. */
  const { data: measured = {} } = useQuery({
    queryKey: ["cb-leads-measure", workspace?.id, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_measurements")
        .select("job_id, total_squares")
        .in("job_id", ids);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, r) => {
        const row = r as { job_id: string; total_squares: number | null };
        if (row.total_squares) acc[row.job_id] = Number(row.total_squares);
        return acc;
      }, {});
    },
  });

  /* Estimate totals, so the pipeline shows money and sorting by value works. */
  const { data: totals = {} } = useQuery({
    queryKey: ["cb-leads-totals", workspace?.id, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("cb_job_id, total")
        .in("cb_job_id", ids);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, r) => {
        const row = r as { cb_job_id: string | null; total: number | null };
        if (row.cb_job_id && row.total) acc[row.cb_job_id] = Number(row.total);
        return acc;
      }, {});
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    CB_LEAD_STAGES.forEach((s) => {
      c[s.value] = jobs.filter((j) => j.status === s.value).length;
    });
    return c;
  }, [jobs]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = jobs.filter((j) => {
      if (stage !== "all" && j.status !== stage) return false;
      if (!term) return true;
      return [
        j.address,
        j.customer_name,
        j.customer_phone,
        j.customer_email,
        j.city,
        j.state,
        j.zip,
        j.carrier,
        j.claim_number,
        cbStageOf(j.status).label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    if (sort === "value") {
      out = [...out].sort((a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0));
    } else if (sort === "stage") {
      const order = CB_LEAD_STAGES.map((s) => s.value);
      out = [...out].sort(
        (a, b) => order.indexOf(a.status as CbLeadStage) - order.indexOf(b.status as CbLeadStage),
      );
    }
    return out;
  }, [jobs, q, stage, sort, totals]);

  if (sessionLoading || !user) {
    return (
      <CbSurface>
        <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
          <CbLoading label="Loading leads…" />
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[900px] px-4 pb-28 pt-5 sm:px-5">
          <header className="mb-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">Leads</h1>
              <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                Every job in the pipeline, newest first.
              </p>
            </div>
            <CbButton variant="ghost" size="md" onClick={() => navigate({ to: "/cb" })}>
              Dashboard
            </CbButton>
          </header>

          {/* Stage strip — the counts double as the filter. */}
          <div
            className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            role="group"
            aria-label="Filter by stage"
          >
            {[
              {
                value: "all" as const,
                label: "All leads",
                sub: "in the pipeline",
                color: "var(--cb-accent)",
              },
              ...CB_LEAD_STAGES,
            ].map((s) => {
              const active = stage === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStage(s.value as CbLeadStage | "all")}
                  className="min-w-[112px] shrink-0 rounded-[14px] border px-3 py-2.5 text-left"
                  style={{
                    background: "var(--cb-surface)",
                    borderColor: active ? s.color : "var(--cb-border)",
                    boxShadow: active ? `0 0 0 1px ${s.color}` : "var(--cb-shadow-card)",
                  }}
                >
                  <span
                    className="block text-[10.5px] font-bold uppercase tracking-[.09em]"
                    style={{ color: "var(--cb-text-muted)" }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="mt-0.5 block font-mono text-[21px] font-bold leading-none"
                    style={{ color: active ? s.color : "var(--cb-text)" }}
                  >
                    {counts[s.value] ?? 0}
                  </span>
                  <span
                    className="mt-1 block text-[11px]"
                    style={{ color: "var(--cb-text-muted)" }}
                  >
                    {"sub" in s ? s.sub : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <label
            className="mb-2 flex h-[46px] items-center gap-2.5 rounded-[14px] border px-3"
            style={{ background: "var(--cb-surface)", borderColor: "var(--cb-border)" }}
          >
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              type="search"
              className="h-full w-full bg-transparent text-[15px] outline-none"
              placeholder="Name, address, carrier, claim #, city…"
              aria-label="Search leads"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="mb-3 flex items-center gap-2">
            <span className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {rows.length} of {jobs.length} lead{jobs.length === 1 ? "" : "s"}
              {stage === "all" ? "" : ` · ${cbStageOf(stage).label}`}
            </span>
            <div
              className="ml-auto inline-flex gap-0.5 rounded-full p-[3px]"
              style={{ background: "var(--cb-bg-hover, rgba(0,0,0,.05))" }}
              role="group"
              aria-label="Sort leads"
            >
              {(["recent", "value", "stage"] as SortMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={sort === m}
                  onClick={() => setSort(m)}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold capitalize"
                  style={
                    sort === m
                      ? { background: "var(--cb-surface)", color: "var(--cb-text)" }
                      : { color: "var(--cb-text-muted)" }
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <CbLoading label="Loading leads…" />
          ) : rows.length === 0 ? (
            <div
              className="rounded-[18px] border border-dashed px-6 py-12 text-center text-sm"
              style={{ borderColor: "var(--cb-border)", color: "var(--cb-text-muted)" }}
            >
              {jobs.length === 0
                ? "No leads yet. Start an inspection and it lands here."
                : "No leads match that."}
              {jobs.length > 0 ? (
                <div className="mt-3">
                  <CbButton
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setQ("");
                      setStage("all");
                    }}
                  >
                    Clear filters
                  </CbButton>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {rows.map((j) => {
                const s = cbStageOf(j.status);
                const total = totals[j.id] ?? 0;
                const sq = measured[j.id] ?? 0;
                return (
                  <CbReveal key={j.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/cb/lead/$id", params: { id: j.id } })}
                      className="relative w-full overflow-hidden rounded-[18px] border p-3.5 pl-5 text-left"
                      style={{
                        background: "var(--cb-surface)",
                        borderColor: "var(--cb-border)",
                        boxShadow: "var(--cb-shadow-card)",
                      }}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-[3px]"
                        style={{ background: s.color }}
                        aria-hidden="true"
                      />
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[16px] font-bold leading-tight">
                            {j.address || "No address yet"}
                          </div>
                          <div
                            className="mt-0.5 truncate text-[13px]"
                            style={{ color: "var(--cb-text-muted)" }}
                          >
                            {[j.customer_name, [j.city, j.state].filter(Boolean).join(", ")]
                              .filter(Boolean)
                              .join(" · ") || "No customer yet"}
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-40" />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                          style={{
                            color: s.color,
                            background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                            borderColor: `color-mix(in srgb, ${s.color} 34%, transparent)`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "currentColor" }}
                          />
                          {s.label}
                        </span>
                        {j.carrier ? (
                          <span className="text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
                            {j.carrier}
                          </span>
                        ) : null}
                        {j.claim_number ? (
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: "var(--cb-text-muted)" }}
                          >
                            {j.claim_number}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className="mt-2.5 flex flex-wrap items-center gap-3 border-t pt-2.5"
                        style={{ borderColor: "var(--cb-border)" }}
                      >
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px]"
                          style={{ color: "var(--cb-text-muted)" }}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <b className="font-mono">{photoCounts[j.id] ?? 0}</b>
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px]"
                          style={{ color: "var(--cb-text-muted)" }}
                        >
                          <Ruler className="h-3.5 w-3.5" />
                          {sq ? <b className="font-mono">{sq.toFixed(1)} SQ</b> : "not measured"}
                        </span>
                        <span
                          className="ml-auto font-mono text-[15px] font-bold"
                          style={{ color: total ? "var(--cb-text)" : "var(--cb-text-muted)" }}
                        >
                          {total ? `$${Math.round(total).toLocaleString()}` : "No estimate"}
                        </span>
                      </div>
                    </button>
                  </CbReveal>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <CbButton variant="ghost" size="md" onClick={() => navigate({ to: "/cb/map" })}>
              <Settings2 className="mr-1.5 h-4 w-4" /> Door to Door map
            </CbButton>
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
