import { CB_PENDING_SEATS_KEY } from "@/lib/cbPricing";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbField, CbProgressRail, focusFirstError } from "@/components/cb/forms";
import { CbHeadline, CbReveal } from "@/components/cb/motion";
import { cbUploadLogo } from "@/lib/cbLogo";
import { Plus, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cb/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your company — Claim Buddy" },
      {
        name: "description",
        content:
          "Add your company branding, contact details and license numbers so every Claim Buddy report and agreement is yours.",
      },
      { property: "og:title", content: "Set up your company — Claim Buddy" },
      {
        property: "og:description",
        content: "Two quick steps and your Claim Buddy workspace is ready for the field.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbOnboardingPage,
});

interface License {
  state: string;
  number: string;
  label: string;
}

function CbOnboardingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { workspaces, loading: cbLoading, refresh } = useCbSession();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 — company
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#1F425D");
  const [accentColor, setAccentColor] = useState("#E21F2F");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [licenses, setLicenses] = useState<License[]>([{ state: "", number: "", label: "" }]);

  // Step 2 — you
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [cell, setCell] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/cb/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!cbLoading && workspaces.length > 0) navigate({ to: "/cb", replace: true });
  }, [cbLoading, workspaces.length, navigate]);

  if (authLoading || cbLoading || !user) {
    return (
      <CbSurface>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xs">
            <CbLoading label="Getting things ready…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  function onLogoPick(file: File | null) {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function updateLicense(i: number, patch: Partial<License>) {
    setLicenses((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function next() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "What's the company called?";
    if (email && !email.includes("@")) e.email = "That doesn't look like an email address yet.";
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setStep(1);
    window.scrollTo({ top: 0 });
  }

  async function onFinish(ev: FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = "We'll put this on your reports.";
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }

    setSaving(true);
    try {
      const cleanLicenses = licenses.filter((l) => l.number.trim() || l.state.trim());
      const { data, error } = await supabase.rpc("cb_bootstrap_workspace", {
        _workspace_name: name.trim(),
        _company: {
          name: name.trim(),
          legal_name: legalName.trim() || null,
          primary_color: primaryColor,
          accent_color: accentColor,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zip: zip.trim() || null,
          license_numbers: cleanLicenses as unknown as Record<string, string>[],
        },
      });
      if (error) throw error;

      const result = (data ?? {}) as { workspace_id?: string; company_id?: string };

      // Seat count chosen on the signup screen before email confirmation.
      if (result.workspace_id) {
        try {
          const pending = Number(localStorage.getItem(CB_PENDING_SEATS_KEY) ?? "");
          if (pending > 0) {
            await supabase.rpc("cb_set_seats", { _ws: result.workspace_id, _seats: pending });
            localStorage.removeItem(CB_PENDING_SEATS_KEY);
          }
        } catch {
          /* seats can still be changed later in billing settings */
        }
      }


      if (logoFile && result.workspace_id && result.company_id) {
        try {
          const path = await cbUploadLogo(result.workspace_id, logoFile);
          await supabase.from("cb_companies").update({ logo_url: path }).eq("id", result.company_id);
        } catch {
          toast.message("Company created — the logo upload didn't stick, you can retry in settings.");
        }
      }

      const [first, ...rest] = fullName.trim().split(" ");
      await supabase
        .from("profiles")
        .update({
          first_name: first ?? null,
          last_name: rest.join(" ") || null,
          title: title.trim() || null,
          mobile_phone: cell.trim() || null,
        })
        .eq("id", user!.id);

      await refresh();
      toast.success("You're all set");
      navigate({ to: "/cb", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not finish setup");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CbSurface>
      <div
        className="min-h-screen px-5 py-10"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(var(--cb-accent-rgb), .12), transparent 55%), var(--cb-bg)",
        }}
      >
        <div className="mx-auto w-full max-w-[620px]">
          <CbCard elevation="floating" style={{ padding: 28 }}>
            <CbProgressRail steps={["Company", "You"]} current={step} />

            <div className="mt-5">
              <CbHeadline
                text={step === 0 ? "Set up your company" : "Tell us about you"}
                as="h1"
                className="cb-display"
                style={{ fontSize: 25, lineHeight: 1.15 }}
              />
              <CbReveal delay={90}>
                <p className="mb-6 mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  {step === 0
                    ? "This branding lands on every damage report and agreement you send."
                    : "Your name shows up as the rep on inspections you run."}
                </p>
              </CbReveal>
            </div>

            <form ref={formRef} onSubmit={onFinish} className="space-y-4">
              {step === 0 ? (
                <>
                  <CbField
                    label="Company name"
                    value={name}
                    error={errors.name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <CbField
                    label="Legal name (optional)"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />

                  <div>
                    <span className="cb-microlabel">Logo</span>
                    <div className="mt-2 flex items-center gap-3">
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                        style={{
                          background: "var(--cb-surface-sunken, rgba(0,0,0,.05))",
                          border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))",
                        }}
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Company logo preview" className="h-full w-full object-contain" />
                        ) : (
                          <span className="cb-microlabel">Logo</span>
                        )}
                      </div>
                      <label className="cb-btn cb-btn-secondary cb-btn-md cursor-pointer">
                        <span className="cb-btn-label">{logoFile ? "Change logo" : "Upload logo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onLogoPick(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <ColorRow label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
                    <ColorRow label="Accent color" value={accentColor} onChange={setAccentColor} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <CbField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <CbField
                      label="Email"
                      type="email"
                      value={email}
                      error={errors.email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <CbField label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  <CbField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  <div className="grid grid-cols-3 gap-3">
                    <CbField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
                    <CbField label="State" value={state} onChange={(e) => setState(e.target.value)} />
                    <CbField label="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} />
                  </div>

                  <div>
                    <span className="cb-microlabel">License numbers</span>
                    <div className="mt-2 space-y-3">
                      {licenses.map((l, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-3 gap-2">
                            <CbField
                              label="State"
                              value={l.state}
                              onChange={(e) => updateLicense(i, { state: e.target.value })}
                            />
                            <CbField
                              label="Number"
                              value={l.number}
                              onChange={(e) => updateLicense(i, { number: e.target.value })}
                            />
                            <CbField
                              label="Label"
                              value={l.label}
                              onChange={(e) => updateLicense(i, { label: e.target.value })}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="Remove license"
                            onClick={() => setLicenses((p) => p.filter((_, idx) => idx !== i))}
                            className="mt-2 flex h-11 w-11 items-center justify-center rounded-[12px]"
                            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))" }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <CbButton
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => setLicenses((p) => [...p, { state: "", number: "", label: "" }])}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Plus className="h-4 w-4" /> Add license
                        </span>
                      </CbButton>
                    </div>
                  </div>

                  <div className="cb-thumb-dock pt-3">
                    <CbButton type="button" block onClick={next}>
                      Continue
                    </CbButton>
                  </div>
                </>
              ) : (
                <>
                  <CbField
                    label="Full name"
                    value={fullName}
                    error={errors.fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <CbField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <CbField label="Cell" value={cell} onChange={(e) => setCell(e.target.value)} />

                  <div className="cb-thumb-dock flex gap-3 pt-3">
                    <CbButton
                      type="button"
                      variant="secondary"
                      onClick={() => setStep(0)}
                      disabled={saving}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back
                      </span>
                    </CbButton>
                    <CbButton type="submit" block loading={saving} loadingText="Building your workspace…">
                      Finish setup
                    </CbButton>
                  </div>
                </>
              )}
            </form>
          </CbCard>
        </div>
      </div>
    </CbSurface>
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
    <div>
      <span className="cb-microlabel">{label}</span>
      <div
        className="mt-2 flex h-[52px] items-center gap-3 rounded-[14px] px-3"
        style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-8 w-10 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <span className="cb-num text-[13px]">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}
