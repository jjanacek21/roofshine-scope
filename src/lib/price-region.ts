// Maps a job's ZIP / state to the market price book it should use.
// Illinois  -> "Chicago"
// South FL  -> "South Florida" (Miami-Dade, Broward, Palm Beach + Treasure Coast)
export type MarketRegion = "Chicago" | "South Florida";

const SOUTH_FL_PREFIXES = ["330", "331", "332", "333", "334", "349"];

export function regionForZip(zip?: string | null, state?: string | null): MarketRegion | null {
  const z = (zip ?? "").replace(/\D/g, "").slice(0, 5);
  const st = (state ?? "").trim().toUpperCase();

  if (st === "IL" || st === "ILLINOIS") return "Chicago";
  if (z.length >= 3) {
    const n = Number(z.slice(0, 3));
    if (n >= 600 && n <= 629) return "Chicago";
    if (SOUTH_FL_PREFIXES.includes(z.slice(0, 3))) return "South Florida";
  }
  if (st === "FL" || st === "FLORIDA") return "South Florida";
  return null;
}

/** Region inferred from a free-text address (used when no structured zip exists). */
export function regionForAddress(address?: string | null): MarketRegion | null {
  if (!address) return null;
  const zip = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
  const state = /\b(IL|illinois)\b/i.test(address)
    ? "IL"
    : /\b(FL|florida)\b/i.test(address)
      ? "FL"
      : null;
  return regionForZip(zip, state);
}
