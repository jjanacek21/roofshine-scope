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
  const { workspaces, loading } = useCbSession();

  useEffect(() => {
    /* gcn.claims is an acquisition domain: strangers get sign-up, not sign-in. */
    if (!authLoading && !user) {
      navigate({ to: getSurface() === "standalone" ? "/cb/signup" : "/cb/login", replace: true });
    }
  }, [authLoading, user, navigate]);


  useEffect(() => {
    if (!loading && user && workspaces.length === 0) navigate({ to: "/cb/onboarding", replace: true });
  }, [loading, user, workspaces.length, navigate]);

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        {authLoading || loading || !user ? (
          <div className="mx-auto w-full max-w-[840px] px-5 py-10">
            <CbLoading label="Loading Claim Buddy…" />
          </div>
        ) : (
          <CbDashboard />
        )}
      </div>
    </CbSurface>
  );
}
