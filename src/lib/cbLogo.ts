import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CB_LOGO_BUCKET = "cb-logos";

/**
 * `cb-logos` is a PRIVATE bucket, so every company logo has to be read back
 * through a signed URL. This is the single helper for that — use it everywhere
 * a company logo is displayed.
 */
export async function cbLogoSignedUrl(
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data } = await supabase.storage.from(CB_LOGO_BUCKET).createSignedUrl(path, expiresIn);
  if (data?.signedUrl) return data.signedUrl;
  /* Older companies point at a site-hosted asset rather than a bucket object. */
  if (path.startsWith("/")) return path;
  if (path.includes("assets-v1") || path.startsWith("__")) return `/${path}`;
  return null;
}

/** React hook wrapper around {@link cbLogoSignedUrl}. */
export function useCbLogoUrl(path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["cb-logo", path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: () => cbLogoSignedUrl(path),
  });
  return data ?? null;
}

/** Upload a company logo and return the storage path to persist on cb_companies. */
export async function cbUploadLogo(workspaceId: string, file: File): Promise<string> {
  const path = `${workspaceId}/logo.png`;
  const { error } = await supabase.storage
    .from(CB_LOGO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });
  if (error) throw error;
  return path;
}
