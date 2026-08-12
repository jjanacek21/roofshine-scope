import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCbSession } from "./CbSessionProvider";

export interface CbCompany {
  id: string;
  workspace_id: string;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license_numbers: unknown;
  is_locked: boolean;
}

interface CbCompanyContextValue {
  companies: CbCompany[];
  company: CbCompany | null;
  loading: boolean;
  isAdmin: boolean;
  setCompanyId: (id: string) => void;
  refresh: () => void;
}

const Ctx = createContext<CbCompanyContextValue | undefined>(undefined);
const KEY = "cb_active_company";

export function CbCompanyProvider({ children }: { children: ReactNode }) {
  const { workspace, surface } = useCbSession();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(KEY);
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cb-companies", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_companies")
        .select(
          "id, workspace_id, name, legal_name, logo_url, primary_color, accent_color, phone, email, website, address, city, state, zip, license_numbers, is_locked",
        )
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CbCompany[];
    },
  });

  const companies = useMemo(() => data ?? [], [data]);

  const company = useMemo(() => {
    if (!companies.length) return null;
    if (surface === "platform") {
      return companies.find((c) => c.is_locked) ?? companies[0];
    }
    return companies.find((c) => c.id === activeId) ?? companies[0];
  }, [companies, activeId, surface]);

  useEffect(() => {
    if (company && company.id !== activeId) {
      try {
        window.localStorage.setItem(KEY, company.id);
      } catch {
        /* ignore */
      }
    }
  }, [company, activeId]);

  function setCompanyId(id: string) {
    setActiveId(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }

  return (
    <Ctx.Provider
      value={{
        companies,
        company,
        loading: isLoading,
        isAdmin: workspace?.role === "admin",
        setCompanyId,
        refresh: () => void qc.invalidateQueries({ queryKey: ["cb-companies", workspace?.id] }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCbCompany() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCbCompany must be used within CbCompanyProvider");
  return ctx;
}
