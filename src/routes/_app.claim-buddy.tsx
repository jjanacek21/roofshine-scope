import { createFileRoute } from "@tanstack/react-router";
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
  return <ClaimBuddyPlaceholder />;
}
