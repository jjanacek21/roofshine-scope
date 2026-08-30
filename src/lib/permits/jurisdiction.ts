import { permitDepartments, type PermitDepartment } from "./db";

/**
 * Which building department has jurisdiction over this address.
 *
 * Florida permits are pulled from the city when the property sits inside city
 * limits and from the county when it does not, so the match runs narrowest
 * first: an explicit ZIP list beats a city-name match, and a city beats the
 * county. Nothing here guesses — if no department claims the address we say so
 * and let the user pick, because filing with the wrong jurisdiction costs weeks.
 */

export interface JurisdictionMatch {
  department: PermitDepartment;
  /** How we arrived at it, shown to the user so a wrong guess is obvious. */
  basis: "zip" | "city" | "county";
  confident: boolean;
}

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\b(city|town|village) of\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function loadDepartments(): Promise<PermitDepartment[]> {
  const { data, error } = await permitDepartments()
    .select("id, name, jurisdiction_type, county, city, website, portal_url, submission_method, zip_codes, is_hvhz")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export function matchJurisdiction(
  departments: PermitDepartment[],
  property: { city?: string | null; zip?: string | null; county?: string | null },
): JurisdictionMatch | null {
  const zip = String(property.zip ?? "").trim().slice(0, 5);
  const city = norm(property.city);
  const county = norm(property.county);

  /* A department that names this ZIP has said so itself — trust it first. */
  if (zip) {
    const byZip = departments.filter((d) => (d.zip_codes ?? []).includes(zip));
    /* Prefer a city department over the county when both claim the ZIP: inside
       city limits, the city issues the permit. */
    const cityFirst =
      byZip.find((d) => d.jurisdiction_type === "city" && (!city || norm(d.city) === city)) ??
      byZip.find((d) => d.jurisdiction_type === "city") ??
      byZip[0];
    if (cityFirst) {
      return { department: cityFirst, basis: "zip", confident: byZip.length === 1 || Boolean(city) };
    }
  }

  if (city) {
    const byCity = departments.filter((d) => norm(d.city) === city);
    if (byCity.length) {
      return { department: byCity[0], basis: "city", confident: byCity.length === 1 };
    }
  }

  /* Falling back to the county is right for unincorporated addresses and wrong
     inside a city we have not loaded yet, so it is never marked confident. */
  if (county) {
    const byCounty = departments.find(
      (d) => d.jurisdiction_type === "county" && norm(d.county) === county,
    );
    if (byCounty) return { department: byCounty, basis: "county", confident: false };
  }

  return null;
}

/**
 * The county a ZIP belongs to, for the fallback above. Only the counties this
 * app has departments for — anything else returns null rather than a guess.
 */
export function countyFromDepartments(
  departments: PermitDepartment[],
  zip: string | null | undefined,
): string | null {
  const z = String(zip ?? "").trim().slice(0, 5);
  if (!z) return null;
  const hit = departments.find((d) => (d.zip_codes ?? []).includes(z));
  return hit?.county ?? null;
}
