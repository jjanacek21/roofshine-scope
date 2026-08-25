/**
 * Florida statewide parcel lookup — free, public, no API key.
 *
 * Source: the Florida Department of Revenue assessment roll (the NAL file),
 * published as a queryable ArcGIS feature service covering all 67 counties.
 * It is the same data every county property appraiser publishes, already
 * normalised into one schema, and it costs nothing to query.
 *
 *   https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0
 *
 * What we get for free, per parcel:
 *   - owner name and owner MAILING address (differs from the house => absentee)
 *   - homestead exemption (owner-occupied vs investment property)
 *   - year built, effective year built, heated area, number of buildings
 *   - land use code and just value
 *   - sale price and year, but only on roughly 1 parcel in 10: the GIS join
 *     leaves SALE_* zeroed for most records. Absence is not "never sold".
 *
 * What we do NOT get and would have to buy: resident phone numbers and email
 * addresses. This module deliberately stops at public record.
 *
 * Point queries return in roughly 300-500ms warm. Do not use this service to
 * bulk-load a viewport: a 460-parcel envelope query took 23 seconds in testing
 * and a 2,000-parcel one timed out. One parcel per tap, cached, is the pattern.
 */

const SERVICE =
  "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query";

/** Fields we actually read. Asking for fewer keeps the response small and fast. */
const OUT_FIELDS = [
  "PARCEL_ID",
  "CO_NO",
  "OWN_NAME",
  "OWN_ADDR1",
  "OWN_ADDR2",
  "OWN_CITY",
  "OWN_STATE",
  "OWN_STATE_",
  "OWN_ZIPCD",
  "PHY_ADDR1",
  "PHY_ADDR2",
  "PHY_CITY",
  "PHY_ZIPCD",
  "ACT_YR_BLT",
  "EFF_YR_BLT",
  "TOT_LVG_AR",
  "NO_BULDNG",
  "NO_RES_UNT",
  "LND_SQFOOT",
  "DOR_UC",
  "JV",
  "JV_HMSTD",
  "AV_HMSTD",
  "LND_VAL",
  "SALE_PRC1",
  "SALE_YR1",
  "SALE_MO1",
  "SALE_PRC2",
  "SALE_YR2",
  "SALE_MO2",
  "ASMNT_YR",
  "S_LEGAL",
].join(",");

/** Rough Florida bounding box — skips a pointless round trip outside the state. */
const FL_BOUNDS = { minLat: 24.3, maxLat: 31.1, minLng: -87.7, maxLng: -79.8 };

export function isInFlorida(lat: number, lng: number): boolean {
  return (
    lat >= FL_BOUNDS.minLat &&
    lat <= FL_BOUNDS.maxLat &&
    lng >= FL_BOUNDS.minLng &&
    lng <= FL_BOUNDS.maxLng
  );
}

/* ────────────────────────── DOR land use codes ────────────────────────── */

