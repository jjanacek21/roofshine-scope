import { createFileRoute } from "@tanstack/react-router";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbLoading } from "@/components/cb/primitives";
import { CbDashboard } from "@/components/claim-buddy/CbDashboard";
import { ClaimBuddyPlaceholder } from "@/components/claim-buddy/ClaimBuddyPlaceholder";

export const Route = createFileRoute("/_app/claim-buddy")({
  head: () => ({
    meta: [
      { title: "Claim Buddy — Inspections & Damage Reports" },
      {
        name: "description",
        content:
          "Storm damage inspections, photo documentation, roof measurements, and signed contingencies that convert straight into jobs.",
      },
      { property: "og:title", content: "Claim Buddy — Inspections & Damage Reports" },
      {
        property: "og:description",
        content: "Run field inspections and turn approved claims into jobs in one click.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClaimBuddySection,
});

function ClaimBuddySection() {
  const { workspaces, loading } = useCbSession();

  if (loading) {
    return (
      <CbSurface>
        <div className="mx-auto w-full max-w-3xl px-5 py-10">
          <CbLoading label="Loading Claim Buddy…" />
        </div>
      </CbSurface>
    );
  }

  // No mirrored workspace yet — keep the explainer screen.
  if (workspaces.length === 0) return <ClaimBuddyPlaceholder />;

  return (
    <CbSurface>
      <CbDashboard />
    </CbSurface>
  );
}
