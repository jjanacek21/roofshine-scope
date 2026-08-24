import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { CbSurface } from "@/components/cb/CbSurface";

export const Route = createFileRoute("/cb/survival-guide")({
  head: () => ({
    meta: [
      { title: "Survival Guide — Claim Buddy" },
      {
        name: "description",
        content:
          "Door-to-door scripts, rebuttals, insurance talk tracks and closes for storm damage reps in the field.",
      },
      { property: "og:title", content: "Survival Guide — Claim Buddy" },
      {
        property: "og:description",
        content: "Scripts, rebuttals and closes for reps knocking storm damage doors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbSurvivalGuidePage,
});

function CbSurvivalGuidePage() {
  const navigate = useNavigate();
  return (
    <CbSurface>
      <div className="mx-auto flex h-[100dvh] w-full max-w-[900px] flex-col px-3 pb-3 pt-3">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to dashboard"
            onClick={() => navigate({ to: "/cb" })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="cb-display truncate" style={{ fontSize: 18, lineHeight: 1.2 }}>
              Survival Guide
            </h1>
            <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Scripts, rebuttals, insurance and closes.
            </p>
          </div>
          <BookOpenText className="h-5 w-5 shrink-0" style={{ color: "var(--cb-text-muted)" }} />
        </div>

        <div
          className="flex-1 overflow-hidden rounded-[14px]"
          style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))", background: "#0a0a0f" }}
        >
          <iframe
            src="/survival-guide/index.html"
            title="Blue Collar Sales Survival Guide"
            className="block h-full w-full"
            style={{ border: 0 }}
          />
        </div>
      </div>
    </CbSurface>
  );
}
