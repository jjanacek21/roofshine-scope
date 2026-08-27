import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbLoading } from "@/components/cb/primitives";
import { CbDashboard } from "@/components/claim-buddy/CbDashboard";
import { getSurface } from "@/lib/cbMode";


export const Route = createFileRoute("/cb/")({
  head: () => ({
    meta: [
      { title: "Inspections — Claim Buddy" },
      {
        name: "description",
        content:
          "Start a roof inspection, track report status, and see every claim your team is working — from the driveway.",
      },
      { property: "og:title", content: "Inspections — Claim Buddy" },
      {
        property: "og:description",
        content: "Field inspection and insurance-restoration tooling for roofing contractors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbHomePage,
});

function CbHomePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading, error, refresh } = useCbSession();

  useEffect(() => {
    /* gcn.claims is an acquisition domain: strangers get sign-up, not sign-in. */
    if (!authLoading && !user) {
      navigate({ to: getSurface() === "standalone" ? "/cb/signup" : "/cb/login", replace: true });
    }
  }, [authLoading, user, navigate]);


  useEffect(() => {
    /* Only send someone to onboarding when the context loaded cleanly and there
       really are no workspaces — an errored RPC must never look like "no company". */
    if (!loading && !error && user && workspaces.length === 0) {
      navigate({ to: "/cb/onboarding", replace: true });
    }
  }, [loading, error, user, workspaces.length, navigate]);

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        {authLoading || loading || !user ? (
          <div className="mx-auto w-full max-w-[840px] px-5 py-10">
            <CbLoading label="Loading Claim Buddy…" />
          </div>
        ) : error ? (
          <div className="mx-auto w-full max-w-[520px] px-5 py-16 text-center">
            <p className="text-[16px] font-semibold">Couldn't load your account</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-5 inline-flex h-10 items-center rounded-lg px-5 text-[13px] font-semibold"
              style={{ background: "var(--cb-accent)", color: "#fff" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <CbDashboard />
        )}
      </div>
    </CbSurface>
  );
}
