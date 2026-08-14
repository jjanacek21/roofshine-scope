/**
 * Claim Buddy sit-down presentation deck.
 *
 * Sections 03–09 are fixed content, identical for every contractor — only the
 * branding swaps. Sections 01 and 02 render from the company row so each
 * contractor tells their own story.
 */
import type { CbCompany } from "@/components/auth/CbCompanyProvider";
import { CB_LOCKED_SECTIONS } from "./cbLockedSections.js";

export interface CbSlide {
  id: string;
  kicker?: string;
  title: string;
  lead?: string;
  bullets?: string[];
  columns?: { heading: string; lines: string[] }[];
  stats?: { label: string; value: number; suffix?: string; prefix?: string; decimals?: number }[];
  note?: string;
  /** The closing slide is built from live job data, not from this file. */
  kind?: "standard" | "property" | "html";
  /** Verbatim slide markup from the locked deck. */
  html?: string;
  imageUrl?: string | null;
}

export interface CbSection {
  id: string;
  index: string;
  title: string;
  blurb: string;
  editable?: boolean;
  slides: CbSlide[];
}

function serviceAreaList(company: CbCompany | null): string[] {
  const raw = (company as unknown as { service_areas?: unknown })?.service_areas;
  if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export interface CbAboutFields {
  about_headline: string | null;
  about_story: string | null;
  founded_year: number | null;
  team_photo_url: string | null;
  service_areas: unknown;
}

/** Sections 01 and 02 — per company. */
function companySections(company: CbCompany | null, about: CbAboutFields | null, teamPhotoUrl: string | null): CbSection[] {
  const name = company?.name ?? "Our company";
  const founded = about?.founded_year ?? null;
  const years = founded ? new Date().getFullYear() - founded : null;
  const areas = serviceAreaList({ ...(company ?? {}), ...(about ?? {}) } as CbCompany);
  const story =
    about?.about_story?.trim() ||
    `${name} is a local roofing and exterior contractor. We handle storm damage claims from the first inspection through the final invoice, and we stay on the job until the work passes inspection and you are happy with it.`;
  const storyParas = story.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  return [
    {
      id: "about",
      index: "01",
      title: "About the company",
      blurb: "Who you're sitting with",
      editable: true,
      slides: [
        {
          id: "about-hero",
          kicker: "About us",
          title: about?.about_headline?.trim() || name,
          lead: storyParas[0],
          stats: [
            ...(years !== null && years >= 0
              ? [{ label: "Years in business", value: years, suffix: "+" }]
              : []),
            ...(areas.length ? [{ label: "Communities served", value: areas.length }] : []),
          ],
          note: [company?.city, company?.state].filter(Boolean).join(", ") || undefined,
        },
        ...(storyParas.length > 1
          ? [
              {
                id: "about-story",
                kicker: "Our story",
                title: founded ? `Since ${founded}` : "How we got here",
                lead: storyParas.slice(1).join("\n\n"),
              } as CbSlide,
            ]
          : []),
        {
          id: "about-contact",
          kicker: "How to reach us",
          title: "You always have a real person",
          bullets: [
            company?.phone ? `Phone — ${company.phone}` : "Phone — on your paperwork",
            company?.email ? `Email — ${company.email}` : "Email — on your paperwork",
            company?.website ? `Web — ${company.website}` : "Local, licensed and insured",
            [company?.address, company?.city, company?.state, company?.zip].filter(Boolean).join(", ") ||
              "Serving your area",
          ],
        },
      ],
    },
    {
      id: "network",
      index: "02",
      title: "Our network",
      blurb: "The crew and partners behind the work",
      editable: true,
      slides: [
        {
          id: "network-team",
          kicker: "Who we are",
          title: "The people on your roof",
          lead:
            "Every crew on your property works to one standard. Your rep stays your single point of contact from the inspection through the final walkthrough.",
          imageUrl: teamPhotoUrl,
        },
        {
          id: "network-areas",
          kicker: "Where we work",
          title: areas.length ? "Your neighborhood is on the list" : "We work where you live",
          bullets: areas.length ? areas.slice(0, 8) : ["Local crews", "Local suppliers", "Local warranty service"],
          note: areas.length > 8 ? `+ ${areas.length - 8} more communities` : undefined,
        },
        {
          id: "network-partners",
          kicker: "Our network",
          title: "Manufacturers, suppliers and adjusters",
          columns: [
            {
              heading: "Manufacturer certified",
              lines: ["Trained on the systems we install", "Full manufacturer warranties", "Documented installation specs"],
            },
            {
              heading: "Supplier backed",
              lines: ["Material delivered to your driveway", "Storm-season supply priority", "Color and profile samples on site"],
            },
          ],
        },
      ],
    },
  ];
}

/** Sections 03–08 — locked, identical for every contractor. */
/** Sections 03–08 — locked, verbatim content from cbLockedSections.js. */
const LOCKED_META: { id: string; index: string; title: string; blurb: string }[] = [
  { id: "claims", index: "03", title: "The claims process", blurb: "What happens, in what order" },
  { id: "production", index: "04", title: "Production and install", blurb: "How the job actually runs" },
  { id: "roofing", index: "05", title: "Roofing systems", blurb: "What goes on your house" },
  { id: "trades", index: "06", title: "Additional trades", blurb: "Everything the storm touched" },
  { id: "commercial", index: "07", title: "Commercial capability", blurb: "Beyond residential" },
  { id: "financing", index: "08", title: "Financing", blurb: "If you need it" },
];

/** No token may ever reach a homeowner's screen — unknown ones resolve to "". */
function fillTokens(html: string, tokens: Record<string, string>): string {
  return html.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (_m, key: string) => tokens[key] ?? "");
}

