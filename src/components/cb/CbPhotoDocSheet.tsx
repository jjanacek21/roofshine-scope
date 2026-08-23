import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cbPhotoSignedUrl } from "@/lib/cbPhotos";
import { CB_ELEVATION_LABEL, type CbElevation } from "@/lib/cbTakeoff";

type Row = {
  id: string;
  category: string | null;
  elevation: string | null;
  shot_type: string | null;
  caption: string | null;
  storage_path: string | null;
};

function label(p: Row): string {
  const el = p.elevation ? (CB_ELEVATION_LABEL[p.elevation as CbElevation] ?? p.elevation) : null;
  const parts = [el, p.shot_type, p.caption].filter(Boolean) as string[];
  if (parts.length) return parts.join(" · ");
  return p.category || "Untagged";
}

/** Photo documentation grid — the same layout as the GlobalContractor report. */
export function CbPhotoDocSheet({ jobId }: { jobId: string }) {
  const { data: photos, isLoading } = useQuery({
    queryKey: ["cb-photo-doc", jobId],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_photos")
        .select("id, category, elevation, shot_type, caption, storage_path, sort_order")
        .eq("job_id", jobId)
        .order("sort_order", { ascending: true });
      const rows = (data ?? []) as (Row & { sort_order: number })[];
      return Promise.all(
        rows.map(async (p) => ({ ...p, url: await cbPhotoSignedUrl(p.storage_path) })),
      );
    },
  });

  return (
    <div
      className="est-page mx-auto w-full max-w-[1100px] rounded-2xl bg-white p-5 sm:p-8"
      style={{ boxShadow: "0 10px 40px rgba(15,23,42,.08)" }}
    >
      <h3 className="cb-display text-[22px] font-bold text-neutral-900 sm:text-[26px]">
        Photo Documentation
      </h3>
      <div className="mt-3 h-[2px] w-full bg-neutral-900" />

      {isLoading ? (
        <p className="mt-6 text-[13px] text-neutral-500">Loading photos…</p>
      ) : !photos?.length ? (
        <p className="mt-6 text-[13px] text-neutral-500">No photos on this inspection yet.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <figure key={p.id} className="m-0">
              {p.url ? (
                <img
                  src={p.url}
                  alt={label(p)}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-xl border border-neutral-200 object-cover"
                />
              ) : (
                <div className="aspect-[4/3] w-full rounded-xl border border-neutral-200 bg-neutral-50" />
              )}
              <figcaption className="mt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                {label(p)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
