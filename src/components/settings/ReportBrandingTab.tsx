import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  address_line1?: string;
  address_line2?: string;
  business_phone?: string;
  claims_email?: string;
  estimator_name?: string;
  estimator_position?: string;
  estimator_license?: string;
  legal_statute?: string;
  legal_notice?: string;
  fraud_warning?: string;
};

const TEXT_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2 (city, state ZIP)" },
  { key: "business_phone", label: "Business phone" },
  { key: "claims_email", label: "Claims e-mail" },
  { key: "estimator_name", label: "Default estimator" },
  { key: "estimator_position", label: "Estimator position / title" },
  { key: "estimator_license", label: "License number" },
];

const PARAGRAPHS: { key: keyof Profile; label: string }[] = [
  { key: "legal_statute", label: "Statute / code paragraph" },
  { key: "legal_notice", label: "Legal notice paragraph" },
  { key: "fraud_warning", label: "Fraud warning paragraph" },
];

export function ReportBrandingTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: company } = useQuery({
    queryKey: ["company"],
    enabled: !!user,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (!prof?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", prof.company_id)
        .maybeSingle();
      return data;
    },
  });

  const [profile, setProfile] = useState<Profile>({});
  useEffect(() => {
    if (company) {
      setProfile(((company as { report_profile?: Profile }).report_profile ?? {}) as Profile);
    }
  }, [company]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ report_profile: profile as never } as never)
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report branding saved");
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return <p className="text-sm text-muted-foreground">No company on file.</p>;

  const set = (k: keyof Profile, v: string) => setProfile((p) => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-[13px] text-muted-foreground">
        These values print on the letterhead, cover sheet and signature block of every carrier-style
        estimate report.
      </p>
      {company.logo_url && (
        <img src={company.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <input
              value={profile[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-[13px] outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
        ))}
      </div>
      {PARAGRAPHS.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {f.label}
          </span>
          <textarea
            rows={4}
            value={profile[f.key] ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
            className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-[13px] outline-none"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
      ))}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-brand h-10 w-fit rounded-md px-6 text-sm font-semibold"
      >
        Save
      </button>
    </div>
  );
}