export const DOR_USE_CODES: Record<string, string> = {
  "000": "Vacant residential",
  "001": "Single family",
  "002": "Mobile home",
  "003": "Multi-family — 10+ units",
  "004": "Condominium",
  "005": "Cooperative",
  "006": "Retirement home",
  "007": "Misc. residential",
  "008": "Multi-family — under 10 units",
  "009": "Residential common area",
  "010": "Vacant commercial",
  "011": "Store, one story",
  "012": "Mixed use — store/office/residential",
  "013": "Department store",
  "014": "Supermarket",
  "015": "Regional shopping center",
  "016": "Community shopping center",
  "017": "Office, one story",
  "018": "Office, multi-story",
  "019": "Professional services building",
  "020": "Airport / terminal / marina",
  "021": "Restaurant",
  "022": "Drive-in restaurant",
  "023": "Financial institution",
  "024": "Insurance company office",
  "025": "Repair service shop",
  "026": "Service station",
  "027": "Auto sales / repair / storage",
  "028": "Parking lot / mobile home park",
  "029": "Wholesale outlet",
  "030": "Florist / greenhouse",
  "031": "Drive-in theater / open stadium",
  "032": "Enclosed theater / auditorium",
  "033": "Nightclub / bar",
  "034": "Bowling alley / skating rink",
  "035": "Tourist attraction",
  "036": "Camp",
  "037": "Race track",
  "038": "Golf course",
  "039": "Hotel / motel",
  "040": "Vacant industrial",
  "041": "Light manufacturing",
  "042": "Heavy industrial",
  "043": "Lumber yard / sawmill",
  "044": "Packing plant",
  "045": "Cannery / bottler / brewery",
  "046": "Food processing",
  "047": "Mineral processing",
  "048": "Warehouse / distribution terminal",
  "049": "Open storage",
  "050": "Improved agricultural",
  "070": "Vacant institutional",
  "071": "Church",
  "072": "Private school or college",
  "073": "Private hospital",
  "074": "Home for the aged",
  "075": "Orphanage / charitable service",
  "076": "Mortuary / cemetery",
  "077": "Club / lodge / union hall",
  "078": "Convalescent or rest home",
  "079": "Cultural facility",
  "081": "Military",
  "082": "Forest / park / recreation",
  "083": "Public county school",
  "084": "College",
  "085": "Hospital",
  "086": "County government",
  "087": "State government",
  "088": "Federal government",
  "089": "Municipal",
  "090": "Leasehold interest",
  "091": "Utility",
  "092": "Mining / petroleum / gas land",
  "093": "Subsurface rights",
  "094": "Right of way",
  "095": "River / lake / submerged land",
  "096": "Sewage / solid waste / waste land",
  "097": "Outdoor recreation / parkland",
  "098": "Centrally assessed",
  "099": "Acreage, not agricultural",
};

export function describeUseCode(code?: string | null): string | null {
  if (!code) return null;
  const key = String(code).padStart(3, "0");
  return DOR_USE_CODES[key] ?? `Use code ${key}`;
}

/** 000-009 are the residential band; 010-049 commercial and industrial. */
export function isResidentialUse(code?: string | null): boolean {
  const n = Number(code);
  return Number.isFinite(n) && n >= 0 && n <= 9;
}
export function isCommercialUse(code?: string | null): boolean {
  const n = Number(code);
  return Number.isFinite(n) && n >= 10 && n <= 49;
}

/* ───────────────────────────── normalising ───────────────────────────── */

/** Words that must stay upper-case when we title-case a roll name. */
const KEEP_UPPER = new Set([
  "LLC",
  "INC",
  "LP",
  "LLP",
  "LTD",
  "PA",
  "PLLC",
  "PC",
  "CO",
  "CORP",
  "II",
  "III",
  "IV",
  "VI",
  "VII",
  "VIII",
  "IX",
  "XI",
  "XII",
  "USA",
  "US",
  "NA",
  "DBA",
  "MD",
  "DDS",
  "CPA",
  "HOA",
  "POA",
  "&",
]);

/** The roll stores everything upper-case. Make it readable without mangling entities. */
export function titleCaseName(raw?: string | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[.,]/g, "").toUpperCase();
      if (KEEP_UPPER.has(bare)) return word.toUpperCase();
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Owner-name parsing, built against real roll output rather than guesswork.
 *
 * Every county submits its own name convention and the state does not
 * normalise them. Verified samples:
 *
 *   Broward (16)       SMITH,JOHN A        · GAUTHIER,ERIC JOHN H/E
 *   Miami-Dade (23)    JOHN A SMITH        · CARLOS I FERNANDEZ &W MARIA F
 *   Hillsborough (39)  SMITH JOHN A        · LARA CARLOS E SR TRUSTEE
 *   Palm Beach (60)    SMITH JOHN A &      · MASSIMINO ANTHONY TRUST &
 *   Orange (58)        SMITH JOHN A        · LEGLER ROBERT C JR
 *   Duval (26)         SMITH JOHN A        · DAVY QUENTIN ANDRE ET AL
 *
 * So: a comma always means surname-first. Without a comma, everyone we have
 * sampled is surname-first EXCEPT Miami-Dade, which writes natural order.
 */
