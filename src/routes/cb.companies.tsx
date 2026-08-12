import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany, type CbCompany } from "@/components/auth/CbCompanyProvider";
import { useCbLogoUrl, cbLogoSignedUrl, CB_LOGO_BUCKET } from "@/lib/cbLogo";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbSheet, CbLoading, CbChip } from "@/components/cb/primitives";
import { CbField, CbSegmentedCards, CbTextarea } from "@/components/cb/forms";
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
  const [aboutHeadline, setAboutHeadline] = useState("");
  const [aboutStory, setAboutStory] = useState("");
  const [founded, setFounded] = useState("");
  const [areas, setAreas] = useState("");
  const [teamPhotoPath, setTeamPhotoPath] = useState<string | null>(null);
  const [teamPhotoUrl, setTeamPhotoUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<"contingency" | "retail">("contingency");
  const [uploading, setUploading] = useState(false);
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
    const extra = (company ?? {}) as unknown as {
      about_headline?: string | null;
      about_story?: string | null;
      founded_year?: number | null;
      service_areas?: unknown;
      team_photo_url?: string | null;
      default_doc_type?: string | null;
    };
    setAboutHeadline(extra.about_headline ?? "");
    setAboutStory(extra.about_story ?? "");
    setFounded(extra.founded_year ? String(extra.founded_year) : "");
    setAreas(Array.isArray(extra.service_areas) ? extra.service_areas.map(String).join(", ") : "");
    setTeamPhotoPath(extra.team_photo_url ?? null);
    setDocType(extra.default_doc_type === "retail" ? "retail" : "contingency");
    setTeamPhotoUrl(null);
    void cbLogoSignedUrl(extra.team_photo_url).then(setTeamPhotoUrl);

  }, [open, company]);

  async function uploadTeamPhoto(file: File) {
    if (!workspaceId) return;
    setUploading(true);
    const path = `${workspaceId}/team-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from(CB_LOGO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTeamPhotoPath(path);
    setTeamPhotoUrl(await cbLogoSignedUrl(path));
  }

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
      about_headline: aboutHeadline.trim() || null,
      about_story: aboutStory.trim() || null,
      founded_year: founded.trim() ? Number(founded.trim()) : null,
      service_areas: areas
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      team_photo_url: teamPhotoPath,
      default_doc_type: docType,

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

        <div className="pt-1">
          <CbSegmentedCards<"contingency" | "retail">
            label="Default agreement"
            value={docType}
            onChange={setDocType}
            options={[
              { value: "contingency", title: "Contingency", body: "Signed before the claim is filed" },
              { value: "retail", title: "Retail", body: "No claim — the homeowner pays" },
            ]}
          />
        </div>



        <div className="pt-2">
          <p className="cb-microlabel">Your story — shown in the presentation</p>
          <div className="mt-3 space-y-4">
            <CbField
              label="About headline"
              value={aboutHeadline}
              onChange={(e) => setAboutHeadline(e.target.value)}
              hint="The first thing the homeowner reads"
            />
            <CbTextarea
              label="Our story"
              rows={5}
              value={aboutStory}
              onChange={(e) => setAboutStory(e.target.value)}
            />
            <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Leave a blank line between paragraphs — the second paragraph gets its own slide.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <CbField
                label="Founded year"
                inputMode="numeric"
                value={founded}
                onChange={(e) => setFounded(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              />
              <CbField
                label="Service areas"
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                hint="Comma separated"
              />
            </div>
            <div className="flex items-center gap-3">
              {teamPhotoUrl ? (
                <img
                  src={teamPhotoUrl}
                  alt="Team"
                  className="h-16 w-24 rounded-[12px] object-cover"
                  style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))" }}
                />
              ) : null}
              <label className="cb-btn cb-btn-secondary cb-btn-md" style={{ cursor: "pointer" }}>
                <span className="cb-btn-label">{uploading ? "Uploading…" : teamPhotoPath ? "Replace team photo" : "Add team photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadTeamPhoto(f);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </CbSheet>
  );
}
