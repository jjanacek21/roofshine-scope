import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ArrowRight, Upload, Check } from "lucide-react";

export const Route = createFileRoute("/profile-setup")({
  component: ProfileSetup,
});

const STEPS = ["Photo", "About you", "Bio", "Card handle"] as const;

function ProfileSetup() {
  const { user, loading } = useAuth();
  const { data: profile, refetch } = useProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [mobile, setMobile] = useState("");
  const [office, setOffice] = useState("");
  const [bio, setBio] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">(
    "idle",
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setAvatarUrl(profile.avatar_url ?? null);
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setTitle(profile.title ?? "");
    setMobile(profile.mobile_phone ?? "");
    setOffice(profile.office_phone ?? "");
    setBio(profile.bio ?? "");
    if (profile.card_slug) setSlug(profile.card_slug);
    if (profile.onboarding_completed_at) {
      navigate({ to: "/" });
    }
  }, [profile, navigate]);

  // Auto-suggest slug from name
  useEffect(() => {
    if (!slug && (firstName || lastName)) {
      const s = `${firstName}-${lastName?.[0] ?? ""}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (s) setSlug(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName]);

  // Slug availability
  useEffect(() => {
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_card_slug_available", { _slug: slug });
      setSlugStatus(data ? "ok" : "taken");
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("rep-card-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("rep-card-assets").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
  }

  async function finish() {
    if (!user) return;
    if (slugStatus !== "ok") {
      toast.error("Pick an available card handle");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        title: title.trim() || null,
        mobile_phone: mobile.trim() || null,
        office_phone: office.trim() || null,
        bio: bio.trim() || null,
        card_slug: slug,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    await refetch();
    toast.success("Welcome aboard");
    navigate({ to: "/card" });
  }

  const canNext =
    step === 0
      ? true
      : step === 1
        ? !!firstName && !!lastName
        : step === 2
          ? true
          : slugStatus === "ok";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top right, rgba(30,144,255,.12), transparent 50%), var(--bg)",
      }}
    >
      <div
        className="w-full max-w-[640px] p-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
        }}
      >
        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold tracking-tight">{STEPS[step]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>

        <div className="mt-6">
          {step === 0 && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="h-32 w-32 overflow-hidden rounded-full border-2 border-border bg-muted"
                style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
              />
              <label className="btn-brand flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-semibold">
                <Upload className="h-4 w-4" />
                {avatarUrl ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                />
              </label>
              <p className="text-xs text-muted-foreground">Square photos work best.</p>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" required>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field-input" />
              </Field>
              <Field label="Last name" required>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="field-input" />
              </Field>
              <Field label="Title (e.g. Senior Roof Consultant)">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" />
              </Field>
              <div />
              <Field label="Mobile phone">
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="field-input" />
              </Field>
              <Field label="Office phone">
                <input value={office} onChange={(e) => setOffice(e.target.value)} className="field-input" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <textarea
                rows={6}
                value={bio}
                maxLength={500}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell homeowners a bit about yourself…"
                className="field-input resize-none"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/500</div>
            </div>
          )}

          {step === 3 && (
            <div>
              <Field label="Card handle">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/c/</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    className="field-input flex-1"
                    placeholder="jared-j"
                  />
                </div>
              </Field>
              <div className="mt-2 text-xs">
                {slugStatus === "checking" && <span className="text-muted-foreground">Checking…</span>}
                {slugStatus === "ok" && <span className="text-green-600">✓ Available — your card will live at /c/{slug}</span>}
                {slugStatus === "taken" && <span className="text-red-600">Already taken</span>}
                {slugStatus === "invalid" && (
                  <span className="text-red-600">3–40 chars, lowercase letters, numbers, dashes</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="btn-brand flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-60"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext || submitting}
              onClick={finish}
              className="btn-brand flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Finish & open my card"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
