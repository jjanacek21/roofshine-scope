/**
 * Server-only helpers for the marketing-site AI editor.
 * Nothing here is importable from the browser.
 */

export const CB_SITE_AI_TABLES = [
  "cb_site_blocks",
  "cb_site_faq",
  "cb_site_videos",
  "cb_site_media",
] as const;

export type CbSiteAiTable = (typeof CB_SITE_AI_TABLES)[number];

/** Columns the model is allowed to touch, per table. */
export const ALLOWED_COLUMNS: Record<CbSiteAiTable, string[]> = {
  // blocks are edited through their jsonb `content`
  cb_site_blocks: ["content"],
  cb_site_faq: ["question", "answer", "category", "sort_order", "is_published"],
  cb_site_videos: [
    "title",
    "description",
    "video_url",
    "section",
    "sort_order",
    "is_published",
  ],
  // storage_path and media_key are never editable
  cb_site_media: ["title", "caption", "category", "sort_order"],
};

export const SYSTEM_PROMPT = `You edit the content of a marketing site for Claim Buddy, an insurance restoration inspection and estimating app made by Global Contractor Network, a Florida roofing contractor. You return JSON patches only.

Voice: plain, concrete, addressed to a roofing contractor. Short sentences. No marketing throat-clearing, no 'revolutionary', no 'seamless', no exclamation marks, no emoji.

Never invent a statistic, a price, a customer, a certification or a code section. If a change would need a fact you were not given, put it in 'questions' instead of guessing.

Change only what was asked. Do not tidy neighbouring copy you were not asked about — every extra edit is one more thing for the owner to review.

Preserve the exact jsonb shape. Never add or remove keys unless told to.`;

export const OUTPUT_CONTRACT = `Reply with a single JSON object and nothing else. No prose, no markdown fence.

Shape:
{
  "answer": "only when the user asked a question rather than requesting a change; otherwise omit or leave empty",
  "changes": [
    { "table": "cb_site_blocks|cb_site_faq|cb_site_videos|cb_site_media",
      "row_key": "the row's key (cb_site_blocks) or id (all other tables); use \\"new\\" to add an FAQ entry",
      "path": "for cb_site_blocks: a dotted path inside content, e.g. hero.headline. For other tables: the column name, e.g. question",
      "old": "the exact current value, or \\"\\" for a new FAQ row",
      "new": "the replacement value",
      "why": "one short line" }
  ],
  "questions": ["anything you would have had to invent"]
}

Rules enforced outside your control, so do not attempt them:
- only those four tables exist
- cb_site_media accepts only title, caption, category, sort_order
- inserts are only possible on cb_site_faq (row_key "new", supply path "question" and "answer" as two changes sharing row_key "new:1", "new:2" per new entry)
- everything else is an update
If the user asked a question rather than for a change, answer it in "answer" and return "changes": [].`;

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export interface ModelResult {
  raw: string;
  parsed: { answer?: string; changes?: unknown[]; questions?: unknown[] };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("not json");
  }
}

async function callAnthropic(apiKey: string, userContent: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: `${SYSTEM_PROMPT}\n\n${OUTPUT_CONTRACT}`,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const json = (await res.json()) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(json?.error?.message || `Model request failed (${res.status}).`);
  }
  return (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

/** Calls the model, retrying once when the reply is not usable JSON. */
export async function askModel(apiKey: string, userContent: string): Promise<ModelResult> {
  let lastRaw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const content =
      attempt === 0
        ? userContent
        : `${userContent}\n\nYour previous reply was not valid JSON matching the contract. Reply again with the JSON object only.\n\nPrevious reply:\n${lastRaw.slice(0, 2000)}`;
    lastRaw = await callAnthropic(apiKey, content);
    try {
      const parsed = extractJson(lastRaw) as ModelResult["parsed"];
      if (parsed && typeof parsed === "object") return { raw: lastRaw, parsed };
    } catch {
      /* retry once */
    }
  }
  throw new Error(`The model did not return valid JSON. Raw reply:\n${lastRaw.slice(0, 800)}`);
}
