import { describe, expect, it } from "vitest";
import { checkOutline } from "./roof-outline";
import { prepareTraceRing } from "./roof-trace-geometry";
import { parseResponsesApiText } from "./roof-vision-response";

const traceJson = JSON.stringify({
  points: [
    { x: 0.35, y: 0.4 },
    { x: 0.58, y: 0.32 },
    { x: 0.7, y: 0.48 },
    { x: 0.62, y: 0.67 },
    { x: 0.39, y: 0.7 },
    { x: 0.29, y: 0.52 },
  ],
  confidence: 0.91,
  edge_confidence: [0.9, 0.88, 0.92, 0.9, 0.89, 0.91],
});

describe("roof vision response", () => {
  it("joins streamed output deltas across CRLF SSE blocks", () => {
    const midpoint = Math.floor(traceJson.length / 2);
    const raw = [
      `event: response.output_text.delta\r\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: traceJson.slice(0, midpoint) })}`,
      `event: response.output_text.delta\r\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: traceJson.slice(midpoint) })}`,
      `event: response.completed\r\ndata: ${JSON.stringify({ type: "response.completed", response: { output: [] } })}`,
      "data: [DONE]",
    ].join("\r\n\r\n");
    expect(parseResponsesApiText(raw)).toBe(traceJson);
  });

  it("reads final text from a completed response content item", () => {
    const raw = `data: ${JSON.stringify({
      type: "response.completed",
      response: { output: [{ content: [{ type: "output_text", text: traceJson }] }] },
    })}\n\n`;
    expect(parseResponsesApiText(raw)).toBe(traceJson);
  });

  it("keeps one valid outline through trace preparation", () => {
    const ring = [
      [-96.7002, 33.011],
      [-96.6998, 33.0112],
      [-96.6995, 33.0109],
      [-96.6997, 33.0105],
      [-96.7001, 33.0104],
      [-96.7003, 33.0107],
    ];
    const prepared = prepareTraceRing(ring);
    expect(prepared).not.toBeNull();
    expect(checkOutline(prepared?.ring ?? []).ok).toBe(true);
  });
});