function lockedSections(company: CbCompany | null): CbSection[] {
  const row = (company ?? {}) as unknown as Record<string, unknown>;
  const roofing = Number(row.warranty_years);
  const trades = Number(row.warranty_years_trades);
  const tokens: Record<string, string> = {
    COMPANY: (company?.name ?? "").trim() || "Our company",
    WARRANTY_ROOFING: String(Number.isFinite(roofing) && roofing > 0 ? roofing : 10),
    WARRANTY_TRADES: String(Number.isFinite(trades) && trades > 0 ? trades : 10),
  };

  return LOCKED_META.flatMap((meta) => {
    const raw = CB_LOCKED_SECTIONS.find((s) => s.id === meta.id);
    if (!raw) return [];
    return [
      {
        id: meta.id,
        index: meta.index,
        title: meta.title,
        blurb: meta.blurb,
        slides: raw.slides.map((html, i) => ({
          id: `${meta.id}-${i + 1}`,
          title: raw.title,
          kind: "html" as const,
          html: fillTokens(html, tokens),
        })),
      },
    ];
  });
}


export interface CbPropertyDeckData {
  address: string;
  carrier: string | null;
  dateOfLoss: string | null;
  claimNumber: string | null;
  deductible: number | null;
  squares: number;
  lineItemCount: number;
  photoCount: number;
  findings: string[];
  summary: string | null;
}

export function buildCbDeck(
  company: CbCompany | null,
  about: CbAboutFields | null,
  teamPhotoUrl: string | null,
  property: CbPropertyDeckData,
): CbSection[] {
  return [
    ...companySections(company, about, teamPhotoUrl),
    ...lockedSections(company),
    {
      id: "next-steps",
      index: "09",
      title: "Next steps",
      blurb: "This property",
      slides: [
        {
          id: "next-findings",
          kicker: "What we found",
          title: property.address || "Your property",
          lead: property.summary ?? undefined,
          bullets: property.findings.length ? property.findings : undefined,
        },
        {
          id: "next-property",
          kind: "property",
          kicker: "Your claim",
          title: "Here is where you stand",
        },
      ],
    },
  ];
}
