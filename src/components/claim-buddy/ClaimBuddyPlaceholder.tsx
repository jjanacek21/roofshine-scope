import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Camera, Ruler, FileSignature } from "lucide-react";
import { useCbSession } from "@/components/auth/CbSessionProvider";

const STEPS = [
  { icon: ClipboardCheck, title: "Inspection intake", body: "Customer, carrier, claim number, and date of loss." },
  { icon: Camera, title: "Photo documentation", body: "Elevation-by-elevation capture with guided shot lists." },
  { icon: Ruler, title: "Measurements", body: "Instant roof measurements or rep-adjusted manual takeoffs." },
  { icon: FileSignature, title: "Report & agreement", body: "Damage report, share link, and signed contingency." },
];

/** Placeholder home for the Claim Buddy section (backend is live, screens land next). */
export function ClaimBuddyPlaceholder() {
  const { workspace, workspaces, loading, error, hasGcAccess } = useCbSession();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Claim Buddy</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Field inspection and insurance-restoration workflow for storm claims.
        </p>
      </div>

      <div
        className="mb-6 rounded-[14px] p-4 text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {loading ? (
          <span style={{ color: "var(--text-muted)" }}>Loading your workspace…</span>
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : workspace ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="font-semibold text-foreground">{workspace.name}</span>
            <span style={{ color: "var(--text-muted)" }}>Role: {workspace.role}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {workspace.origin === "platform"
                ? "Unlimited measurements"
                : `${workspace.measure_credits} measure credits`}
            </span>
            {workspaces.length > 1 && (
              <span style={{ color: "var(--text-muted)" }}>{workspaces.length} workspaces</span>
            )}
          </div>
        ) : hasGcAccess ? (
          <span style={{ color: "var(--text-muted)" }}>Setting up your workspace…</span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>
            No Claim Buddy workspace yet.{" "}
            <Link to="/cb/signup" className="font-semibold text-[var(--brand)] hover:underline">
              Create one
            </Link>
            .
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className="rounded-[14px] p-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <Icon className="mb-2.5 h-5 w-5" style={{ color: "var(--brand)" }} strokeWidth={2} />
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {s.body}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-[13px]" style={{ color: "var(--text-muted)" }}>
        The Claim Buddy database, permissions, storage and job-conversion logic are live. Inspection
        screens are being built on top of it next.
      </p>
    </div>
  );
}
