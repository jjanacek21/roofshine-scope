import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Turn what a rep said on the roof into takeoff fields.
 *
 * The model never touches the sheet. It returns findings; this function drops
 * anything outside the whitelist, and the rep confirms what is left before a
 * single field changes. Three gates, because a mis-heard number on a windy roof
 * ends up on a document a carrier reads.
 */

const Input = z.object({
  transcript: z.string().trim().min(4).max(20_000),
});

export interface CbVoiceFinding {
  group: string;
  field: string;
  label: string;
  /** Already coerced to the field's kind. */
  value: number | boolean | string;
  unit?: string;
  /** The rep's own words this came from — shown back before anything applies. */
  heard: string;
  /** "high" when they said a number outright, "low" when it was inferred. */
  confidence: "high" | "low";
  /** Set when the value needs a human before it is worth anything. */
  needs?: string;
}

export interface CbVoiceResult {
  findings: CbVoiceFinding[];
  /** Damage wording for the report that is not a takeoff field. */
  notes: string[];
}

const SYSTEM = `You convert a roofing inspector's spoken notes into structured takeoff fields.

RULES — breaking any one of these makes the result unusable:
1. Only ever use fields from the schema you are given. Never invent a field.
2. Never invent a quantity. If the inspector described something but gave no number, still return the finding, set confidence "low" and put what is missing in "needs". A missing number is useful; a guessed number is dangerous.
3. "heard" must be a short VERBATIM quote from the transcript. Never paraphrase it. If you cannot quote it, do not return the finding.
4. Spoken numbers become digits: "forty two feet" is 42, "a couple" is not a number.
5. confidence "high" only when the inspector stated the value outright. Anything you worked out from context is "low".
6. Damage description that is not one of these fields — granule loss, exposed mat, creased or lifted shingles, hail bruising, which slope — goes in "notes" as short factual sentences. Never as a field.
7. If the inspector corrects themselves, keep the correction and ignore what it replaced.`;

export const cbParseVoiceTakeoff = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; result: CbVoiceResult } | { ok: false; reason: string }> => {
      const { claudeStructured } = await import("@/lib/claude.server");
      const { CB_VOICE_INDEX, cbVoiceSchemaLines } = await import("@/lib/cbVoiceFields");

      const res = await claudeStructured<{ findings?: unknown[]; notes?: unknown[] }>({
        system: SYSTEM,
        user: `SCHEMA — the only fields you may fill:\n${cbVoiceSchemaLines()}\n\nTRANSCRIPT:\n${data.transcript}`,
        budgetMs: 25_000,
        tool: {
          name: "record_takeoff",
          description: "Record the takeoff fields and damage notes heard in the transcript.",
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
                    group: { type: "string" },
                    field: { type: "string" },
                    value: { type: ["number", "boolean", "string"] },
                    heard: { type: "string" },
                    confidence: { type: "string", enum: ["high", "low"] },
                    needs: { type: "string" },
                  },
                  required: ["group", "field", "value", "heard", "confidence"],
                },
              },
              notes: { type: "array", items: { type: "string" } },
            },
            required: ["findings", "notes"],
          },
        },
      });

      if (!res.ok) return { ok: false, reason: res.reason };

      /*
       * Everything below this line assumes the model got something wrong. It is
       * the last gate before a rep sees a number attached to their own words.
       */
      const findings: CbVoiceFinding[] = [];
      for (const raw of res.data.findings ?? []) {
        const f = raw as Partial<CbVoiceFinding>;
        if (!f?.group || !f?.field) continue;

        const spec = CB_VOICE_INDEX.get(`${f.group}.${f.field}`);
        if (!spec) continue; // off-schema — drop it silently

        /* A quote that is not in the transcript is a fabrication, not a mis-hear. */
        const heard = String(f.heard ?? "").trim();
        if (!heard || !data.transcript.toLowerCase().includes(heard.toLowerCase().slice(0, 24)))
          continue;

        let value: number | boolean | string;
        if (spec.kind === "number") {
          const n = Number(f.value);
          if (!Number.isFinite(n) || n < 0) continue; // no number is better than a wrong one
          value = n;
        } else if (spec.kind === "boolean") {
          value = f.value === true || f.value === "true";
        } else {
          value = String(f.value ?? "").trim();
          if (!value) continue;
        }

        findings.push({
          group: spec.group,
          field: spec.field,
          label: spec.label,
          value,
          unit: spec.unit,
          heard,
          confidence: f.confidence === "high" ? "high" : "low",
          ...(f.needs ? { needs: String(f.needs).slice(0, 160) } : {}),
        });
      }

      const notes = (res.data.notes ?? [])
        .map((n) => String(n).trim())
        .filter(Boolean)
        .slice(0, 12);

      return { ok: true, result: { findings, notes } };
    },
  );
