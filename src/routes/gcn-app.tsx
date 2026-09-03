import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, CloudLightning, FileText, GraduationCap, Users } from "lucide-react";

export const Route = createFileRoute("/gcn-app")({
  head: () => ({
    meta: [
      { title: "The Global Contractor App — Full CRM for Restoration Contractors" },
      {
        name: "description",
        content:
          "Jobs, estimates, invoicing, storm intelligence and company training in one place. Request a demo or upgrade your membership to unlock the Global Contractor app.",
      },
      { property: "og:title", content: "The Global Contractor App" },
      {
        property: "og:description",
        content: "Upgrade from Claim Buddy to the full Global Contractor platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GcnAppUpsell,
});

const FEATURES = [
  { icon: Briefcase, title: "Jobs & pipeline", body: "Every job, stage and crew assignment tracked end to end." },
  { icon: FileText, title: "Estimates & invoicing", body: "Carrier-style estimates, contracts and payments." },
  { icon: CloudLightning, title: "Storm intelligence", body: "Hail and wind history, canvassing maps and mailers." },
  { icon: Users, title: "Team & prospecting", body: "Door to door, lead lists and rep accountability." },
  { icon: GraduationCap, title: "Company training", body: "Build your own classroom with courses and a scoreboard." },
];

function GcnAppUpsell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-[720px]">
        <button
          type="button"
          onClick={() => navigate({ to: "/cb" })}
          className="mb-5 inline-flex items-center gap-1 text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Claim Buddy
        </button>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">The Global Contractor app</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Claim Buddy handles the inspection. The Global Contractor app runs the rest of the business — and it is a
          separate membership your account does not include yet.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-4">
              <f.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold text-foreground">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/demo"
            className="btn-brand inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold"
          >
            Request a demo
          </Link>
          <Link
            to="/pricing"
            className="inline-flex h-11 items-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Upgrade my membership
          </Link>
        </div>
      </div>
    </div>
  );
}
