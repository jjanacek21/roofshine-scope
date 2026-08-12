import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CB_PHOTO_BUCKET = "cb-photos";

export interface CbPhotoMeta {
  category: string;
  elevation?: string | null;
  shot_type?: string | null;
  item_key?: string | null;
  caption?: string | null;
  lat?: number | null;
  lng?: number | null;
  taken_at?: string | null;
  /** Fixed storage filename (used for the cover shot). Otherwise generated. */
  filename?: string;
}

/** `cb-photos` is a PRIVATE bucket — every read goes through a signed URL. */
export async function cbPhotoSignedUrl(
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("blob:") || path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(CB_PHOTO_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export function useCbPhotoUrl(path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["cb-photo", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: () => cbPhotoSignedUrl(path),
  });
  return data ?? null;
}

/* ---------------- client-side compression ---------------- */

function loadBitmap(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

async function resize(img: HTMLImageElement, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not compress photo");
  return blob;
}

/** Max 2000px long edge @ ~0.8 quality, plus a 400px thumbnail. */
export async function cbCompressPhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  const img = await loadBitmap(file);
  const [full, thumb] = await Promise.all([resize(img, 2000, 0.8), resize(img, 400, 0.7)]);
  return { full, thumb };
}