const ENTITY_HINT =
  /\b(LLC|L L C|INC|CORP|CO|LP|LLP|LTD|PLLC|TRUST|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|PROPERTY|ASSOCIATES|ASSOC|VENTURES|GROUP|ENTERPRISES|INVESTMENTS|INVESTMENT|REALTY|CHURCH|MINISTRIES|BANK|CITY|COUNTY|STATE|AUTHORITY|DISTRICT|ASSN|ASSOCIATION|FOUNDATION|MANAGEMENT|CAPITAL|EQUITIES|HOMES|DEVELOPMENT|BUILDERS|FARMS|RANCH|SCHOOL|HOSPITAL|CLUB)\b/i;

/** Counties whose roll writes names in natural order (first name first). */
const NATURAL_ORDER_COUNTIES = new Set([23]); // Miami-Dade

/** Tenancy, estate and trustee markers — not part of anybody's name. */
const NOISE_TOKENS = new Set([
  "H/E",
  "H/W",
  "W/H",
  "HE",
  "LE",
  "LF",
  "EST",
  "ESTATE",
  "TRUSTEE",
  "TRUSTEES",
  "TRUST",
  "TR",
  "TRS",
  "ETAL",
  "AL",
  "ET",
  "REV",
  "REVOCABLE",
  "LIVING",
  "LIFE",
  "JT",
  "JTWROS",
  "TEN",
  "TENANTS",
  "&W",
  "&H",
  "%",
]);

/** Generational suffixes — keep these, they belong to the person. */
const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

export interface OwnerName {
  /** Exactly as printed on the roll, upper-case. */
  raw: string;
  /** Readable, correctly ordered. For a person "John A Smith"; for an entity the entity name. */
  display: string;
  first: string | null;
  last: string | null;
  isEntity: boolean;
  /**
   * How much to trust `first` / `last`.
   *  high   — a comma made the order explicit, or the county's order is known
   *  low    — we had to assume surname-first
   * Show the display name freely; treat a low-confidence first name as a guess.
   */
  confidence: "high" | "low";
}

const EMPTY_NAME: OwnerName = {
  raw: "",
  display: "",
  first: null,
  last: null,
  isEntity: false,
  confidence: "low",
};

