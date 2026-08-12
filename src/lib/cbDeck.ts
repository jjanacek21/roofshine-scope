/**
 * Claim Buddy sit-down presentation deck.
 *
 * Sections 03–09 are fixed content, identical for every contractor — only the
 * branding swaps. Sections 01 and 02 render from the company row so each
 * contractor tells their own story.
 */
import type { CbCompany } from "@/components/auth/CbCompanyProvider";

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
  kind?: "standard" | "property";
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
const LOCKED_SECTIONS: CbSection[] = [
  {
    id: "process",
    index: "03",
    title: "The claims process",
    blurb: "What happens, in what order",
    slides: [
      {
        id: "process-steps",
        kicker: "Step by step",
        title: "Six steps from today to a finished roof",
        bullets: [
          "1 — Inspection. We document every elevation with photographs.",
          "2 — Report. You get the same report the carrier gets.",
          "3 — Claim. You file; we meet the adjuster on site.",
          "4 — Scope agreement. The carrier's scope is reconciled against ours.",
          "5 — Production. Materials ordered, install scheduled.",
          "6 — Final invoice and warranty paperwork.",
        ],
      },
      {
        id: "process-adjuster",
        kicker: "Adjuster meeting",
        title: "You are not alone in that conversation",
        lead:
          "We meet your adjuster on the roof, walk the same test squares, and hand over the documented findings. Disagreements get resolved with photographs and measurements, not opinions.",
        columns: [
          { heading: "You bring", lines: ["Claim number", "Policy declarations", "Your questions"] },
          { heading: "We bring", lines: ["Photo documentation", "Measurements", "Line-item scope"] },
        ],
      },
      {
        id: "process-role",
        kicker: "Important",
        title: "What we are and are not",
        lead:
          "We document conditions and build the scope of repair. The carrier makes the coverage decision. We are a contractor, not a public adjuster, and we do not negotiate your policy on your behalf.",
      },
    ],
  },
  {
    id: "production",
    index: "04",
    title: "Production and install",
    blurb: "How the job actually runs",
    slides: [
      {
        id: "prod-day",
        kicker: "Install day",
        title: "What your day looks like",
        bullets: [
          "Crew arrives early; driveway and landscaping protected.",
          "Tear-off to the deck, decking inspected and replaced as needed.",
          "New system installed to manufacturer specification the same day where possible.",
          "Magnet sweep of the yard and driveway before the crew leaves.",
        ],
      },
      {
        id: "prod-standards",
        kicker: "Standards",
        title: "Non-negotiables on every job",
        columns: [
          {
            heading: "Workmanship",
            lines: ["Full ice and water at eaves and valleys", "Synthetic underlayment", "Hand-nailed penetrations sealed"],
          },
          {
            heading: "Site care",
            lines: ["Tarped landscaping", "Debris trailer on site", "Daily cleanup, not just final"],
          },
        ],
      },
      {
        id: "prod-warranty",
        kicker: "After the install",
        title: "Final inspection and warranty",
        lead:
          "A supervisor walks the finished roof, photographs the completed work, and only then do we invoice. Your workmanship warranty and the manufacturer registration come with the closeout packet.",
      },
    ],
  },
  {
    id: "systems",
    index: "05",
    title: "Roofing systems",
    blurb: "What goes on your house",
    slides: [
      {
        id: "sys-layers",
        kicker: "The system",
        title: "A roof is seven layers, not one",
        bullets: [
          "Decking — inspected, re-nailed, replaced where soft.",
          "Ice and water shield — eaves, valleys and penetrations.",
          "Synthetic underlayment — the full field.",
          "Starter course — sealed eave and rake edge.",
          "Shingles — impact and wind rated.",
          "Hip and ridge cap — matched to the field shingle.",
          "Ventilation — intake and exhaust balanced.",
        ],
      },
      {
        id: "sys-choices",
        kicker: "Material choices",
        title: "Architectural, impact-resistant or designer",
        columns: [
          {
            heading: "Architectural",
            lines: ["The standard replacement", "Dimensional shadow line", "Strong wind rating"],
          },
          {
            heading: "Impact resistant",
            lines: ["Class 4 rated", "Often an insurance discount", "Better hail performance"],
          },
        ],
        note: "Color and profile samples are in the truck — we pick together.",
      },
      {
        id: "sys-vent",
        kicker: "Ventilation",
        title: "Balanced airflow protects the whole system",
        lead:
          "Intake at the soffit, exhaust at the ridge. Under-ventilated attics cook shingles from underneath, void manufacturer warranties and drive up cooling bills. We calculate the required net free area for your roof and correct it during the install.",
      },
    ],
  },
  {
    id: "trades",
    index: "06",
    title: "Additional trades",
    blurb: "Everything the storm touched",
    slides: [
      {
        id: "trades-list",
        kicker: "Beyond the roof",
        title: "Hail does not stop at the roofline",
        columns: [
          { heading: "Exterior", lines: ["Siding and trim", "Gutters and downspouts", "Windows and screens", "Fascia and soffit"] },
          { heading: "Property", lines: ["Fencing", "Decks and railings", "AC condenser fins", "Garage doors"] },
        ],
      },
      {
        id: "trades-interior",
        kicker: "Inside",
        title: "Interior damage from an active leak",
        lead:
          "Ceiling stains, drywall, insulation and flooring damaged by water intrusion belong on the same claim. We document moisture readings and photograph every affected room so nothing gets left off the scope.",
      },
      {
        id: "trades-one-contract",
        kicker: "One contractor",
        title: "One crew coordinator, one closeout",
        lead:
          "You are not chasing four contractors and four schedules. Each trade is coordinated through the same project manager and closed out on the same paperwork.",
      },
    ],
  },
  {
    id: "commercial",
    index: "07",
    title: "Commercial capability",
    blurb: "Beyond residential",
    slides: [
      {
        id: "com-systems",
        kicker: "Commercial",
        title: "Flat and low-slope systems",
        bullets: ["TPO and PVC single ply", "Modified bitumen", "Built-up roofing", "Metal panel and standing seam", "Coatings and restoration"],
      },
      {
        id: "com-clients",
        kicker: "Who we serve",
        title: "Property managers, HOAs and business owners",
        lead:
          "If you manage a building, own a rental, or sit on an HOA board, the same documentation process applies at scale — building by building, with a portfolio-level summary.",
      },
    ],
  },
  {
    id: "financing",
    index: "08",
    title: "Financing",
    blurb: "If you need it",
    slides: [
      {
        id: "fin-when",
        kicker: "Financing",
        title: "For the parts insurance does not cover",
        lead:
          "On an approved claim, the carrier funds the repair and your out-of-pocket is your deductible. Financing exists for upgrades you choose, for non-covered work, or to spread the deductible over time.",
      },
      {
        id: "fin-how",
        kicker: "How it works",
        title: "A soft credit check and a same-day answer",
        bullets: [
          "Application takes a few minutes on this tablet.",
          "Soft pull first — no impact to check your options.",
          "Terms shown before you commit to anything.",
          "No prepayment penalty on the programs we use.",
        ],
        note: "Ask your rep for current program terms.",
      },
    ],
  },
];

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
    ...LOCKED_SECTIONS,
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
