/**
 * CMS text layer for the marketing reference markup.
 *
 * The reference design is a static HTML string. Rather than templating every
 * node, each editable line is registered here with the EXACT string that ships
 * in refMarkup/refData as its fallback. A rewriter swaps a fallback for the
 * matching value in cb_site_blocks when — and only when — that row and key are
 * present and non-empty. A deleted row or an absent key renders today's copy.
 *
 * Matching is whitespace-tolerant (the markup wraps long paragraphs across
 * lines), so a paragraph in the admin can be a single line.
 */

import { blockOf, str, type SiteContent } from "@/lib/site-content.types";

type Field = [blockKey: string, field: string, fallback: string];

/** Every editable string, paired with the copy currently in the markup. */
export const CMS_FIELDS: Field[] = [
  /* ---- home / hero ---- */
  ["hero", "eyebrow", "Insurance restoration · roof, exterior &amp; interior"],
  ["hero", "headline", "Measure the roof before you knock on the door."],
  [
    "hero",
    "sub",
    "Type an address and the roof traces itself. Then walk it — roof, all four exterior elevations, and the interior — and hand the homeowner a carrier-ready scope before you leave the driveway.",
  ],
  ["hero", "secondary_cta", "See every screen"],
  ["hero", "note", "Runs in the phone browser at gcn.claims. No app store, no install."],
  // Site-wide primary button label (header, hero and closing CTA all use it).
  ["hero", "primary_cta", "Book a demo"],

  /* ---- home / seven taps ---- */
  ["steps", "eyebrow", "Address to labeled roof"],
  ["steps", "heading", "Seven taps, and the roof is measured."],
  [
    "steps",
    "body",
    "This is the real thing, frame by frame — pin, trace, drag the corners onto the actual roof, draw the ridges and hips, label each edge. Squares and linear footage update the whole way through.",
  ],
  ["steps", "onsite_eyebrow", "What happens on site"],

  /* ---- home / three inspections ---- */
  ["inspections", "eyebrow", "Three inspections, one job"],
  ["inspections", "heading", "The roof was never the whole claim."],
  ["inspections", "split_heading", "One progress list covers all three."],
  [
    "inspections",
    "split_body_1",
    "Roof system through roof notes, then left, rear, front and right exterior takeoffs, then the interior. The percentage at the top is the whole job, not just the roof — so nobody creates a report with a quarter of it missing.",
  ],

  /* ---- home / why switch + quote ---- */
  ["why_switch", "eyebrow", "Why reps switch"],
  ["why_switch", "heading", "The first estimate is not the claim."],
  [
    "quote",
    "quote",
    "The rep who documents the whole loss on the first visit does not go back for photos, and does not negotiate from a scope the carrier wrote.",
  ],

  /* ---- home / about ---- */
  ["about", "heading", "Built by a roofer, on real claims."],
  [
    "about",
    "body_1",
    "Claim Buddy comes out of Global Contractor Network — a Florida restoration contractor, not a software company that interviewed one. Every screen in it started as a step someone was doing badly on a clipboard or twice in two systems.",
  ],

  /* ---- home / closing CTA ---- */
  ["cta", "eyebrow", "Fifteen minutes, your address"],
  ["cta", "heading", "We measure a roof you know on the call."],
  [
    "cta",
    "body",
    "Bring a house you have already inspected. If the numbers do not hold up against what you measured by hand, we have not earned the next call.",
  ],
  ["cta", "secondary_cta", "See pricing"],

  /* ---- pricing ---- */
  ["pricing_intro", "heading", "Per seat. Cancel any time."],
  [
    "pricing_intro",
    "body",
    "Priced against what you already spend. One Xactimate license runs $150–250 a month. A supplement service takes 15–25% of everything it recovers.",
  ],

  /* ---- resources ---- */
  ["resources_intro", "heading", "A green rep to first close in seven days."],
  [
    "resources_intro",
    "body",
    "Training is not a PDF nobody opens. It ships inside the app your reps already have on their phone — scripts, rebuttals, insurance language and closes, searchable from the driveway.",
  ],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Fallback -> replacement, whitespace-tolerant, applied to an HTML string. */
export type TextRewriter = (html: string) => string;

export function makeTextRewriter(content: SiteContent | undefined): TextRewriter {
  const swaps: Array<[RegExp, string]> = [];
  for (const [key, field, fallback] of CMS_FIELDS) {
    const value = str(blockOf(content, key), field, fallback);
    if (!value || value === fallback) continue;
    swaps.push([
      new RegExp(escapeRe(fallback).replace(/\s+/g, "\\s+"), "g"),
      value.replace(/\$/g, "$$$$"),
    ]);
  }
  if (!swaps.length) return (html) => html;
  return (html) => swaps.reduce((out, [re, to]) => out.replace(re, to), html);
}
