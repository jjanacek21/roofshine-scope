import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

/** Label used when a company has not set its own module label. */
export const DEFAULT_MODULE_LABEL = "Commercial Roofing";

export type CompanyBrand = {
  companyId: string | null;
  name: string;
  logoUrl: string | null;
  /** Brand color, or null when the company has none set (use app tokens). */
  primaryColor: string | null;
  accentColor: string | null;
  /** Nav / header label for the commercial module. */
  moduleLabel: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  cityStateZip: string | null;
  /** "1913 NW 18th St · Pompano Beach, FL 33069 · 954-782-3002" */
  contactLine: string;
  loading: boolean;
};

const EMPTY: CompanyBrand = {
  companyId: null,
  name: "",
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  moduleLabel: DEFAULT_MODULE_LABEL,
  phone: null,
  email: null,
  website: null,
  address: null,
  cityStateZip: null,
  contactLine: "",
  loading: false,
};

/**
 * The signed-in user's company branding. One source of truth for the
 * commercial module header, nav label and every generated report.
 */
export function useCompanyBrand(): CompanyBrand {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["company-brand", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select(
          "id, name, logo_url, primary_color, accent_color, module_label, phone, email, website, address, city, state, postal_code",
        )
        .eq("id", companyId!)
        .maybeSingle();
      return data;
    },
  });

  if (!data) return { ...EMPTY, companyId, loading: !!companyId && isLoading };

  const cityStateZip =
    [data.city, [data.state, data.postal_code].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || null;

  return {
    companyId,
    name: data.name ?? "",
    logoUrl: data.logo_url ?? null,
    primaryColor: data.primary_color ?? null,
    accentColor: data.accent_color ?? null,
    moduleLabel: data.module_label?.trim() || DEFAULT_MODULE_LABEL,
    phone: data.phone ?? null,
    email: data.email ?? null,
    website: data.website ?? null,
    address: data.address ?? null,
    cityStateZip,
    contactLine: [data.address, cityStateZip, data.phone].filter(Boolean).join(" · "),
    loading: false,
  };
}

/**
 * Fetch a logo URL and return a data URL suitable for jsPDF.addImage.
 * Returns null on failure so callers can fall back to a text-only header.
 */
export async function loadLogoDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
