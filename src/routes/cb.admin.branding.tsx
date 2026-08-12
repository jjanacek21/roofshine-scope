import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAdminShell } from "@/components/cb/CbAdminShell";
import { CbCard, CbButton, CbBadge, CbSkeleton } from "@/components/cb/primitives";
import { CbField, CbTextarea } from "@/components/cb/forms";
import { CbReveal } from "@/components/cb/motion";
import { useCbCompany } from "@/components/auth/CbCompanyProvider";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbLogoUrl, cbUploadLogo } from "@/lib/cbLogo";
import { Building2, Upload } from "lucide-react";

export const Route = createFileRoute("/cb/admin/branding")({
  head: () => ({
    meta: [
      { title: "Branding — Claim Buddy admin" },
      {
        name: "description",
        content:
          "Set the logo, colours and contact details that appear on every Claim Buddy damage report, contract and presentation.",
      },
      { property: "og:title", content: "Branding — Claim Buddy admin" },
      { property: "og:description", content: "Company branding for reports, contracts and presentations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbAdminBrandingPage,
});

function CbAdminBrandingPage() {
  const { company, loading, refresh } = useCbCompany();
  const { workspace, surface } = useCbSession();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    primary_color: "#111111",
    accent_color: "#f97316",
    about_headline: "",
    about_story: "",
    logo_url: "" as string | null,
  });

  useEffect(() => {
    if (!company) return;
    setForm((f) => ({
      ...f,
      name: company.name ?? "",
      legal_name: company.legal_name ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      website: company.website ?? "",
      address: company.address ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      zip: company.zip ?? "",
      primary_color: company.primary_color ?? "#111111",
      accent_color: company.accent_color ?? "#f97316",
      logo_url: company.logo_url ?? "",
    }));
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    void supabase
      .from("cb_companies")
      .select("about_headline, about_story")
      .eq("id", company.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setForm((f) => ({
          ...f,
          about_headline: data.about_headline ?? "",
          about_story: data.about_story ?? "",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  const logoUrl = useCbLogoUrl(form.logo_url);
  const locked = !!company?.is_locked;

  const addressLine = useMemo(
    () => [form.address, [form.city, form.state].filter(Boolean).join(", "), form.zip].filter(Boolean).join(" · "),
    [form.address, form.city, form.state, form.zip],
  );

  async function onPickLogo(file: File) {
    if (!workspace) return;
    try {
      const path = await cbUploadLogo(workspace.id, file);
      setForm((f) => ({ ...f, logo_url: path }));
      toast.success("Logo uploaded — save to apply it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function save() {
    if (!company) return;
    setSaving(true);
    const { error } = await supabase
      .from("cb_companies")
      .update({
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        about_headline: form.about_headline.trim() || null,
        about_story: form.about_story.trim() || null,
        logo_url: form.logo_url || null,
      })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("Branding saved — reports and contracts use it immediately.");
  }

  return (
    <CbAdminShell
      title="Branding"
      subtitle="This is what the homeowner and the adjuster see on every report, contract and presentation."
    >
      {loading ? (
        <CbSkeleton height={220} radius={18} />
      ) : locked ? (
        <CbCard elevation="card" style={{ padding: 20 }}>
          <CbBadge tone="accent">Managed in GlobalContractor</CbBadge>
          <p className="mt-3 text-[14px]">
            {surface === "platform"
              ? "This workspace mirrors your GlobalContractor company, so branding is edited there and kept in sync automatically."
              : "This company is locked by your organisation."}
          </p>
        </CbCard>
      ) : (
        <div className="space-y-5">
          {/* Live preview */}
          <CbReveal>
            <CbCard elevation="raised" style={{ padding: 0, overflow: "hidden" }}>
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{ background: form.primary_color, color: "#fff" }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[12px]"
                  style={{ background: "rgba(255,255,255,.14)" }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${form.name || "Company"} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold">{form.name || "Your company"}</p>
                  <p className="truncate text-[12px] opacity-85">
                    {[form.phone, form.website].filter(Boolean).join(" · ") || "Phone · website"}
                  </p>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="cb-microlabel">Damage report header preview</p>
                <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {addressLine || "Company address"}
                </p>
                <div className="mt-3 h-1.5 w-24 rounded-full" style={{ background: form.accent_color }} />
              </div>
            </CbCard>
          </CbReveal>

          <CbCard elevation="card" style={{ padding: 18 }}>
            <p className="cb-microlabel">Logo</p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[14px]"
                style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-5 w-5" style={{ color: "var(--cb-text-muted)" }} />
                )}
              </div>
              <CbButton size="md" variant="secondary" onClick={() => fileRef.current?.click()}>
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload logo
                </span>
              </CbButton>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickLogo(f);
                  e.target.value = "";
                }}
              />
            </div>
          </CbCard>

          <CbCard elevation="card" style={{ padding: 18 }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <CbField label="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <CbField
                label="Legal name (contracts)"
                value={form.legal_name}
                onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              />
              <CbField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <CbField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <CbField label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <CbField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <CbField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <CbField label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <CbField label="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <ColorRow
                label="Primary colour"
                value={form.primary_color}
                onChange={(v) => setForm({ ...form, primary_color: v })}
              />
              <ColorRow
                label="Accent colour"
                value={form.accent_color}
                onChange={(v) => setForm({ ...form, accent_color: v })}
              />
            </div>
          </CbCard>

          <CbCard elevation="card" style={{ padding: 18 }}>
            <p className="cb-microlabel">Presentation story</p>
            <div className="mt-3 space-y-4">
              <CbField
                label="Headline"
                value={form.about_headline}
                onChange={(e) => setForm({ ...form, about_headline: e.target.value })}
              />
              <CbTextarea
                label="About your company"
                rows={5}
                value={form.about_story}
                onChange={(e) => setForm({ ...form, about_story: e.target.value })}
              />
            </div>
          </CbCard>

          <CbButton block loading={saving} loadingText="Saving…" onClick={save}>
            Save branding
          </CbButton>
        </div>
      )}
    </CbAdminShell>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-14 cursor-pointer rounded-[10px] border-0 bg-transparent p-0"
        aria-label={label}
      />
      <span className="text-[13.5px]">{label}</span>
      <span className="cb-num ml-auto text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
        {value}
      </span>
    </label>
  );
}
