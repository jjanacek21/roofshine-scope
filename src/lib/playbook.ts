// Cold-call playbook content for SPF roof restoration sales (commercial).
// Used by both the Training Center (full library) and the on-call floating panel.

export interface PlaybookSection {
  id: string;
  title: string;
  short: string; // One-line description for selectors
  blocks: PlaybookBlock[];
}

export type PlaybookBlock =
  | { kind: "script"; label: string; lines: string[] }
  | { kind: "qa"; question: string; answer: string }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "callout"; label: string; body: string };

export const PLAYBOOK_SECTIONS: PlaybookSection[] = [
  {
    id: "quickRef",
    title: "Quick Reference",
    short: "Pricing, lead times, warranty — the things you forget mid-call.",
    blocks: [
      {
        kind: "list",
        label: "Pricing snapshot (per sq ft)",
        items: [
          "SPF restoration: $4.50 – $7.50",
          "Silicone re-coat (existing membrane): $2.75 – $4.25",
          "Full tear-off + replace (TPO 60mil): $9.00 – $14.00",
          "Add-ons: drains $250 ea · skylight curbs $185 ea · core cuts $95 ea",
        ],
      },
      {
        kind: "list",
        label: "Lead times",
        items: [
          "Free roof report + AI analysis: 24 hours",
          "On-site core cut + proposal: 5–7 business days",
          "Project mobilization after deposit: 2–3 weeks",
        ],
      },
      {
        kind: "callout",
        label: "Warranty",
        body: "20-year NDL (no dollar limit) manufacturer warranty on SPF + silicone systems. Renewable at year 10 with re-coat for another 10 years.",
      },
    ],
  },
  {
    id: "openers",
    title: "Openers",
    short: "Pattern interrupts that beat 'we don't take cold calls'.",
    blocks: [
      {
        kind: "script",
        label: "Standard opener",
        lines: [
          "Hi {{first_name}}, this is {{rep_name}} with Global Contractor Network.",
          "I'll be quick — I'm calling because we just finished a roof report on {{address}} and I wanted to share what we found before I file it away.",
          "Are you the right person to talk roofing for that building?",
        ],
      },
      {
        kind: "script",
        label: "Referral / drive-by",
        lines: [
          "Hey {{first_name}}, {{rep_name}} from GCN.",
          "I was on a job two blocks from {{address}} this morning and noticed your roof from the air — looked like ponding on the south side.",
          "Got 30 seconds for me to tell you what I saw?",
        ],
      },
      {
        kind: "script",
        label: "Owner direct",
        lines: [
          "{{first_name}}, this is {{rep_name}} — I won't waste your time.",
          "We restore commercial roofs without tearing them off. For a {{sqft}} sq ft building like {{address}}, that's typically 40–60% less than replacement.",
          "Worth 90 seconds to see if you'd qualify?",
        ],
      },
    ],
  },
  {
    id: "discovery",
    title: "Discovery",
    short: "5 questions that build the close for you.",
    blocks: [
      {
        kind: "list",
        label: "Ask in this order",
        items: [
          "How long have you owned/managed {{address}}?",
          "When was the roof last touched — re-coat, repair, or replacement?",
          "Are you currently dealing with any active leaks or interior damage?",
          "What's your hold horizon — flipping, refinancing, or long-term?",
          "Has anyone given you a number for a tear-off? (anchors high before we present low)",
        ],
      },
      {
        kind: "callout",
        label: "Why hold horizon matters",
        body: "Owners who plan to hold 5+ years convert 3x better on restoration. If they're flipping, sell them a Phase-1 silicone re-coat instead.",
      },
    ],
  },
  {
    id: "rebuttals",
    title: "Rebuttals",
    short: "The 8 objections you'll hear every day.",
    blocks: [
      {
        kind: "qa",
        question: "We just had it looked at.",
        answer:
          "Totally fair. We're not asking you to switch contractors — we send you the AI roof report and the satellite cores for free. If your guy missed anything, you'll know. If not, you've got a second opinion in your file.",
      },
      {
        kind: "qa",
        question: "We don't have a budget for that this year.",
        answer:
          "That's exactly why we lead with restoration — it's an OPEX expense, not a capital project, so it doesn't hit your CapEx budget. Most owners fund it out of repair reserves.",
      },
      {
        kind: "qa",
        question: "Just send me an email.",
        answer:
          "Happy to. Two questions so the email is actually useful: who else should be copied, and is your roof currently leaking anywhere? That changes which package I send.",
      },
      {
        kind: "qa",
        question: "We're going to replace it.",
        answer:
          "Smart move if it's past saving. Have you gotten the moisture scan back yet? If it's under 25% wet, restoration saves you 40% and gives you the same 20-year warranty. We can scan it for free this week.",
      },
      {
        kind: "qa",
        question: "I need to talk to my partner / board.",
        answer:
          "Of course. To save you a meeting, I can put together a one-page side-by-side — restore vs. replace, 20-year cost, and warranty terms. What's the best email for both of you?",
      },
      {
        kind: "qa",
        question: "How did you get this number?",
        answer:
          "Public property records — same way the county taxes you. We pulled commercial buildings in {{city}} that fit our restoration profile. I can take you off the list right now, or take 60 seconds to see if it's worth a free report.",
      },
      {
        kind: "qa",
        question: "We use [competitor].",
        answer:
          "Great company. We're not trying to replace them — we're a second set of eyes with AI satellite analysis they don't run. If our report agrees with theirs, you've got confirmation. If we find something they missed, you've got leverage.",
      },
      {
        kind: "qa",
        question: "Call me back in 6 months.",
        answer:
          "Will do — and I'll put you on the calendar for {{six_months_out}}. In the meantime, can I email you the AI roof report on {{address}} so you have it on file when you start budgeting?",
      },
    ],
  },
  {
    id: "masterScript",
    title: "Master Script",
    short: "End-to-end call flow from hello to booked appointment.",
    blocks: [
      {
        kind: "script",
        label: "1. Open",
        lines: [
          "Hi {{first_name}}, {{rep_name}} with GCN — quick call about your roof at {{address}}.",
          "Got 90 seconds?",
        ],
      },
      {
        kind: "script",
        label: "2. Hook",
        lines: [
          "We pulled satellite imagery of your roof and ran it through our AI — it flagged it as a strong candidate for spray foam restoration.",
          "Restoration runs 40–60% less than tear-off and comes with the same 20-year warranty.",
        ],
      },
      {
        kind: "script",
        label: "3. Discovery (pick 2)",
        lines: [
          "When was the last time the roof was re-coated or replaced?",
          "Any active leaks right now?",
          "How long do you plan to hold the property?",
        ],
      },
      {
        kind: "script",
        label: "4. Close to free report",
        lines: [
          "Here's what I'd like to do — no obligation, no sales visit yet.",
          "I'll send you the AI roof report plus satellite analysis on {{address}} by tomorrow morning.",
          "If it looks worth a deeper look, we schedule a 30-minute on-site core cut. If not, you keep the report.",
          "What's the best email?",
        ],
      },
      {
        kind: "script",
        label: "5. Confirm + bridge",
        lines: [
          "Great — I'll send that to {{email}} within 24 hours.",
          "I'll also text you a calendar link so you can grab a time for the on-site if you decide to go forward.",
          "Anything else you want me to look at while I have the imagery up?",
        ],
      },
    ],
  },
  {
    id: "voicemail",
    title: "Voicemail",
    short: "30-second voicemails that get callbacks.",
    blocks: [
      {
        kind: "script",
        label: "First voicemail",
        lines: [
          "Hi {{first_name}}, {{rep_name}} with Global Contractor Network — number's {{rep_phone}}.",
          "I'm calling about the roof at {{address}}. We ran satellite analysis on it this week and I wanted to share what we found.",
          "Quick callback when you have 60 seconds — {{rep_phone}}. Thanks.",
        ],
      },
      {
        kind: "script",
        label: "Second voicemail (3 days later)",
        lines: [
          "{{first_name}}, {{rep_name}} again — GCN, {{rep_phone}}.",
          "Don't want to keep chasing you. I've got the AI roof report on {{address}} ready to send. Reply by text or email and I'll fire it over.",
          "{{rep_phone}}.",
        ],
      },
    ],
  },
  {
    id: "closing",
    title: "Closing & Next Steps",
    short: "Three closes for three buyer types.",
    blocks: [
      {
        kind: "qa",
        question: "Analytical buyer (engineer, CFO)",
        answer:
          "Send the AI report + 20-year cost comparison spreadsheet. Book a 30-min Zoom to walk through the numbers. Don't push — they'll close themselves.",
      },
      {
        kind: "qa",
        question: "Driver (owner-operator)",
        answer:
          "Skip the report — book the on-site core cut this week. Bring the proposal to the same visit. Drivers buy from people who move at their pace.",
      },
      {
        kind: "qa",
        question: "Amiable (long-term holder, family business)",
        answer:
          "Lead with warranty + reputation. Bring 2 referenceable customers in their zip code. Close on the relationship, not the price.",
      },
    ],
  },
];

export function getPlaybookSection(id: string): PlaybookSection | undefined {
  return PLAYBOOK_SECTIONS.find((s) => s.id === id);
}

export function fillPlaceholders(text: string, ctx: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = ctx[key];
    if (v == null || v === "") return `{{${key}}}`;
    return String(v);
  });
}
