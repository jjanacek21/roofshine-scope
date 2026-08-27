/**
 * Reonomy CSV import.
 *
 * Takes a Reonomy export exactly as it downloads and maps it onto the shape
 * `importLeads` expects. Reonomy's headers shift between export types, so
 * nothing here is hardcoded to one layout: columns are matched by synonym,
 * the caller is shown what matched, and anything unrecognised is reported
 * rather than silently dropped.
 *
 * We keep four things and discard the rest: property address, owner, the
 * people on the property, and their phone numbers and emails.
 */

export type ParsedContact = {
  name: string;
  title: string | null;
  company: string | null;
  phones: string[];
  emails: string[];
};

export type ParsedLead = {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  owner: string | null;
  reported_owner: string | null;
  contacts: ParsedContact[];
};

export type FieldRole =
  | "address"
  | "city"
  | "state"
  | "zip"
  | "owner"
  | "contact_name"
  | "contact_first"
  | "contact_last"
  | "contact_title"
  | "contact_phone"
  | "contact_email"
  | "ignored";

export type ColumnMapping = {
  /** Header exactly as it appeared in the file. */
  header: string;
  role: FieldRole;
  /** Contact block this column belongs to, for wide exports (Contact 1, Contact 2…). */
  contactIndex: number | null;
  /** True when a human overrode the auto-detected role. */
  overridden?: boolean;
};

export type ParseReport = {
  leads: ParsedLead[];
  mapping: ColumnMapping[];
  rowCount: number;
  /** Rows skipped because they had no usable property address. */
  skippedNoAddress: number;
  /** Distinct properties after collapsing repeated rows. */
  propertyCount: number;
  contactCount: number;
  phoneCount: number;
  emailCount: number;
  warnings: string[];
};

/** Lowercase, drop punctuation, collapse whitespace. "Contact 1 Phone #2" -> "contact 1 phone 2" */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reonomy ships the owner's mailing address alongside the property address.
 * Filing a prospect under the owner's HQ instead of the building is the single
 * most damaging mistake this importer could make, so mailing columns are
 * excluded from every location role rather than merely ranked lower.
 */
const MAILING_MARKERS = ["mailing", "owner address", "owner city", "owner state", "owner zip"];

function isMailing(norm: string): boolean {
  // Match "mailing", never the bare substring "mail" — "email" contains it.
  return MAILING_MARKERS.some((m) => norm.includes(m));
}

/** Ordered: earlier entries win when several columns could fill the same role. */
const ROLE_SYNONYMS: Array<{ role: FieldRole; patterns: string[] }> = [
  {
    role: "address",
    patterns: [
      "property address",
      "property street address",
      "street address",
      "address line 1",
      "site address",
      "full address",
      "address",
    ],
  },
  { role: "city", patterns: ["property city", "city"] },
  { role: "state", patterns: ["property state", "state"] },
  { role: "zip", patterns: ["property zip", "zip code", "zip", "postal code"] },
  {
    role: "owner",
    patterns: [
      "reported owner",
      "true owner name",
      "true owner",
      "owner name",
      "owner entity",
      "owner",
    ],
  },
  { role: "contact_title", patterns: ["title", "job title", "role", "position"] },
  { role: "contact_first", patterns: ["first name", "given name"] },
  { role: "contact_last", patterns: ["last name", "surname", "family name"] },
  {
    role: "contact_name",
    patterns: ["contact name", "full name", "executive", "contact", "name"],
  },
  {
    role: "contact_phone",
    patterns: ["phone", "mobile", "cell", "telephone", "tel", "direct dial"],
  },
  { role: "contact_email", patterns: ["email", "e mail"] },
];

