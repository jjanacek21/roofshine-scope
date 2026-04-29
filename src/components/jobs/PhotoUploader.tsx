import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import exifr from "exifr";
import { toast } from "sonner";
import { Camera, Upload, Loader2 } from "lucide-react";

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

async function makeThumbnail(file: File, maxWidth = 400): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = img.height / img.width;
      const w = Math.min(maxWidth, img.width);
      const h = Math.round(w * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => {
          URL.revokeObjectURL(url);
          resolve(b);
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function PhotoUploader({ jobId }: { jobId: string }) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      if (!profile?.company_id) throw new Error("No company");
      const arr = Array.from(files);
      let succeeded = 0;
      let failed = 0;
      let index = 0;

      for (const f of arr) {
        const fileLabel = f.name || `file-${index}`;
        try {
          const heic = isHeic(f);
          const ts = Date.now();
          const rawExt = (f.name.split(".").pop() ?? "jpg").toLowerCase();
          const ext = heic ? "heic" : rawExt;
          const base = `${profile.company_id}/${jobId}/${ts}-${index}`;
          const fullPath = `${base}.${ext}`;

          // EXIF GPS extract (best-effort)
          let gps: { latitude?: number; longitude?: number } | null = null;
          let takenAt: string | null = null;
          try {
            const meta = await exifr.parse(f, {
              gps: true,
              pick: ["DateTimeOriginal", "latitude", "longitude"],
            });
            if (meta) {
              if (typeof meta.latitude === "number" && typeof meta.longitude === "number") {
                gps = { latitude: meta.latitude, longitude: meta.longitude };
              }
              if (meta.DateTimeOriginal instanceof Date) {
                takenAt = meta.DateTimeOriginal.toISOString();
              }
            }
          } catch (exifErr) {
            console.warn(`[PhotoUploader] EXIF parse failed for ${fileLabel}:`, exifErr);
          }

          // Upload full
          const contentType = heic ? "image/heic" : f.type || undefined;
          const { error: upErr } = await supabase.storage
            .from("roof-photos")
            .upload(fullPath, f, {
              cacheControl: "3600",
              upsert: false,
              contentType,
            });
          if (upErr) {
            console.error(`[PhotoUploader] Storage upload failed for ${fileLabel}:`, upErr);
            throw upErr;
          }

          // Upload thumbnail (skip for HEIC — browser can't decode)
          if (!heic) {
            try {
              const thumb = await makeThumbnail(f, 400);
              if (thumb) {
                const { error: thumbErr } = await supabase.storage
                  .from("roof-photos")
                  .upload(`${base}_thumb.jpg`, thumb, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: "image/jpeg",
                  });
                if (thumbErr) {
                  console.warn(
                    `[PhotoUploader] Thumbnail upload failed for ${fileLabel}:`,
                    thumbErr,
                  );
                }
              }
            } catch (thumbErr) {
              console.warn(`[PhotoUploader] Thumbnail generation failed for ${fileLabel}:`, thumbErr);
            }
          }

          const { error: insErr } = await supabase.from("job_photos").insert({
            job_id: jobId,
            company_id: profile.company_id,
            uploaded_by: profile.id,
            storage_path: fullPath,
            exif_gps: gps,
            taken_at: takenAt,
          });
          if (insErr) {
            console.error(`[PhotoUploader] DB insert failed for ${fileLabel}:`, insErr);
            throw insErr;
          }

          succeeded++;
        } catch (err) {
          failed++;
          console.error(`[PhotoUploader] Upload failed for ${fileLabel}:`, err);
        } finally {
          index++;
        }
      }
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded > 0 && failed === 0) {
        toast.success(
          `${succeeded} photo${succeeded === 1 ? "" : "s"} uploaded — click "Analyze property" to run AI.`,
        );
      } else if (succeeded > 0 && failed > 0) {
        toast.warning(`${succeeded} uploaded, ${failed} failed — check console for details.`);
      } else if (succeeded === 0 && failed > 0) {
        toast.error(`All ${failed} upload${failed === 1 ? "" : "s"} failed — check console for details.`);
      } else {
        toast.info("No files uploaded.");
      }
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
      qc.invalidateQueries({ queryKey: ["job-property-analysis", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) upload.mutate(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition ${
        dragging ? "border-[var(--brand)] bg-[var(--brand)]/5" : ""
      }`}
      style={{ borderColor: dragging ? undefined : "var(--border)" }}
    >
      {upload.isPending ? (
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="h-8 w-8 text-muted-foreground" />
      )}
      <p className="text-sm text-foreground">
        {upload.isPending ? "Uploading…" : "Drag & drop photos here, or"}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Photos
        </button>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)] disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          <Camera className="h-3.5 w-3.5" />
          Take Photo
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        JPG, PNG, HEIC. EXIF GPS coordinates extracted automatically.
      </p>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) upload.mutate(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) upload.mutate(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
