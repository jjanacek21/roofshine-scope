import { useRef, useState } from "react";
import { Upload, Trash2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a company logo file (preferred) with an optional URL fallback.
 * Files land in the public `rep-card-assets` bucket so reports, estimates,
 * invoices and contracts can render them directly.
 */
export function CompanyLogoUploader({
  companyId,
  userId,
  value,
  onChange,
  label = "Company logo",
}: {
  companyId: string;
  userId: string | null;
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!userId) return toast.error("Not signed in");
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Logo must be under 5 MB");
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/company-logos/${companyId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("rep-card-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("rep-card-assets").getPublicUrl(path);
    setUrlDraft(data.publicUrl);
    await onChange(data.publicUrl);
    toast.success("Logo uploaded");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-start gap-4">
        {value ? (
          <img
            src={value}
            alt="Company logo"
            className="h-20 w-20 rounded-md border border-border bg-background object-contain p-1"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-muted-foreground">
            No logo
          </div>
        )}

        <div
          className="flex-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
            </button>
            {value && (
              <button
                type="button"
                onClick={async () => {
                  setUrlDraft("");
                  await onChange(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUrl((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link2 className="h-3.5 w-3.5" /> {showUrl ? "Hide URL" : "Use a URL"}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />

          {showUrl && (
            <div className="mt-2 flex gap-2">
              <input
                className="field-input flex-1"
                placeholder="https://…/logo.png"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
              <button
                type="button"
                onClick={() => onChange(urlDraft.trim() || null)}
                className="rounded-md border border-border px-3 text-sm font-medium hover:bg-accent"
              >
                Apply
              </button>
            </div>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            PNG with a transparent background works best. Used on this company's estimates,
            reports, invoices and contracts.
          </p>
        </div>
      </div>
    </div>
  );
}
