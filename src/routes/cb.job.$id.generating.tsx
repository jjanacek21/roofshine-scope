import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton } from "@/components/cb/primitives";
import { CbHeadline } from "@/components/cb/motion";
import { composeReport, insertReportVersion, loadReportInputs } from "@/lib/cbReport";
import { buildAiInput, guardReport, scopeFromLineItems, CB_EMPTY_AI, type CbAiReport } from "@/lib/cbReportAi";
import { cbWriteReportNarrative } from "@/lib/cb-report-ai.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cb/job/$id/generating")({
  head: () => ({
    meta: [
      { title: "Building the report — Claim Buddy" },
      { name: "description", content: "Reading the takeoff, matching photos to line items and writing the damage report." },
      { property: "og:title", content: "Building the report — Claim Buddy" },
      { property: "og:description", content: "The inspection becomes a carrier-ready damage report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbGeneratingPage,
});

function CbGeneratingPage() {
  const { id } = useParams({ from: "/cb/job/$id/generating" });
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("your company");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const steps = [
    "Reading takeoff…",
    "Assembling roof scope…",
    "Matching photos to line items…",
    "Writing the narrative…",
    `Applying ${company} branding…`,
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      try {
        setStep(0);
        const inputs = await loadReportInputs(id);
        setCompany(String(inputs.company?.name ?? "your company"));
        await wait(650);

        setStep(1);
        const composed = composeReport(inputs);
        await wait(650);

        setStep(2);
        await wait(400);

        setStep(3);
        const { data: auth } = await supabase.auth.getUser();
        const repName =
          (auth.user?.user_metadata?.full_name as string) ?? (auth.user?.email as string) ?? null;
        const aiInput = buildAiInput({
          company: inputs.company,
          job: inputs.job,
          sheet: composed.sheet,
          squares: composed.squares,
          measurement: inputs.measurement,
          vent: composed.vent,
          lineItems: composed.line_items,
          photos: inputs.photos,
          repName,
          hasPricedEstimate: false,
        });

        let ai: CbAiReport;
        try {
          const res = await cbWriteReportNarrative({ data: { input: aiInput } });
          if (!res.ok) throw new Error(res.error);
          ai = res.report;
        } catch (err) {
          /* The takeoff still produces a complete report without the writer. */
          const scope = scopeFromLineItems(composed.line_items);
          ai = guardReport(
            {
              ...CB_EMPTY_AI,
              summary: [composed.narrative.summary],
              roof_scope: scope.roof,
              exterior_scope: scope.exterior,
              interior_note: "Not inspected",
              storm_context: "Not inspected",
              missing: [
                "Narrative could not be written automatically — review and edit the report before sending.",
                err instanceof Error ? err.message : "AI writer unavailable",
              ],
            },
            false,
          );
        }

        setStep(4);
        const report = await insertReportVersion(id, {
          narrative: { ...composed.narrative, ai },
          line_items: composed.line_items,
          ventilation: composed.vent,
        });
        await wait(600);
        setStep(5);
        await wait(250);

        navigate({ to: "/cb/job/$id/report", params: { id }, search: { r: report.id } });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not build the report.");
      }
    })();
  }, [id, navigate]);

  return (
    <CbSurface>
      <div className="flex min-h-screen items-center px-5 py-16" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[520px]">
          <CbHeadline as="h1" text="Building the report" style={{ fontSize: 26 }} />
          <CbCard elevation="floating" className="mt-5" style={{ padding: 24 }}>
            <ul className="grid gap-3">
              {steps.map((label, i) => {
                const done = step > i;
                const active = step === i;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 99,
                        display: "grid",
                        placeItems: "center",
                        background: done ? "var(--cb-accent)" : "var(--cb-border)",
                        color: done ? "#fff" : "var(--cb-text-muted)",
                        transition: "background .25s ease",
                      }}
                    >
                      {done ? <Check size={15} /> : active ? <Loader2 size={14} className="animate-spin" /> : null}
                    </span>
                    <span
                      className="text-[15.5px]"
                      style={{
                        color: done || active ? "var(--cb-text)" : "var(--cb-text-muted)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {error ? (
              <div className="mt-5">
                <p className="text-[14px]" style={{ color: "var(--cb-danger)" }}>
                  {error}
                </p>
                <CbButton className="mt-3" block onClick={() => navigate({ to: "/cb/job/$id/review", params: { id } })}>
                  Back to review
                </CbButton>
              </div>
            ) : null}
          </CbCard>
        </div>
      </div>
    </CbSurface>
  );
}
