// Public production host for shareable card URLs.
// QR codes and share links MUST point here, not at the editor preview
// (which is gated behind a Lovable login).
const PUBLIC_HOST = "https://globalcontractor.app";

function isPublicHost(host: string): boolean {
  if (host === "globalcontractor.app" || host === "www.globalcontractor.app") return true;
  if (host === "roofshine-scope.lovable.app") return true;
  return false;
}

export function getPublicCardUrl(slug: string | null | undefined): string {
  if (!slug) return "";
  if (typeof window === "undefined") return `${PUBLIC_HOST}/c/${slug}`;
  const host = window.location.hostname;
  if (isPublicHost(host)) return `${window.location.origin}/c/${slug}`;
  return `${PUBLIC_HOST}/c/${slug}`;
}
