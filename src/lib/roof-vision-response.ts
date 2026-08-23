type ResponseContent = { text?: string; type?: string };
type ResponseOutput = { content?: ResponseContent[] };
type ResponseEvent = {
  type?: string;
  delta?: string;
  text?: string;
  response?: { output_text?: string; output?: ResponseOutput[] };
};

function completedText(event: ResponseEvent): string {
  if (event.response?.output_text) return event.response.output_text;
  return (event.response?.output ?? [])
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
      const parsed = JSON.parse(trimmed) as ResponseEvent;
      return parsed.output_text ?? completedText({ response: parsed.response ?? parsed });
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
        completed = completedText(event) || completed;
      }
    } catch {
      // Ignore keepalives and non-JSON event blocks.
    }
  }
  return deltas || completed;
}