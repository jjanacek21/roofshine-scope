import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton } from "@/components/cb/primitives";
import { CbHeadline, CbReveal } from "@/components/cb/motion";

/**
 * Placeholder for the signable agreement. The presentation's closing slide
 * routes here, so the destination exists before the contract itself is built.
 */
export const Route = createFileRoute("/cb/job/$id/contract")({
  head: () => ({
    meta: [
      { title: "Agreement — Claim Buddy" },
      {
        name: "description",
        content: "Review and sign the contingency agreement for this property damage claim.",
      },
      { property: "og:title", content: "Agreement — Claim Buddy" },
      { property: "og:description", content: "Sign the agreement and get the claim moving." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbContractPage,
});

function CbContractPage() {
  const { id } = useParams({ from: "/cb/job/$id/contract" });
  const navigate = useNavigate();
  return (
    <CbSurface>
      <div className="flex min-h-screen items-center px-5" style={{ background: "var(--cb-bg)" }}>
        <CbCard elevation="raised" className="mx-auto" style={{ padding: 26, maxWidth: 520 }}>
          <CbHeadline as="h1" text="The agreement is coming next" className="cb-display" style={{ fontSize: 22 }} />
          <CbReveal delay={100}>
            <p className="mt-3 text-[15px]" style={{ color: "var(--cb-text-muted)" }}>
              Signing happens here — the contingency agreement, the scope summary and the homeowner signature.
            </p>
          </CbReveal>
          <div className="mt-5 grid gap-2">
            <CbButton block onClick={() => navigate({ to: "/cb/job/$id/present", params: { id } })}>
              Back to the presentation
            </CbButton>
            <CbButton block variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Back to jobs
            </CbButton>
          </div>
        </CbCard>
      </div>
    </CbSurface>
  );
}
