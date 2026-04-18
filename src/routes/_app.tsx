import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileBottomTabs } from "@/components/layout/MobileBottomTabs";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Check the user has a company; otherwise → onboarding
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!data?.company_id) {
        navigate({ to: "/onboarding" });
        return;
      }
      setChecking(false);
    })();
  }, [user, loading, navigate]);

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
      <div className="lg:pl-[240px]">
        <Topbar />
        <main className="px-6 py-6 pb-24 sm:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileBottomTabs />
    </div>
  );
}