export function parseOwnerName(raw?: string | null, countyNo?: number | null): OwnerName {
  const clean = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!clean) return EMPTY_NAME;

  if (ENTITY_HINT.test(clean)) {
    return {
      raw: clean,
      display: titleCaseName(clean.replace(/\s*&\s*$/, "")),
      first: null,
      last: null,
      isEntity: true,
      confidence: "high",
    };
  }

  /* Drop a co-owner clause: "SMITH JOHN & MARY", "FERNANDEZ &W MARIA F", trailing "&". */
  const primary = clean
    .split(/\s*&\s*/)[0]
    .replace(/\s*&\s*$/, "")
    .trim();

  const hasComma = primary.includes(",");
  const [beforeComma, afterComma] = hasComma
    ? [primary.slice(0, primary.indexOf(",")), primary.slice(primary.indexOf(",") + 1)]
    : ["", ""];

  const strip = (tokens: string[]) => {
    const kept: string[] = [];
    let suffix: string | null = null;
    for (const t of tokens) {
      const bare = t.replace(/[.,]/g, "").toUpperCase();
      if (SUFFIXES.has(bare)) {
        suffix = bare;
        continue;
      }
      if (NOISE_TOKENS.has(bare)) continue;
      kept.push(t);
    }
    return { kept, suffix };
  };

  let lastTok: string | null = null;
  let firstTok: string | null = null;
  let middle: string[] = [];
  let confidence: OwnerName["confidence"] = "low";

  if (hasComma) {
    /* "SMITH,JOHN A" — unambiguous. */
    const { kept: lastParts } = strip(beforeComma.split(" ").filter(Boolean));
    const { kept: restParts, suffix } = strip(afterComma.split(" ").filter(Boolean));
    lastTok = [lastParts.join(" "), suffix].filter(Boolean).join(" ") || null;
    firstTok = restParts[0] ?? null;
    middle = restParts.slice(1);
    confidence = "high";
  } else {
    const { kept, suffix } = strip(primary.split(" ").filter(Boolean));
    if (kept.length === 0) return { ...EMPTY_NAME, raw: clean, display: titleCaseName(clean) };
    if (kept.length === 1) {
      lastTok = [kept[0], suffix].filter(Boolean).join(" ");
      confidence = "low";
    } else if (countyNo != null && NATURAL_ORDER_COUNTIES.has(countyNo)) {
      /* "JOHN A SMITH" — surname last. */
      firstTok = kept[0];
      middle = kept.slice(1, -1);
      lastTok = [kept[kept.length - 1], suffix].filter(Boolean).join(" ");
      confidence = "high";
    } else {
      /* "SMITH JOHN A" — surname first, the majority convention. */
      lastTok = [kept[0], suffix].filter(Boolean).join(" ");
      firstTok = kept[1] ?? null;
      middle = kept.slice(2);
      confidence = countyNo != null ? "high" : "low";
    }
  }

  const display =
    titleCaseName([firstTok, ...middle, lastTok].filter(Boolean).join(" ")) || titleCaseName(clean);

  return {
    raw: clean,
    display,
    first: firstTok ? titleCaseName(firstTok) : null,
    last: lastTok ? titleCaseName(lastTok) : null,
    isEntity: false,
    confidence,
  };
}

/* ─────────────────────────────── the record ─────────────────────────────── */

export interface FlParcel {
  parcelId: string;
  countyNo: number | null;

  owner: OwnerName;
  ownerMailing: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    /** One-line form, or null when the roll has no mailing address. */
    full: string | null;
  };

  situs: {
    line1: string | null;
    city: string | null;
    zip: string | null;
    full: string | null;
  };

  useCode: string | null;
  useLabel: string | null;
  residential: boolean;
  commercial: boolean;

  yearBuilt: number | null;
  /** Effective year built. Higher than actual means major work was permitted. */
  effectiveYearBuilt: number | null;
  /** effectiveYearBuilt - yearBuilt. A positive gap is a renovation signal. */
  improvementGap: number | null;
  heatedAreaSqFt: number | null;
  buildings: number | null;
  residentialUnits: number | null;
  landSqFt: number | null;

  justValue: number | null;
  landValue: number | null;
  /** Roll year the values come from. */
  assessmentYear: number | null;

  /** True when a homestead exemption is on the parcel — owner lives there. */
  homestead: boolean;
  /**
   * True when the owner's mailing address is not this house.
   * Absentee owner: a rental, a second home, or an investor.
   */
  absentee: boolean;

  lastSale: { price: number; year: number; month: number | null } | null;
  priorSale: { price: number; year: number; month: number | null } | null;

  legal: string | null;

  /** WGS84 polygon rings, only when the caller asked for geometry. */
  rings: [number, number][][] | null;
}

type Attrs = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const str = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

function sale(price: unknown, year: unknown, month: unknown) {
  const p = num(price);
  const y = num(year);
  if (!y || y < 1900) return null;
  return { price: p ?? 0, year: y, month: num(month) };
}

