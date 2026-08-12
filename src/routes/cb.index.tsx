import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ClaimBuddyPlaceholder } from "@/components/claim-buddy/ClaimBuddyPlaceholder";

export const Route = createFileRoute("/cb/")({
  head: () => ({
    meta: [
      { title: "Claim Buddy — Roof Inspections & Damage Reports" },
      {
        name: "description",
        content:
          "Run storm damage inspections, capture photo documentation, measure roofs, and get contingencies signed — all from the field.",
      },
      { property: "og:title", content: "Claim Buddy — Roof Inspections & Damage Reports" },
      {
        property: "og:description",
        content: "Field inspection and insurance-restoration sales tool for roofing contractors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbHome,
});

function CbHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/cb/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div data-cb className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-xs">
          <CbLoading label="Checking your session…" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "var(--bg)" }}>
      <ClaimBuddyPlaceholder />
    </div>
  );
}