/** Pull a "Contact 2 …" block index out of a header, if present. */
function extractContactIndex(norm: string): { index: number | null; rest: string } {
  const m = norm.match(/^(?:contact|executive|owner contact|person)\s*(\d+)\s*(.*)$/);
  if (m) return { index: Number(m[1]), rest: m[2].trim() };
  const m2 = norm.match(/^(.*?)\s*(\d+)$/);
  if (m2 && /phone|email|mobile|cell/.test(m2[1])) {
    // "phone 2" — a second phone for the same (single) contact block.
    return { index: null, rest: m2[1].trim() };
  }
  return { index: null, rest: norm };
}

function detectRole(rest: string, hasContactIndex: boolean): FieldRole {
  if (!rest) return hasContactIndex ? "contact_name" : "ignored";
  for (const { role, patterns } of ROLE_SYNONYMS) {
    for (const p of patterns) {
      if (rest === p || rest.startsWith(p + " ") || rest.endsWith(" " + p) || rest.includes(p)) {
        // Location roles never come from a contact block.
        if (
          hasContactIndex &&
          (role === "address" || role === "city" || role === "state" || role === "zip")
        ) {
          return "ignored";
        }
        return role;
      }
    }
  }
  return "ignored";
}

/** Auto-detect a role for every header in the file. */
export function detectMapping(headers: string[]): ColumnMapping[] {
  const claimed = new Set<FieldRole>();
  const out: ColumnMapping[] = [];

  for (const header of headers) {
    const norm = normalizeHeader(header);
    const { index, rest } = extractContactIndex(norm);

    if (isMailing(norm)) {
      out.push({ header, role: "ignored", contactIndex: null });
      continue;
    }

    let role = detectRole(rest, index !== null);

    // Single-value roles are claimed once — the first (best) match wins.
    const singleton: FieldRole[] = ["address", "city", "state", "zip", "owner"];
    if (singleton.includes(role)) {
      if (claimed.has(role)) role = "ignored";
      else claimed.add(role);
    }

    out.push({ header, role, contactIndex: index });
  }

  return out;
}

const cleanPhone = (v: string) => {
  const digits = v.replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return v.trim();
};

const cleanEmail = (v: string) => {
  const t = v.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) ? t : null;
};

/**
 * Apply a mapping to parsed CSV rows.
 *
 * Handles both export shapes Reonomy produces: wide (one row per property,
 * contacts spread across numbered columns) and long (the same property
 * repeated once per contact). Repeated addresses are collapsed and their
 * contacts merged, so both arrive at the same result.
 */
