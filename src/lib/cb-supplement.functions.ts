import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CbCarrierLine, CbCarrierMeasure, CbScopeItem } from "./cbSupplement";

/**
 * Two server calls, deliberately separate.
 *
 * `cbParseCarrierEstimate` reads the carrier's PDF and returns only what is
 * printed on it. `cbMatchCarrierLines` decides which of those lines covers each
 * item our own measurement and takeoff already prove. Keeping them apart means
 * the model never sees our scope while it is reading their document, so it
 * cannot quietly write our numbers into their estimate.
 */

const ParseInput = z.object({
  /** The PDF itself, base64, sent straight from the browser that picked it. */
  pdfBase64: z.string().min(100).max(24_000_000),
});

const MatchInput = z.object({
  lines: z
    .array(
      z.object({
        name: z.string(),
        unit: z.string(),
        qty: z.number(),
      }),
    )
    .max(400),
  scope: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        unit: z.string(),
        aka: z.string(),
      }),
    )
    .max(80),
});

export interface CbParsedEstimate {
  carrier: string | null;
  claimNumber: string | null;
  total: number | null;
  lines: CbCarrierLine[];
  /** Off their sketch page, when the estimate prints one. */
  measure: CbCarrierMeasure;
}

const PARSE_SYSTEM = `You read insurance carrier property estimates and return the line items exactly as printed.

RULES:
1. Return every line item in the estimate, in the order printed. Do not summarise, group or skip.
2. Copy quantities and prices exactly as printed. Never recalculate, never round, never convert units.
3. Copy the unit as printed (SQ, LF, SF, EA, HR, DA...). If no unit is printed, use "".
4. If a value is not printed, use null. Never estimate a missing price.
5. Return only line items. Skip headers, subtotals, tax lines, overhead and profit lines, depreciation summaries and page footers.
6. Do not add any line item that is not printed in this document, for any reason.
7. If the estimate prints a roof measurement or sketch summary, copy those figures into "measure". Total area is in SQUARES: 1 square is 100 SF, so 3,240 SF is 32.4. If a figure is not printed, leave it null — never derive one figure from another.`;

export const cbParseCarrierEstimate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ParseInput.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; result: CbParsedEstimate } | { ok: false; reason: string }> => {
      const { claudeStructured } = await import("@/lib/claude.server");

      const res = await claudeStructured<{
        carrier?: unknown;
        claim_number?: unknown;
        total?: unknown;
        measure?: Record<string, unknown>;
        lines?: unknown[];
      }>({
        system: PARSE_SYSTEM,
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 },
          },
          {
            type: "text",
            text: "Return every line item printed in this estimate, plus the carrier name, claim number, grand total, and any roof measurements printed on the sketch or measurement summary.",
          },
        ],
        budgetMs: 90_000,
        maxTokens: 16_000,
        tool: {
          name: "record_estimate",
          description: "Record the carrier, claim number, total and every printed line item.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              carrier: { type: ["string", "null"] },
              claim_number: { type: ["string", "null"] },
              total: { type: ["number", "null"] },
              measure: {
                type: "object",
                additionalProperties: false,
                properties: {
                  total_squares: { type: ["number", "null"] },
                  ridge_lf: { type: ["number", "null"] },
                  hip_lf: { type: ["number", "null"] },
                  valley_lf: { type: ["number", "null"] },
                  eave_lf: { type: ["number", "null"] },
                  rake_lf: { type: ["number", "null"] },
                  drip_edge_lf: { type: ["number", "null"] },
                  step_flashing_lf: { type: ["number", "null"] },
                  wall_flashing_lf: { type: ["number", "null"] },
                  pitch: { type: ["string", "null"] },
                  stories: { type: ["number", "null"] },
                },
              },
              lines: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code: { type: ["string", "null"] },
                    name: { type: "string" },
                    unit: { type: "string" },
                    qty: { type: "number" },
                    unit_price: { type: ["number", "null"] },
                    total: { type: ["number", "null"] },
                  },
                  required: ["name", "unit", "qty"],
                },
              },
            },
            required: ["lines"],
          },
        },
      });

      if (!res.ok) return { ok: false, reason: res.reason };

      const num = (v: unknown): number | null => {
        const x = Number(v);
        return Number.isFinite(x) ? x : null;
      };

      const lines: CbCarrierLine[] = [];
      for (const raw of res.data.lines ?? []) {
        const l = raw as Record<string, unknown>;
        const name = String(l.name ?? "").trim();
        const qty = num(l.qty);
        /* A line with no name or no quantity cannot be compared against
           anything, and showing it would only make the list look padded. */
        if (!name || qty === null || qty < 0) continue;
        lines.push({
          code: l.code ? String(l.code).trim().slice(0, 32) : null,
          name: name.slice(0, 200),
          unit: String(l.unit ?? "")
            .trim()
            .slice(0, 8),
          qty,
          unit_price: num(l.unit_price),
          total: num(l.total),
        });
      }

      if (lines.length === 0) return { ok: false, reason: "no_line_items_found" };

      /*
       * Their sketch drives quantities from here on, so a mis-read number is
       * worse than a missing one. Anything non-numeric, negative or absurd for
       * a residential roof is dropped rather than carried forward.
       */
      const CAP: Record<string, number> = {
        total_squares: 400,
        ridge_lf: 4000,
        hip_lf: 4000,
        valley_lf: 4000,
        eave_lf: 6000,
        rake_lf: 6000,
        drip_edge_lf: 10_000,
        step_flashing_lf: 4000,
        wall_flashing_lf: 4000,
        stories: 6,
      };
      const measure: CbCarrierMeasure = {};
      const rawMeasure = res.data.measure ?? {};
      for (const [k, cap] of Object.entries(CAP)) {
        const v = num(rawMeasure[k]);
        if (v !== null && v > 0 && v <= cap) {
          (measure as Record<string, unknown>)[k] = v;
        }
      }
      const pitch = rawMeasure.pitch ? String(rawMeasure.pitch).trim().slice(0, 12) : "";
      if (/\d+\s*[/:]\s*12/.test(pitch)) measure.pitch = pitch;

      return {
        ok: true,
        result: {
          carrier: res.data.carrier ? String(res.data.carrier).slice(0, 120) : null,
          claimNumber: res.data.claim_number ? String(res.data.claim_number).slice(0, 60) : null,
          total: num(res.data.total),
          lines,
          measure,
        },
      };
    },
  );

