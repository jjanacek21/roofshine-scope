import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { generateStormMailer } from "@/lib/storm-mailer.functions";
import { MAILER_IMAGE_BUCKET, MAILER_TONES, STORM_TYPES, type RoofMath } from "@/lib/storm-config";

type Props = {
  open: boolean;
  onClose: () => void;
  address: string;
  lat: number;
  lng: number;
  propertyId: string | null;
  roofType: string | null;
  math: RoofMath | null;
  stormReport: any | null;
};

export function StormMailerModal({
  open,
  onClose,
  address,
  lat,
  lng,
  propertyId,
  roofType,
  math,
  stormReport,
}: Props) {
  const { data: profile } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stormType, setStormType] = useState<(typeof STORM_TYPES)[number]>("hail");
  const [tone, setTone] = useState<string>(MAILER_TONES[1]);
  const [topic, setTopic] = useState("");
  const [sigType, setSigType] = useState<"personal" | "company">("personal");
  const [images, setImages] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: company } = useQuery({
    queryKey: ["mailer-company", profile?.company_id],
    enabled: !!profile?.company_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, phone, email, website, license_number, logo_url")
        .eq("id", profile!.company_id!)
        .maybeSingle();
      return data;
    },
  });

  const signaturePayload = useMemo(() => {
    if (sigType === "company") {
      return {
        company_name: company?.name ?? "",
        phone: company?.phone ?? "",
        email: company?.email ?? "",
        website: company?.website ?? "",
        license: (company as any)?.license_number ?? "",
      };
    }
    return {
      name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
      title: profile?.title ?? "",
      phone: profile?.mobile_phone ?? profile?.office_phone ?? "",
      email: profile?.email ?? "",
      company_name: company?.name ?? "",
    };
  }, [sigType, company, profile]);

  const generateFn = useServerFn(generateStormMailer);

  const gen = useMutation({
    mutationFn: async () => {
      const res: any = await generateFn({
        data: {
          property_id: propertyId,
          address,
          lat,
          lng,
          roof_type: roofType,
          squares: math?.squares ?? null,
          storm_type: stormType,
          storm_report: stormReport ?? null,
          tone,
          prompt_input: topic,
          image_urls: images.map((i) => i.path),
          signature_type: sigType,
          signature_payload: signaturePayload,
          save: true,
        },
      });
      if (!res?.ok) throw new Error(res?.error ?? "Generation failed");
      return res;
    },
    onSuccess: (res: any) => {
      setSubject(res.subject);
      setBody(res.body);
      toast.success("Letter generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !profile?.company_id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const path = `${profile.company_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(MAILER_IMAGE_BUCKET).upload(path, file);
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from(MAILER_IMAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);
        setImages((prev) => [...prev, { path, url: signed?.signedUrl ?? "" }]);
      }
    } finally {
      setUploading(false);
    }
  }

  function print() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    const sigLines =
      sigType === "company"
        ? [company?.name, company?.phone, company?.email, company?.website].filter(Boolean)
        : [
            signaturePayload.name,
            (signaturePayload as any).title,
            signaturePayload.phone,
            signaturePayload.email,
            company?.name,
          ].filter(Boolean);
    w.document.write(`<!doctype html><html><head><title>${subject}</title>
      <style>
        @page { size: letter; margin: 0.85in; }
        body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.55; color:#111; }
        h1 { font-size: 15pt; margin: 0 0 18px; }
        .addr { font-size: 10.5pt; color:#555; margin-bottom: 22px; }
        p { margin: 0 0 12px; white-space: pre-wrap; }
        .imgs { display:flex; gap:8px; margin:18px 0; }
        .imgs img { max-width: 45%; border:1px solid #ddd; }
        .sig { margin-top: 26px; font-size: 11pt; }
        .logo { max-height: 60px; margin-bottom: 14px; }
      </style></head><body>
      ${company?.logo_url ? `<img class="logo" src="${company.logo_url}" />` : ""}
      <div class="addr">${address}</div>
      <h1>${subject}</h1>
      ${body
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`)
        .join("")}
      ${images.length ? `<div class="imgs">${images.map((i) => `<img src="${i.url}" />`).join("")}</div>` : ""}
      <div class="sig">${sigLines.join("<br/>")}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <header
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-sm font-semibold text-foreground">Storm mailer · {address}</div>
          <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
          {/* Controls */}
          <div className="space-y-3 text-xs">
            <Field label="Storm type">
              <select
                value={stormType}
                onChange={(e) => setStormType(e.target.value as any)}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                {STORM_TYPES.map((s) => (
                  <option key={s} value={s} className="bg-neutral-900">
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                {MAILER_TONES.map((t) => (
                  <option key={t} value={t} className="bg-neutral-900">
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="What should this letter be about?">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={4}
                placeholder="e.g. we're inspecting roofs on this street this week, mention our 10-year workmanship warranty"
                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-foreground"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>

            <Field label="Sign as">
              <div className="flex gap-2">
                {(["personal", "company"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSigType(t)}
                    className="flex-1 rounded-md border px-2 py-1.5 capitalize"
                    style={{
                      borderColor: sigType === t ? "var(--brand, #2563eb)" : "var(--border)",
                      color: sigType === t ? "var(--brand, #60a5fa)" : undefined,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Images (optional)">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5"
                style={{ borderColor: "var(--border)" }}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Upload
              </button>
              {images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {images.map((i) => (
                    <img key={i.path} src={i.url} alt="" className="h-14 w-14 rounded object-cover" />
                  ))}
                </div>
              )}
            </Field>

            <button
              type="button"
              onClick={() => gen.mutate()}
              disabled={gen.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold disabled:opacity-60"
              style={{ background: "var(--brand, #2563eb)", color: "#fff" }}
            >
              {gen.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {body ? "Regenerate letter" : "Generate letter"}
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-2 text-xs">
            <Field label="Subject">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-foreground"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
            <Field label="Letter">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                placeholder="Generated letter appears here — edit freely before printing."
                className="w-full rounded-md border bg-transparent px-2 py-1.5 font-serif text-foreground"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
            <button
              type="button"
              onClick={print}
              disabled={!body.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-2 font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium opacity-80">{label}</span>
      {children}
    </label>
  );
}
