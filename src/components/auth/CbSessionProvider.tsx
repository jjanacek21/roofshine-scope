import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSurface, type CbSurface } from "@/lib/cbMode";
import {
  cbResolveFeatures,
  cbTierDefaults,
  type CbFeature,
  type CbFeatureMap,
  type CbTier,
} from "@/lib/cbFeatures";

export interface CbWorkspace {
  id: string;
  name: string;
  origin: "platform" | "standalone";
  gc_company_id: string | null;
  plan: string;
  measure_credits: number;
  role: "owner" | "admin" | "rep";
  seats_purchased?: number;
  tier?: CbTier;
  status?: string;
  is_comp?: boolean;
  features?: Partial<Record<CbFeature, boolean>>;
}

export interface CbContextValue {
  surface: CbSurface;
  loading: boolean;
  error: string | null;
  hasGcAccess: boolean;
  gcCompanyId: string | null;
  workspaces: CbWorkspace[];
  workspace: CbWorkspace | null;
  /** Tier + per-company overrides for the active workspace. */
  features: CbFeatureMap;
  tier: CbTier;
  /** Platform (GlobalContractor) users are never gated. */
  can: (feature: CbFeature) => boolean;
  setWorkspaceId: (id: string) => void;
  refresh: () => Promise<void>;
}

const CbContext = createContext<CbContextValue | undefined>(undefined);

const ACTIVE_KEY = "cb_active_workspace";

export function CbSessionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [surface] = useState<CbSurface>(() => getSurface());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasGcAccess, setHasGcAccess] = useState(false);
  const [gcCompanyId, setGcCompanyId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<CbWorkspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_KEY);
  });

  async function load() {
    if (!user) {
      setWorkspaces([]);
      setHasGcAccess(false);
      setGcCompanyId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      /* Seat the user into any workspace they were invited to, and stamp activity. */
      await supabase.rpc("cb_claim_invites");

      const { data, error: rpcError } = await supabase.rpc("cb_my_context");
      if (rpcError) throw rpcError;

      const ctx = (data ?? {}) as {
        has_gc_access?: boolean;
        gc_company_id?: string | null;
        workspaces?: CbWorkspace[];
      };

      let list = ctx.workspaces ?? [];

      // Platform users with a Global Contractor company get a mirrored workspace.
      if (ctx.has_gc_access && !list.some((w) => w.origin === "platform")) {
        const { error: ensureError } = await supabase.rpc("cb_ensure_platform_workspace");
        if (!ensureError) {
          const { data: again } = await supabase.rpc("cb_my_context");
          list = ((again ?? {}) as { workspaces?: CbWorkspace[] }).workspaces ?? list;
        }
      }

      setHasGcAccess(!!ctx.has_gc_access);
      setGcCompanyId(ctx.gc_company_id ?? null);
      setWorkspaces(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Claim Buddy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const preferred =
    surface === "standalone"
      ? workspaces.find((w) => w.origin === "standalone")
      : workspaces.find((w) => w.origin === "platform");

  const workspace =
    workspaces.find((w) => w.id === activeId) ?? preferred ?? workspaces[0] ?? null;

  function setWorkspaceId(id: string) {
    setActiveId(id);
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  const tier: CbTier = (workspace?.tier as CbTier) ?? "basic";
  /* Platform (GlobalContractor) workspaces are internal — never gated. */
  const features: CbFeatureMap =
    !workspace || workspace.origin === "platform" || hasGcAccess
      ? cbTierDefaults("elite")
      : cbResolveFeatures({
          tier: workspace.tier ?? workspace.plan,
          is_comp: workspace.is_comp ?? false,
          features: workspace.features ?? {},
        });
  const can = (feature: CbFeature) => features[feature] === true;

  return (
    <CbContext.Provider
      value={{
        surface,
        features,
        tier,
        can,
        loading: authLoading || loading,
        error,
        hasGcAccess,
        gcCompanyId,
        workspaces,
        workspace,
        setWorkspaceId,
        refresh: load,
      }}
    >
      {children}
    </CbContext.Provider>
  );
}

export function useCbSession() {
  const ctx = useContext(CbContext);
  if (!ctx) throw new Error("useCbSession must be used within CbSessionProvider");
  return ctx;
}
