import logoAsset from "@/assets/roof-king-logo.png.asset.json";

export const RK_BRAND = {
  name: "Roof King",
  tagline: "Roofing That Stands Up To Mother Nature",
  address: "1913 NW 18th St. Suite 2",
  cityStateZip: "Pompano Beach, FL 33069",
  phone: "954-782-3002",
  email: "",
  website: "",
  logoUrl: logoAsset.url,
};

/**
 * Fetch the Roof King logo and return a data URL suitable for jsPDF.addImage.
 * Returns null on failure so callers can fall back to a text-only header.
 */
export async function loadRKLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(RK_BRAND.logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
