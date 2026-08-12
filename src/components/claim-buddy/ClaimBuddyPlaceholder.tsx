import { Link } from "@tanstack/react-router";
import { ClipboardCheck, Camera, Ruler, FileSignature } from "lucide-react";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import {
  CbCard,
  CbChip,
  CbIcon,
  CbLoading,
  CbEmptyState,
  CbButton,
  CbSkeleton,
} from "@/components/cb/primitives";
import { CbHeadline, CbReveal, CbStickyHeader } from "@/components/cb/motion";

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
    <CbSurface>
      <div className="mx-auto w-full max-w-3xl">
        <CbStickyHeader>
          <CbHeadline text="Claim Buddy" as="h1" className="cb-display" style={{ fontSize: 26 }} />
        </CbStickyHeader>

        <CbReveal delay={55}>
          <p className="mb-6 text-sm" style={{ color: "var(--cb-text-muted)" }}>
            Field inspection and insurance-restoration workflow for storm claims.
          </p>
        </CbReveal>

        <CbReveal delay={110}>
          {loading ? (
            <CbCard className="mb-6">
              <CbLoading label="Loading your workspace…" />
              <div className="mt-3 flex gap-3">
                <CbSkeleton width={140} height={14} />
                <CbSkeleton width={90} height={14} />
              </div>
            </CbCard>
          ) : error ? (
            <CbCard className="mb-6 text-sm" style={{ color: "var(--cb-danger)" }}>
              {error}
            </CbCard>
          ) : workspace ? (
            <CbCard elevation="raised" tilt className="mb-6">
              <span className="cb-microlabel">Active workspace</span>
              <p className="mt-1.5 text-base font-extrabold">{workspace.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CbChip>Role: {workspace.role}</CbChip>
                <CbChip>
                  {workspace.origin === "platform"
                    ? "Unlimited measurements"
                    : `${workspace.measure_credits} measure credits`}
                </CbChip>
                {workspaces.length > 1 && <CbChip>{workspaces.length} workspaces</CbChip>}
              </div>
            </CbCard>
          ) : hasGcAccess ? (
            <CbCard className="mb-6">
              <CbLoading label="Setting up your workspace…" />
            </CbCard>
          ) : (
            <div className="mb-6">
              <CbEmptyState
                headline="No Claim Buddy workspace yet"
                body="Spin one up and your inspections, photos and agreements all live in one place."
                action={
                  <Link to="/cb/signup">
                    <CbButton>Create a workspace</CbButton>
                  </Link>
                }
              />
            </div>
          )}
        </CbReveal>

        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <CbReveal key={s.title} delay={165 + i * 55}>
                <CbCard tilt className="h-full">
                  <CbIcon>
                    <Icon className="mb-2.5 h-5 w-5" style={{ color: "var(--cb-accent)" }} />
                  </CbIcon>
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                    {s.body}
                  </p>
                </CbCard>
              </CbReveal>
            );
          })}
        </div>

        <CbReveal delay={400}>
          <p className="mt-6 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            The Claim Buddy database, permissions, storage and job-conversion logic are live.
            Inspection screens are being built on top of it next.
          </p>
        </CbReveal>
      </div>
    </CbSurface>
  );
}
