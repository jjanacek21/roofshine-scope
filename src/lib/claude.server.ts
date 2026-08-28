/**
 * Server-only Anthropic client.
 *
 * Separate from the Lovable AI gateway on purpose. That gateway carries only
 * Google and OpenAI models — no Anthropic — so anything that wants Claude has
 * to come here, and it bills to the Anthropic account rather than to Lovable
 * credits.
 *
 * Everything that calls a model from a phone on a roof needs the same three
 * things, so they live here once: a deadline this code owns, one retry for
 * failures that are worth retrying, and an error a rep can act on.
 */

const API = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

/** Overridable so a model change is an env edit, not a deploy. */
const MODEL = process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5";
const DEFAULT_BUDGET_MS = 25_000;

export type ClaudeResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; retryable: boolean };

type Tool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

/**
 * Ask Claude for ONE structured object.
 *
 * Uses a single tool with `tool_choice` forced, rather than asking for JSON in
 * prose and parsing it back. A model that must fill a schema cannot answer with
 * an apology, a code fence or a second paragraph — all three of which the older
 * prose-and-parse path in cb-report-ai.server.ts has to defend against.
 */
export async function claudeStructured<T>(opts: {
  system: string;
  user: string;
  tool: Tool;
  budgetMs?: number;
  maxTokens?: number;
}): Promise<ClaudeResult<T>> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) return { ok: false, reason: "claude_not_configured", retryable: false };

  const body = JSON.stringify({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
  });

  const attempt = async (budget: number): Promise<ClaudeResult<T>> => {
    let res: Response;
    try {
      res = await fetch(API, {
        signal: AbortSignal.timeout(budget),
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": VERSION,
        },
        body,
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      console.warn("[claude] unreachable", error instanceof Error ? error.message : String(error));
      return {
        ok: false,
        reason: timedOut ? "claude_timed_out" : "claude_unreachable",
        retryable: true,
      };
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.warn("[claude] http", res.status, detail);
      /* 429 and 5xx clear on their own; 400 and 401 never will. */
      return {
        ok: false,
        reason:
          res.status === 429
            ? "claude_rate_limited"
            : res.status === 401
              ? "claude_bad_key"
              : `claude_http_${res.status}`,
        retryable: res.status === 429 || res.status >= 500,
      };
    }

    let json: { content?: { type: string; name?: string; input?: unknown }[] };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      return { ok: false, reason: "claude_bad_body", retryable: true };
    }

    const block = (json.content ?? []).find(
      (c) => c.type === "tool_use" && c.name === opts.tool.name,
    );
    if (!block?.input) return { ok: false, reason: "claude_no_tool_use", retryable: true };
    return { ok: true, data: block.input as T };
  };

  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const first = await attempt(budget);
  if (first.ok || !first.retryable) return first;

  console.warn("[claude] retrying after", first.reason);
  return attempt(Math.round(budget * 0.6));
}