function normalise(a: Attrs, rings: [number, number][][] | null): FlParcel {
  const mail1 = str(a.OWN_ADDR1);
  const mailCity = str(a.OWN_CITY);
  const mailState = str(a.OWN_STATE) ?? str(a.OWN_STATE_);
  const mailZip = num(a.OWN_ZIPCD) ? String(num(a.OWN_ZIPCD)).padStart(5, "0") : null;

  const situs1 = str(a.PHY_ADDR1);
  const situsCity = str(a.PHY_CITY);
  const situsZip = num(a.PHY_ZIPCD) ? String(num(a.PHY_ZIPCD)).padStart(5, "0") : null;

  const useCode = str(a.DOR_UC) ? String(a.DOR_UC).trim().padStart(3, "0") : null;
  const actual = num(a.ACT_YR_BLT);
  const effective = num(a.EFF_YR_BLT);

  const homestead = !!(num(a.JV_HMSTD) || num(a.AV_HMSTD));

  /*
   * Absentee = the owner's mail goes somewhere other than this building.
   * Two traps: a condo owner's mailing line is the same street plus a unit
   * ("833 NE 18 CT" vs "833 NE 18 CT #7"), and a homestead exemption is proof
   * the owner lives there regardless of how the mailing line is written.
   */
  const streetKey = (s: string | null) =>
    (s ?? "")
      .toUpperCase()
      .replace(/\b(APT|UNIT|STE|SUITE|BLDG|LOT|#)\s*[\w-]*/g, "")
      .replace(/[^A-Z0-9]/g, "");
  const mailKey = streetKey(mail1);
  const situsKey = streetKey(situs1);
  const sameStreet =
    !!mailKey &&
    !!situsKey &&
    (mailKey === situsKey || mailKey.startsWith(situsKey) || situsKey.startsWith(mailKey));
  const absentee = !homestead && !!mail1 && !!situs1 && !sameStreet;

  const countyNo = num(a.CO_NO);

  return {
    parcelId: String(a.PARCEL_ID ?? "").trim(),
    countyNo,

    owner: parseOwnerName(a.OWN_NAME as string, countyNo),
    ownerMailing: {
      line1: mail1,
      line2: str(a.OWN_ADDR2),
      city: mailCity,
      state: mailState,
      zip: mailZip,
      full: mail1
        ? [mail1, str(a.OWN_ADDR2), [mailCity, mailState].filter(Boolean).join(", "), mailZip]
            .filter(Boolean)
            .join(" · ")
        : null,
    },

    situs: {
      line1: situs1,
      city: situsCity,
      zip: situsZip,
      full: situs1 ? [situs1, situsCity, situsZip].filter(Boolean).join(", ") : null,
    },

    useCode,
    useLabel: describeUseCode(useCode),
    residential: isResidentialUse(useCode),
    commercial: isCommercialUse(useCode),

    yearBuilt: actual,
    effectiveYearBuilt: effective,
    improvementGap: actual && effective && effective > actual ? effective - actual : null,
    heatedAreaSqFt: num(a.TOT_LVG_AR),
    buildings: num(a.NO_BULDNG),
    residentialUnits: num(a.NO_RES_UNT),
    landSqFt: num(a.LND_SQFOOT),

    justValue: num(a.JV),
    landValue: num(a.LND_VAL),
    assessmentYear: num(a.ASMNT_YR),

    homestead,
    absentee,

    lastSale: sale(a.SALE_PRC1, a.SALE_YR1, a.SALE_MO1),
    priorSale: sale(a.SALE_PRC2, a.SALE_YR2, a.SALE_MO2),

    legal: str(a.S_LEGAL),

    rings,
  };
}

/* ─────────────────────────────── the query ─────────────────────────────── */

interface ArcgisResponse {
  error?: { code?: number; message?: string; details?: string[] };
  features?: { attributes?: Attrs; geometry?: { rings?: [number, number][][] } }[];
}

export class ParcelLookupError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ParcelLookupError";
  }
}

export interface LookupOptions {
  /** Ask for the parcel outline so the map can draw it. Adds ~3KB. */
  withGeometry?: boolean;
  signal?: AbortSignal;
  /** Milliseconds per attempt before we give up. Default 15000. */
  timeoutMs?: number;
  /** Total attempts, including the first. Default 3. */
  retries?: number;
}

/**
 * Look up the parcel containing a point.
 *
 * Returns null when the point is outside Florida or falls on no parcel
 * (water, some rights of way). Throws ParcelLookupError when the service
 * itself fails — the caller should surface that, not swallow it.
 */
