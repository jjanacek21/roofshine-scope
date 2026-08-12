import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany } from "@/components/auth/CbCompanyProvider";
import { useAuth } from "@/hooks/useAuth";
import { useCbPendingEdits } from "@/lib/cbOfflineQueue";
import { ChevronLeft, Wifi, WifiOff } from "lucide-react";

export const Route = createFileRoute("/cb/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Claim Buddy" },
      {
        name: "description",
        content: "Check your connection and pending uploads, switch workspace, clear the local cache, or sign out.",
      },
      { property: "og:title", content: "Settings — Claim Buddy" },
      { property: "og:description", content: "Connection, storage and account controls for Claim Buddy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbSettingsPage,
});

function CbSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, workspaces, setWorkspaceId, surface } = useCbSession();
  const { company } = useCbCompany();
  const pending = useCbPendingEdits();
  const [online, setOnline] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function clearCache() {
    setClearing(true);
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      Object.keys(localStorage)
        .filter((k) => k.startsWith("cb_scroll") || k.startsWith("cb_draft"))
        .forEach((k) => localStorage.removeItem(k));
      toast.success("Local cache cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not clear the cache");
    } finally {
      setClearing(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/cb/login" });
  }

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[840px] px-5 pb-24 pt-8">
          <CbReveal>
            <button
              type="button"
              onClick={() => navigate({ to: "/cb" })}
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Inspections
            </button>
            <h1 className="cb-display" style={{ fontSize: 26 }}>
              Settings
            </h1>
          </CbReveal>

          <div className="mt-6 space-y-4">
            <CbCard elevation="raised" style={{ padding: 18 }}>
              <div className="flex items-center gap-3">
                {online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">{online ? "Online" : "Offline"}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                    {pending > 0
                      ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync — they'll go up automatically.`
                      : "Everything is synced."}
                  </p>
                </div>
                {pending > 0 ? <CbBadge tone="warning">Pending</CbBadge> : <CbBadge tone="success">Synced</CbBadge>}
              </div>
            </CbCard>

            <CbCard elevation="card" style={{ padding: 18 }}>
              <p className="cb-microlabel">Account</p>
              <p className="mt-2 text-[14px]">{user?.email}</p>
              <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {company?.name ?? workspace?.name} · {workspace?.role ?? "rep"}
                {surface === "platform" ? " · inside GlobalContractor" : ""}
              </p>
            </CbCard>

            {workspaces.length > 1 ? (
              <CbCard elevation="card" style={{ padding: 18 }}>
                <p className="cb-microlabel">Workspace</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className="cb-chip"
                      onClick={() => setWorkspaceId(w.id)}
                      aria-pressed={w.id === workspace?.id}
                      style={
                        w.id === workspace?.id
                          ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" }
                          : undefined
                      }
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </CbCard>
            ) : null}

            {workspace?.role === "admin" ? (
              <CbCard elevation="card" style={{ padding: 18 }}>
                <p className="cb-microlabel">Admin</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/admin/branding" })}>
                    Branding
                  </CbButton>
                  <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/admin/team" })}>
                    Team
                  </CbButton>
                  <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/admin/pricing" })}>
                    Pricing
                  </CbButton>
                </div>
              </CbCard>
            ) : null}

            <CbCard elevation="card" style={{ padding: 18 }}>
              <p className="cb-microlabel">Storage</p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Clears cached screens and drafts on this device. Uploaded photos and saved inspections are untouched.
              </p>
              <div className="mt-3">
                <CbButton size="md" variant="secondary" loading={clearing} loadingText="Clearing…" onClick={clearCache}>
                  Clear local cache
                </CbButton>
              </div>
            </CbCard>

            <CbButton block variant="danger" onClick={signOut}>
              Sign out
            </CbButton>
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