const MATCH_SYSTEM = `You match items of roofing scope to the line items on an insurance carrier's estimate.

You are given OUR SCOPE (things this roof has, each with the wording a carrier might use) and THEIR LINES (numbered line items from the carrier's estimate).

For each of our scope items, return the number of the carrier line that pays for that same work, or null if no line on their estimate covers it.

RULES:
1. Match on the work described, not on wording. "R&R Ridge cap - composition shingles" covers our "Ridge cap".
2. One carrier line may cover only one of our items. Pick the closest.
3. A line that covers different work is not a match. Never match "Remove and replace pipe jack" to our ridge vent because both are on the roof.
4. When you are not sure, return null. A missed match shows up as a question a human answers; a wrong match hides real money.
5. Never invent a line number. Only use numbers that appear in THEIR LINES.`;

export const cbMatchCarrierLines = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => MatchInput.parse(data))
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; matches: { id: string; lineIndex: number | null }[] }
      | { ok: false; reason: string }
    > => {
      const { claudeStructured } = await import("@/lib/claude.server");

      const scopeText = data.scope
        .map((s: { id: string; label: string; unit: string; aka: string }) =>
          `- ${s.id} · ${s.label} (${s.unit}) · also written as: ${s.aka}`.trim(),
        )
        .join("\n");
      const linesText = data.lines
        .map(
          (l: { name: string; unit: string; qty: number }, i: number) =>
            `${i}. ${l.name} — ${l.qty} ${l.unit}`,
        )
        .join("\n");

      const res = await claudeStructured<{ matches?: unknown[] }>({
        system: MATCH_SYSTEM,
        user: `OUR SCOPE:\n${scopeText}\n\nTHEIR LINES:\n${linesText}`,
        budgetMs: 45_000,
        maxTokens: 4_000,
        tool: {
          name: "record_matches",
          description: "For each of our scope items, the carrier line that covers it, or null.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    line_index: { type: ["integer", "null"] },
                  },
                  required: ["id", "line_index"],
                },
              },
            },
            required: ["matches"],
          },
        },
      });

      if (!res.ok) return { ok: false, reason: res.reason };

      /*
       * A scope id the model made up, or a line number that does not exist,
       * would put a gap on screen with nothing behind it. Both are dropped,
       * and an unmatched id falls through to null below — which reads as
       * "the carrier did not pay for this", the safe direction to be wrong in
       * for a rep who reviews every item before it moves.
       */
      const known = new Set(data.scope.map((s: { id: string }) => s.id));
      const seenLine = new Set<number>();
      const byId = new Map<string, number | null>();

      for (const raw of res.data.matches ?? []) {
        const mm = raw as { id?: unknown; line_index?: unknown };
        const id = String(mm.id ?? "");
        if (!known.has(id) || byId.has(id)) continue;

        const idx = Number(mm.line_index);
        const valid =
          mm.line_index !== null &&
          Number.isInteger(idx) &&
          idx >= 0 &&
          idx < data.lines.length &&
          !seenLine.has(idx);
        if (valid) seenLine.add(idx);
        byId.set(id, valid ? idx : null);
      }

      return {
        ok: true,
        matches: data.scope.map((s: { id: string }) => ({
          id: s.id,
          lineIndex: byId.get(s.id) ?? null,
        })),
      };
    },
  );

