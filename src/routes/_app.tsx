import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getSurface } from "@/lib/cbMode";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomTabs } from "@/components/layout/MobileBottomTabs";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { SitePage } from "@/components/site/SitePage";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  // Signed out at the root, a visitor gets the marketing page rather than a
  // login form. Every other app route still bounces to /login.
  const [publicHome, setPublicHome] = useState(false);
  const atRoot = location.pathname === "/" || location.pathname === "";
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // On the standalone Claim Buddy domain "/" is the marketing landing page,
    // not the Global Contractor app. The root StandaloneGate owns routing there —
    // redirecting to /login from here hijacks marketing navigation (e.g. Book a demo).
    if (getSurface() === "standalone") return;
    if (loading) return;
    if (!user) {
      if (atRoot) {
        setPublicHome(true);
        return;
      }
      navigate({ to: "/login" });
      return;
    }
    setPublicHome(false);

    let cancelled = false;

    (async () => {
      setLoadError(null);

      async function readProfile() {
        return supabase
          .from("profiles")
          .select("company_id, onboarding_completed_at, role")
          .eq("id", user!.id)
          .maybeSingle();
      }

      let { data, error } = await readProfile();

      /* A stale/expired token makes this read fail. That is NOT the same thing as
         "this user has no company" — refresh the session and try once more before
         drawing any conclusion. */
      if (error) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          ({ data, error } = await readProfile());
        }
      }
      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        return;
      }

      if (!data) {
        /* Signed in, but no profile row is readable at all — treat as a broken
           session rather than dumping an existing user into company setup. */
        await supabase.auth.signOut();
        toast.error("Your session expired. Please sign in again.");
        navigate({ to: "/login" });
        return;
      }

      // Super admins are never routed into the create-a-company wizard.
      if (!data.company_id && data.role !== "super_admin") {
        const params = new URLSearchParams(window.location.search);
        const invite = params.get("invite") ?? undefined;
        navigate({ to: "/onboarding", search: { invite } });
        return;
      }

      // Archived companies are shut off — their members cannot sign in.
      if (data.company_id && data.role !== "super_admin") {
        const { data: co, error: coError } = await supabase
          .from("companies")
          .select("status")
          .eq("id", data.company_id)
          .maybeSingle();
        if (cancelled) return;
        if (coError) {
          setLoadError(coError.message);
          return;
        }
        if ((co as { status?: string } | null)?.status === "archived") {
          await supabase.auth.signOut();
          toast.error("This account has been deactivated. Contact your administrator.");
          navigate({ to: "/login" });
          return;
        }
      }

      if (!data.onboarding_completed_at && data.role !== "super_admin") {
        navigate({ to: "/profile-setup" });
        return;
      }
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, attempt, atRoot]);

  if (publicHome) {
    return <SitePage slug="app-home" />;
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load your account</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setAttempt((n) => n + 1);
              }}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-xs font-semibold hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <ContentArea>
        <Topbar />
        <main className="px-6 py-6 pb-24 sm:pb-6">
          <Outlet />
        </main>
      </ContentArea>
      <MobileBottomTabs />
      <AssistantBubble />
    </div>
  );
}

function ContentArea({ children }: { children: React.ReactNode }) {
  const [collapsed] = useSidebarCollapsed();
  return (
    <div
      style={{ paddingLeft: undefined }}
      className={collapsed ? "lg:pl-[72px]" : "lg:pl-[240px]"}
    >
      {children}
    </div>
  );
}
