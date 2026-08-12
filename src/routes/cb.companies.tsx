import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany, type CbCompany } from "@/components/auth/CbCompanyProvider";
import { useCbLogoUrl } from "@/lib/cbLogo";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbSheet, CbLoading, CbChip } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { CbHeadline, CbReveal, CbStagger } from "@/components/cb/motion";
import { Building2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cb/companies")({
  head: () => ({
    meta: [
      { title: "Companies — Claim Buddy" },
      {
        name: "description",
        content: "Switch between the companies in your Claim Buddy workspace and manage their branding.",
      },
      { property: "og:title", content: "Companies — Claim Buddy" },
      {
        property: "og:description",
        content: "Pick the company you're working under today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbCompaniesPage,
});

function CbCompaniesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspace, surface, loading: sessionLoading } = useCbSession();
  const { companies, company, isAdmin, setCompanyId, refresh, loading } = useCbCompany();

  const [editing, setEditing] = useState<CbCompany | "new" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/cb/login" });
  }, [authLoading, user, navigate]);

  // On the platform surface the company is the locked GC-linked row.
  useEffect(() => {
    if (surface === "platform") navigate({ to: "/cb", replace: true });
  }, [surface, navigate]);

  const jobCounts = useQuery({
    queryKey: ["cb-company-job-counts", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_jobs")
        .select("company_id")
        .eq("workspace_id", workspace!.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) if (r.company_id) counts[r.company_id] = (counts[r.company_id] ?? 0) + 1;
      return counts;
    },
  });
  const counts = useMemo(() => jobCounts.data ?? {}, [jobCounts.data]);

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[840px] px-5 pb-24 pt-8">
          <CbHeadline text="Your companies" as="h1" className="cb-display" style={{ fontSize: 24 }} />
          <CbReveal delay={80}>
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Pick who you're working as today. Reports and agreements use that company's branding.
            </p>
          </CbReveal>

          {sessionLoading || loading ? (
            <div className="mt-8">
              <CbLoading label="Loading companies…" />
            </div>
          ) : (
            <CbStagger className="mt-7 grid gap-3 sm:grid-cols-2">
              {companies.map((c) => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  active={company?.id === c.id}
                  jobCount={counts[c.id] ?? 0}
                  canEdit={isAdmin}
                  onPick={() => {
                    setCompanyId(c.id);
                    navigate({ to: "/cb" });
                  }}
                  onEdit={() => setEditing(c)}
                />
              ))}
              {isAdmin ? (
                <CbCard
                  elevation="card"
                  className="flex cursor-pointer items-center justify-center"
                  style={{ padding: 22, minHeight: 132 }}
                  onClick={() => setEditing("new")}
                >
                  <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
                    <Plus className="h-4 w-4" /> Add company
                  </span>
                </CbCard>
              ) : null}
            </CbStagger>
          )}
        </div>
      </div>

      <CompanySheet
        open={!!editing}
        company={editing === "new" ? null : editing}
        workspaceId={workspace?.id ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
          void jobCounts.refetch();
        }}
      />
    </CbSurface>
  );
}

function CompanyCard({
  company,
  active,
  jobCount,
  canEdit,
  onPick,
  onEdit,
}: {
  company: CbCompany;
  active: boolean;
  jobCount: number;
  canEdit: boolean;
  onPick: () => void;
  onEdit: () => void;
}) {
  const logoUrl = useCbLogoUrl(company.logo_url);
  return (
    <CbCard
      elevation={active ? "floating" : "card"}
      tilt
      className="cursor-pointer"
      style={{ padding: 18 }}
      onClick={onPick}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
          style={{
            background: "var(--cb-surface-sunken, rgba(0,0,0,.05))",
            border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={`${company.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{company.name}</p>
          <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
            {[company.city, company.state].filter(Boolean).join(", ") || "No location yet"}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <CbChip>
              <span className="cb-num">{jobCount}</span>&nbsp;jobs
            </CbChip>
            {active ? <CbChip>Active</CbChip> : null}
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            aria-label={`Edit ${company.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-[12px]"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))" }}
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </CbCard>
  );
}

function CompanySheet({
  open,
  company,
  workspaceId,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: CbCompany | null;
  workspaceId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setPhone(company?.phone ?? "");
    setEmail(company?.email ?? "");
    setWebsite(company?.website ?? "");
    setAddress(company?.address ?? "");
    setCity(company?.city ?? "");
    setState(company?.state ?? "");
    setZip(company?.zip ?? "");
  }, [open, company]);

  async function save() {
    if (!workspaceId || name.trim().length < 2) {
      toast.error("Give the company a name first");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
    };
    const { error } = company
      ? await supabase.from("cb_companies").update(payload).eq("id", company.id)
      : await supabase.from("cb_companies").insert({ ...payload, workspace_id: workspaceId });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(company ? "Company updated" : "Company added");
    onSaved();
  }

  return (
    <CbSheet
      open={open}
      onClose={onClose}
      title={company ? "Edit company" : "Add company"}
      footer={
        <div className="flex gap-3">
          <CbButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </CbButton>
          <CbButton block onClick={save} loading={saving} loadingText="Saving…">
            Save
          </CbButton>
        </div>
      }
    >
      <div className="space-y-4">
        <CbField label="Company name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CbField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <CbField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <CbField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
        <CbField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="grid grid-cols-3 gap-3">
          <CbField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <CbField label="State" value={state} onChange={(e) => setState(e.target.value)} />
          <CbField label="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>
      </div>
    </CbSheet>
  );
}