export function buildLeads(
  rows: Array<Record<string, string>>,
  mapping: ColumnMapping[],
): ParseReport {
  const byRole = (r: FieldRole) => mapping.filter((m) => m.role === r);
  const first = (r: FieldRole) => byRole(r)[0]?.header ?? null;

  const addressCol = first("address");
  const cityCol = first("city");
  const stateCol = first("state");
  const zipCol = first("zip");
  const ownerCol = first("owner");

  const warnings: string[] = [];
  if (!addressCol) warnings.push("No property address column was identified — set one below.");

  const contactCols = mapping.filter(
    (m) =>
      m.role === "contact_name" ||
      m.role === "contact_first" ||
      m.role === "contact_last" ||
      m.role === "contact_title" ||
      m.role === "contact_phone" ||
      m.role === "contact_email",
  );

  const blocks = Array.from(
    new Set(contactCols.map((c) => (c.contactIndex === null ? 0 : c.contactIndex))),
  ).sort((a, b) => a - b);

  const leadsByAddress = new Map<string, ParsedLead>();
  let skippedNoAddress = 0;

  for (const row of rows) {
    const rawAddress = (addressCol ? row[addressCol] : "")?.trim() ?? "";
    if (!rawAddress) {
      skippedNoAddress++;
      continue;
    }
    const key = rawAddress.toLowerCase();

    let lead = leadsByAddress.get(key);
    if (!lead) {
      const ownerVal = ownerCol ? (row[ownerCol] ?? "").trim() : "";
      lead = {
        address: rawAddress,
        city: cityCol ? (row[cityCol] ?? "").trim() || null : null,
        state: stateCol ? (row[stateCol] ?? "").trim() || null : null,
        zip: zipCol ? (row[zipCol] ?? "").trim() || null : null,
        owner: ownerVal || null,
        reported_owner: ownerVal || null,
        contacts: [],
      };
      leadsByAddress.set(key, lead);
    }

    for (const block of blocks) {
      const cols = contactCols.filter(
        (c) => (c.contactIndex === null ? 0 : c.contactIndex) === block,
      );

      const nameParts: string[] = [];
      const nameCol = cols.find((c) => c.role === "contact_name");
      const firstCol = cols.find((c) => c.role === "contact_first");
      const lastCol = cols.find((c) => c.role === "contact_last");

      if (nameCol && (row[nameCol.header] ?? "").trim()) {
        nameParts.push(row[nameCol.header].trim());
      } else {
        const f = firstCol ? (row[firstCol.header] ?? "").trim() : "";
        const l = lastCol ? (row[lastCol.header] ?? "").trim() : "";
        if (f || l) nameParts.push([f, l].filter(Boolean).join(" "));
      }
      const name = nameParts.join(" ").trim();

      const phones = cols
        .filter((c) => c.role === "contact_phone")
        .map((c) => cleanPhone(row[c.header] ?? ""))
        .filter((v): v is string => !!v);

      const emails = cols
        .filter((c) => c.role === "contact_email")
        .map((c) => cleanEmail(row[c.header] ?? ""))
        .filter((v): v is string => !!v);

      // A block with no name and no way to reach anyone carries nothing.
      if (!name && phones.length === 0 && emails.length === 0) continue;

      const titleCol = cols.find((c) => c.role === "contact_title");
      const title = titleCol ? (row[titleCol.header] ?? "").trim() || null : null;

      const displayName = name || lead.owner || "Unnamed contact";

      // Merge into an existing person on this property rather than duplicating.
      const existing = lead.contacts.find(
        (c) =>
          c.name.toLowerCase() === displayName.toLowerCase() ||
          (phones.length > 0 &&
            c.phones.some((p) => p.replace(/\D+/g, "") === phones[0].replace(/\D+/g, ""))),
      );

      if (existing) {
        for (const p of phones) {
          const d = p.replace(/\D+/g, "");
          if (!existing.phones.some((q) => q.replace(/\D+/g, "") === d)) existing.phones.push(p);
        }
        for (const e of emails) {
          if (!existing.emails.some((q) => q.toLowerCase() === e.toLowerCase())) {
            existing.emails.push(e);
          }
        }
        if (!existing.title && title) existing.title = title;
      } else {
        lead.contacts.push({
          name: displayName,
          title,
          company: lead.owner,
          phones,
          emails,
        });
      }
    }
  }

  const leads = Array.from(leadsByAddress.values());
  let contactCount = 0;
  let phoneCount = 0;
  let emailCount = 0;
  for (const l of leads) {
    contactCount += l.contacts.length;
    for (const c of l.contacts) {
      phoneCount += c.phones.length;
      emailCount += c.emails.length;
    }
  }

  if (leads.length > 0 && contactCount === 0) {
    warnings.push(
      "No contacts were found. If this export has owner contacts, map their columns below.",
    );
  }

  return {
    leads,
    mapping,
    rowCount: rows.length,
    skippedNoAddress,
    propertyCount: leads.length,
    contactCount,
    phoneCount,
    emailCount,
    warnings,
  };
}

/** Headers whose data will not be imported, for showing the user what was left out. */
export function ignoredHeaders(mapping: ColumnMapping[]): string[] {
  return mapping.filter((m) => m.role === "ignored").map((m) => m.header);
}

export const ROLE_LABELS: Record<FieldRole, string> = {
  address: "Property address",
  city: "City",
  state: "State",
  zip: "ZIP",
  owner: "Owner",
  contact_name: "Contact name",
  contact_first: "Contact first name",
  contact_last: "Contact last name",
  contact_title: "Contact title",
  contact_phone: "Phone",
  contact_email: "Email",
  ignored: "Not imported",
};
