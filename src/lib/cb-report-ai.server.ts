/**
 * Server-only narrative writer for the Claim Buddy damage report.
 * Calls the Lovable AI gateway and returns JSON matching CbAiReport.
 */
import { guardReport, type CbAiInput, type CbAiReport } from "@/lib/cbReportAi";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const SYSTEM = `You write property storm damage inspection reports for a licensed roofing contractor.
You write in plain, factual, carrier-facing English. Third person. No marketing language.

HARD RULES — breaking any one of these makes the report unusable:
1. The takeoff sheet is the authority for scope. EVERY takeoff line you are given must appear as a row in roof_scope or exterior_scope, even when no photo shows it. Never drop one, never merge two into one row.
2. Photos are a sample, not a catalog. Caption ONLY what the photograph shows. If a photo is unclear, say so in the caption. Never describe damage that is neither photographed nor on the takeoff.
3. If the roof system is asphalt shingle, the roof scope must include the complete replacement set: tear off, underlayment, ice & water shield, starter course, drip edge, valley metal, hip & ridge cap, pipe jacks / accessories, and nails/accessories. Add steep-slope and two-story (high) adders when stories >= 2 or pitch is 7/12 or greater.
4. NEVER print a dollar figure, unit price, total or any money amount unless has_priced_estimate is true.
5. NEVER state or imply that the claim will be approved, covered or paid. NEVER accuse a named insurer of bad faith.
6. Anything unknown is written exactly as "To be confirmed" and also listed in "missing". Never print a bare dash.
7. Quantities you state must come from the takeoff or the measurements given. Never invent a number.

WRITING GUIDE:
- summary: exactly 3 paragraphs. (1) who inspected, when, at whose request, following which event, and what was inspected. (2) what was found, plainly, with the evidence (test squares, granule loss, exposed mat, denting). (3) the professional recommendation — repair vs full replacement — attributed to the contractor.
- Each scope row: component (short noun phrase), condition (what was observed or why the item is required), action (the recommended action WITH the quantity and unit from the takeoff).
- interior_note: what was documented inside, or "Not inspected".
- storm_context: one paragraph about the event in that area and why this damage type is often missed from the ground.
- cover_caption: one sentence describing the front elevation of the structure.
- photo_captions: one entry per photo id supplied, in order, with a short title ("Photo 3 — Ridge Vent") and a factual 1-2 sentence description.
- missing: every fact that came in as "To be confirmed" or that a carrier would need and was not supplied.`;

const CONTRACT = `Reply with ONE JSON object and nothing else. Shape:
{"summary":["p1","p2","p3"],
 "roof_scope":[{"component":"","condition":"","action":""}],
 "exterior_scope":[{"component":"","condition":"","action":""}],
 "interior_note":"","storm_context":"","cover_caption":"",
 "photo_captions":[{"photo_id":"","title":"","description":""}],
 "missing":["..."]}`;

function extractJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The model did not return JSON.");
  }
}

async function call(model: string, apiKey: string, userContent: string): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${SYSTEM}\n\n${CONTRACT}` },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) throw new Error("The report writer is rate limited right now — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
    throw new Error(`Report writer failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function writeReportNarrative(input: CbAiInput): Promise<CbAiReport> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("The AI report writer is not configured.");
  const userContent = JSON.stringify(input);

  let lastError: unknown = null;
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      const raw = await call(model, apiKey, userContent);
      const parsed = extractJson(raw) as CbAiReport;
      if (parsed && typeof parsed === "object") return guardReport(parsed, input.has_priced_estimate);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The report writer did not return a usable report.");
}
