import { polygonAreaSqft } from "@/lib/roof-math";

type Point = { x: number; y: number };

export type VisionRoofTrace = {
  ring: number[][];
  confidence: number;
  edgeConfidence: number[];
};

const IMAGE_SIZE = 1024;
const ZOOM = 20;
const TILE_SIZE = 512;

function mercator(lng: number, lat: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unmercator(x: number, y: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return [lng, (180 / Math.PI) * Math.atan(Math.sinh(n))];
}

function normalizedToLngLat(point: Point, center: { lat: number; lng: number }): [number, number] {
  const c = mercator(center.lng, center.lat, ZOOM);
  return unmercator(
    c.x + (point.x - 0.5) * IMAGE_SIZE,
    c.y + (point.y - 0.5) * IMAGE_SIZE,
    ZOOM,
  );
}

function ringToNormalized(ring: number[][], center: { lat: number; lng: number }): Point[] {
  const c = mercator(center.lng, center.lat, ZOOM);
  return ring.slice(0, 24).map(([lng, lat]) => {
    const p = mercator(lng, lat, ZOOM);
    return { x: (p.x - c.x) / IMAGE_SIZE + 0.5, y: (p.y - c.y) / IMAGE_SIZE + 0.5 };
  });
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function parseResponseText(raw: string): string {
  let text = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6);
    if (payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        delta?: string;
        response?: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      };
      if (event.type === "response.output_text.delta" && event.delta) text += event.delta;
      if (!text && event.type === "response.completed") {
        text =
          event.response?.output_text ??
          event.response?.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ??
          "";
      }
    } catch {
      // Ignore keepalive and non-JSON SSE lines.
    }
  }
  return text;
}

/**
 * Traces already produced for a pin. Re-measuring the same house (a retry, a
 * back-navigation, a second pin on the same structure) returns instantly
 * instead of paying for the whole vision round trip again.
 */
const traceCache = new Map<string, { trace: VisionRoofTrace; at: number }>();
const TRACE_TTL_MS = 1000 * 60 * 30;
/** ~1 m of latitude — same house, same key. */
const pinKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export async function traceRoofFromPin(params: {
  lat: number;
  lng: number;
  candidateRing?: number[][] | null;
}): Promise<VisionRoofTrace | null> {
  const mapboxKey = process.env.MAPBOX_API_TOKEN;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!mapboxKey || !lovableKey) return null;

  const key = pinKey(params.lat, params.lng);
  const hit = traceCache.get(key);
  if (hit && Date.now() - hit.at < TRACE_TTL_MS) return hit.trace;
  if (hit) traceCache.delete(key);


  const imageUrl =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${params.lng},${params.lat},${ZOOM},0/${IMAGE_SIZE}x${IMAGE_SIZE}?access_token=${mapboxKey}`;
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return null;
  const imageType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageBytes = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
  const imageData = `data:${imageType};base64,${imageBytes}`;
  const candidate = params.candidateRing?.length
    ? ringToNormalized(params.candidateRing, params)
    : [];

  const prompt = `Return JSON that traces exactly ONE roof footprint in this north-up satellite image.
The dropped pin is exactly at normalized image coordinate x=0.5, y=0.5. Sample the roof color and texture at that pin and follow that same roof surface to its true outer boundary. Separate it from similar-colored patios, concrete, driveways, neighboring roofs, and cast shadows. Shadows may bend or darken an edge; continue the physical roof line through them. Visible gutters, fascia, and drip edges are strong boundary evidence. Do not trace individual roof facets or internal ridge/hip/valley lines. Return one clockwise outer polygon only.
An existing vector/solar candidate is provided as normalized points and is guidance, not ground truth: ${JSON.stringify(candidate)}.
Every x and y must be between 0 and 1. Keep only meaningful corners (3-24 points). Include one confidence value per polygon edge in the same order.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      stream: true,
      /*
       * Minimal effort, no reasoning summary. Medium effort routinely pushed
       * this past the caller's budget, and a timed-out trace silently became
       * the box-fitted rectangle — the "square roof" the reps kept seeing.
       */
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageData, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "roof_trace",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              points: {
                type: "array",
                minItems: 3,
                maxItems: 24,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { x: { type: "number" }, y: { type: "number" } },
                  required: ["x", "y"],
                },
              },
              confidence: { type: "number" },
              edge_confidence: { type: "array", items: { type: "number" } },
            },
            required: ["points", "confidence", "edge_confidence"],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    console.warn("[roof-vision] gateway failed", response.status, (await response.text()).slice(0, 300));
    return null;
  }

  const output = parseResponseText(await response.text());
  if (!output) return null;
  let parsed: { points?: Point[]; confidence?: number; edge_confidence?: number[] };
  try {
    parsed = JSON.parse(output) as typeof parsed;
  } catch {
    return null;
  }
  const points = (parsed.points ?? []).filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
  );
  if (points.length < 3 || points.length > 24) return null;
  const ring = points.map((point) => normalizedToLngLat(point, params));
  const area = polygonAreaSqft(ring);
  if (area < 80 || area > 40_000) return null;
  const pin: [number, number] = [params.lng, params.lat];
  if (!pointInRing(pin, ring)) return null;
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const edgeConfidence = ring.map((_, index) =>
    Math.max(0, Math.min(1, Number(parsed.edge_confidence?.[index] ?? confidence))),
  );
  const trace = { ring, confidence, edgeConfidence };
  traceCache.set(key, { trace, at: Date.now() });
  return trace;
}