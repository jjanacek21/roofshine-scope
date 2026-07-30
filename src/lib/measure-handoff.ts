/**
 * Bridges the AI (Solar) tab and the Mapbox redraw tab so that whatever the
 * user draws by hand can be paired with what the AI produced. That pair is the
 * training signal the AI Training Center reviews.
 */

export type HandoffFacet = {
  ring: number[][];
  pitch: string;
  plan_area_sqft: number;
};

export type MeasureHandoff = {
  property_id: string;
  run_id: string | null;
  lat: number;
  lng: number;
  total_plan_sqft: number;
  facets: HandoffFacet[];
  created_at: number;
};

const KEY = "gcn:measure-handoff";
/** Handoffs older than this are stale and ignored. */
const MAX_AGE_MS = 1000 * 60 * 60 * 6;

export function setMeasureHandoff(h: Omit<MeasureHandoff, "created_at">) {
  if (typeof window === "undefined") return;
  try {
    const payload: MeasureHandoff = { ...h, created_at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // storage unavailable — training capture is best-effort
  }
}

export function getMeasureHandoff(propertyId: string | null): MeasureHandoff | null {
  if (typeof window === "undefined" || !propertyId) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as MeasureHandoff;
    if (h.property_id !== propertyId) return null;
    if (Date.now() - h.created_at > MAX_AGE_MS) return null;
    return h;
  } catch {
    return null;
  }
}

export function clearMeasureHandoff() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