/** Re-exported so the tab can type its scope without importing the lib twice. */
export type { CbScopeItem };

/* ------------------------------------------------------------------ */
/* photos                                                              */
/* ------------------------------------------------------------------ */

const PhotoInput = z.object({
  /** Signed URLs for the job's inspection photos. */
  images: z.array(z.string().url()).min(1).max(20),
  /** What the rep already recorded, so the model does not re-report it. */
  known: z.array(z.string()).max(80),
});

export interface CbPhotoFinding {
  /** Plain-language item, resolved against the price book by the caller. */
  label: string;
  unit: string;
  qty: number | null;
  /** What is visible in the photo that supports it. */
  seen: string;
  /** Index of the photo it was seen in. */
  photo: number;
}

const PHOTO_SYSTEM = `You look at roof and exterior inspection photos and report only what is visibly damaged or visibly present.

RULES:
1. Report only what you can SEE in the photograph. Never infer what is probably there.
2. "seen" must describe the visible evidence in the photo — "creased shingle tabs, upper left" — not a conclusion about the claim.
3. If you cannot count something, set qty null. A count you guessed is worse than no count.
4. Do not report anything already in KNOWN — the inspector has that.
5. Never state or imply that damage was caused by any particular event, and never mention hail or wind unless the physical signature is unmistakable in the image.
6. Return nothing at all rather than something you are unsure of. An empty list is a correct answer.`;

/**
 * What the photos support, on top of what the rep already wrote down.
 *
 * Kept separate from the carrier parse so a slow or failed vision pass never
 * costs the rep the carrier's line items, which are the part they cannot
 * reconstruct by hand.
 */
export const cbSupplementPhotoFindings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PhotoInput.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; findings: CbPhotoFinding[] } | { ok: false; reason: string }> => {
      const { claudeStructured } = await import("@/lib/claude.server");

      const content: unknown[] = data.images.map((url: string) => ({
        type: "image",
        source: { type: "url", url },
      }));
      content.push({
        type: "text",
        text: `KNOWN — already recorded by the inspector, do not repeat:\n${
          data.known.join("\n") || "(nothing)"
        }\n\nReport what these photos visibly support that is not in KNOWN.`,
      });

      const res = await claudeStructured<{ findings?: unknown[] }>({
        system: PHOTO_SYSTEM,
        content,
        budgetMs: 90_000,
        maxTokens: 4_000,
        tool: {
          name: "record_photo_findings",
          description: "Items the photographs visibly support.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    unit: { type: "string" },
                    qty: { type: ["number", "null"] },
                    seen: { type: "string" },
                    photo: { type: "integer" },
                  },
                  required: ["label", "unit", "seen", "photo"],
                },
              },
            },
            required: ["findings"],
          },
        },
      });

      if (!res.ok) return { ok: false, reason: res.reason };

      const findings: CbPhotoFinding[] = [];
      for (const raw of res.data.findings ?? []) {
        const f = raw as Record<string, unknown>;
        const label = String(f.label ?? "").trim();
        const seen = String(f.seen ?? "").trim();
        const photo = Number(f.photo);
        /* No evidence sentence and no real photo means nothing a rep could
           defend, whatever the label says. */
        if (!label || !seen) continue;
        if (!Number.isInteger(photo) || photo < 0 || photo >= data.images.length) continue;
        const qty = Number(f.qty);
        findings.push({
          label: label.slice(0, 120),
          unit:
            String(f.unit ?? "EA")
              .trim()
              .toUpperCase()
              .slice(0, 8) || "EA",
          qty: Number.isFinite(qty) && qty > 0 ? qty : null,
          seen: seen.slice(0, 200),
          photo,
        });
      }

      return { ok: true, findings: findings.slice(0, 20) };
    },
  );