export async function lookupFlParcel(
  lat: number,
  lng: number,
  opts: LookupOptions = {},
): Promise<FlParcel | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!isInFlorida(lat, lng)) return null;

  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: OUT_FIELDS,
    returnGeometry: opts.withGeometry ? "true" : "false",
    geometryPrecision: "6",
    f: "json",
    /*
     * Do NOT add resultRecordCount here. This service rejects it on a point
     * query — it answers HTTP 200 with a 400 error body, and takes ~55s to do
     * it. A point intersects one or two parcels anyway; we take the first.
     */
  });

  const url = `${SERVICE}?${params.toString()}`;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const attempts = opts.retries ?? 3;

  let json: ArcgisResponse | undefined;
  let lastErr: unknown;

  /*
   * This is a free public service and it does get loaded — in testing it
   * returned intermittent 504s and transport errors on perfectly valid
   * queries that succeeded on retry. Back off and try again rather than
   * telling the rep there is no parcel.
   */
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    const timer = setTimeout(onAbort, timeoutMs);
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer);
        throw new ParcelLookupError("Cancelled");
      }
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new ParcelLookupError(`Parcel service returned ${res.status}`);
      json = (await res.json()) as ArcgisResponse;
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      /* The caller cancelled — do not retry, and do not report it as a failure. */
      if (opts.signal?.aborted) throw new ParcelLookupError("Cancelled", err);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  if (lastErr) {
    const name = (lastErr as Error)?.name;
    throw new ParcelLookupError(
      name === "AbortError"
        ? "The county parcel service did not respond in time."
        : "The county parcel service is not responding right now.",
      lastErr,
    );
  }

  /*
   * ArcGIS answers HTTP 200 with an error body for a malformed query. Never
   * treat that as "no parcel here" — that would quietly show an empty card
   * when the real problem is our query.
   */
  if (json?.error) {
    throw new ParcelLookupError(
      json.error?.message || "Parcel service rejected the query",
      json.error,
    );
  }

  const feature = json?.features?.[0];
  if (!feature?.attributes) return null;

  const rings =
    opts.withGeometry && Array.isArray(feature.geometry?.rings)
      ? (feature.geometry.rings as [number, number][][])
      : null;

  return normalise(feature.attributes as Attrs, rings);
}

/* ───────────────────────────── derived signals ───────────────────────────── */

/**
 * The roll does not carry a roof date. Year built is the floor on roof age for
 * a house that has never been reroofed, so it answers "is this worth knocking"
 * on its own. Pair it with permit data when you have it.
 */
export function roofAgeFloor(parcel: FlParcel, now = new Date().getFullYear()): number | null {
  const base = parcel.effectiveYearBuilt ?? parcel.yearBuilt;
  return base ? Math.max(0, now - base) : null;
}

export type CanvassSignal = { label: string; tone: "good" | "warn" | "hot" | "neutral" };

/** The short chips a rep should see before they decide to knock. */
export function canvassSignals(parcel: FlParcel, now = new Date().getFullYear()): CanvassSignal[] {
  const out: CanvassSignal[] = [];
  const age = roofAgeFloor(parcel, now);

  if (age != null && age >= 20) out.push({ label: `Structure ${age} yr`, tone: "hot" });
  else if (age != null) out.push({ label: `Structure ${age} yr`, tone: "neutral" });

  if (parcel.homestead) out.push({ label: "Homestead — owner occupied", tone: "good" });
  if (parcel.absentee) out.push({ label: "Absentee owner", tone: "warn" });
  if (parcel.owner.isEntity) out.push({ label: "Entity owned", tone: "warn" });

  if (parcel.lastSale && now - parcel.lastSale.year <= 2) {
    out.push({ label: `Sold ${parcel.lastSale.year}`, tone: "hot" });
  }
  if (parcel.improvementGap && parcel.improvementGap >= 5) {
    out.push({ label: `Renovated ~${parcel.effectiveYearBuilt}`, tone: "neutral" });
  }
  return out;
}
