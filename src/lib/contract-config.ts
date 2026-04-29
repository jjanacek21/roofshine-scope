// Default base URL of the signing app. Same-origin under /sign so the iframe
// has no CORS / X-Frame-Options issues. Tenants can override via tenants.sign_base_url.
export const SIGN_BASE_URL = "/sign";

// Filenames produced by the signing app, e.g. GCN-RC-260101-X4Y7.pdf
// (RC = residential construction, IC = insurance contingency)
export const DOCUMENT_ID_RE = /^(GCN-(RC|IC)-\d{6}-[A-Z0-9]+)\.pdf$/i;

export function parseContractFilename(filename: string): {
  documentId: string;
  contractType: "residential" | "insurance";
} | null {
  const m = filename.match(DOCUMENT_ID_RE);
  if (!m) return null;
  const documentId = m[1].toUpperCase();
  const contractType = m[2].toUpperCase() === "RC" ? "residential" : "insurance";
  return { documentId, contractType };
}

export function buildSigningUrl(params: {
  rep: string;
  type: "residential" | "insurance";
  jobId: string;
  tenantId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  propertyAddress?: string | null;
  baseUrl?: string | null;
}): string {
  const qs = new URLSearchParams();
  qs.set("rep", params.rep);
  qs.set("type", params.type);
  qs.set("jobId", params.jobId);
  qs.set("tenantId", params.tenantId);
  if (params.customerName) qs.set("customerName", params.customerName);
  if (params.customerPhone) qs.set("customerPhone", params.customerPhone);
  if (params.customerEmail) qs.set("customerEmail", params.customerEmail);
  if (params.propertyAddress) qs.set("propertyAddress", params.propertyAddress);
  const base = (params.baseUrl?.trim() || SIGN_BASE_URL).replace(/\/$/, "");
  return `${base}/GCN-Sign.html?${qs.toString()}`;
}
