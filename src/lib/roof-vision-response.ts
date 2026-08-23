type ResponseContent = { text?: string; type?: string };
type ResponseOutput = { content?: ResponseContent[] };
type ResponsePayload = { output_text?: string; output?: ResponseOutput[] };
type ResponseEvent = {
  type?: string;
  delta?: string;
  text?: string;
  response?: ResponsePayload;
};

function payloadText(payload?: ResponsePayload): string {
  if (payload?.output_text) return payload.output_text;
  return (payload?.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .join("");
}

/** Extract final text from the gateway's streamed Responses API payload. */
export function parseResponsesApiText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Also accept a completed non-SSE payload so the parser remains tolerant of
  // gateway/proxy response normalization.
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as ResponseEvent & ResponsePayload;
      return payloadText(parsed.response ?? parsed);
    } catch {
      // Continue with SSE parsing.
    }
  }

  let deltas = "";
  let completed = "";
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      const event = JSON.parse(data) as ResponseEvent;
      if (event.type === "response.output_text.delta") {
        deltas += event.delta ?? event.text ?? "";
      } else if (event.type === "response.output_text.done" && !deltas) {
        completed = event.text ?? event.delta ?? completed;
      } else if (event.type === "response.completed") {
        completed = payloadText(event.response) || completed;
      }
    } catch {
      // Ignore keepalives and non-JSON event blocks.
    }
  }
  return deltas || completed;
}