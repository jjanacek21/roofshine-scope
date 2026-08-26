import { polygonAreaSqft } from "@/lib/roof-math";
import { checkOutline } from "@/lib/roof-outline";
import { parseResponsesApiText } from "@/lib/roof-vision-response";

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

/**
 * Traces already produced for a pin. Re-measuring the same house (a retry, a
 * back-navigation, a second pin on the same structure) returns instantly
 * instead of paying for the whole vision round trip again.
 */
const traceCache = new Map<string, { trace: VisionRoofTrace; at: number }>();
const TRACE_TTL_MS = 1000 * 60 * 30;
/** ~1 m of latitude — same house, same key. */
const pinKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Deadlines this tracer owns. See `budgetMs` below for why they live here. */
const DEFAULT_GATEWAY_MS = 34_000;
const IMAGE_MS = 10_000;

export async function traceRoofFromPin(params: {
  lat: number;
  lng: number;
  candidateRing?: number[][] | null;
  /**
   * How long to give the vision gateway.
   *
   * A stalled gateway used to hang until the CALLER's race gave up, which
   * handed back null with nothing to report — and a reasonless null reached
   * the rep as "No satellite roof data for this address". That sent them off
   * to hand-draw a roof the tracer finds on the next try. Owning the deadline
   * here means every failure arrives with a reason attached.
   */
  budgetMs?: number;
  /** Called when the tracer itself failed (not "this roof has no coverage"). */
  onError?: (reason: string) => void;
}): Promise<VisionRoofTrace | null> {
  const mapboxKey = process.env.MAPBOX_API_TOKEN;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!mapboxKey || !lovableKey) {
    params.onError?.("tracer_not_configured");
    return null;
  }

  const key = pinKey(params.lat, params.lng);
  const hit = traceCache.get(key);
  if (hit && Date.now() - hit.at < TRACE_TTL_MS && checkOutline(hit.trace.ring).ok) return hit.trace;
  if (hit) traceCache.delete(key);


  const imageUrl =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${params.lng},${params.lat},${ZOOM},0/${IMAGE_SIZE}x${IMAGE_SIZE}?access_token=${mapboxKey}`;
  let imageData: string;
  try {
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_MS) });
    if (!imageResponse.ok) {
      params.onError?.(`tracer_image_${imageResponse.status}`);
      return null;
    }
    const imageType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
    imageData = `data:${imageType};base64,${imageBytes}`;
  } catch (error) {
    console.warn(
      "[roof-vision] satellite image unreachable",
      error instanceof Error ? error.message : String(error),
    );
    params.onError?.("tracer_image_unreachable");
    return null;
  }
  // Generic solar/building boxes are useful for location but poison the vision
  // trace by encouraging the exact rectangle the outline invariant forbids.
  const candidate = params.candidateRing?.length && checkOutline(params.candidateRing).ok
    ? ringToNormalized(params.candidateRing, params)
    : [];

  const prompt = `Return JSON that traces exactly ONE roof footprint in this north-up satellite image.
The dropped pin is exactly at normalized image coordinate x=0.5, y=0.5. Sample the roof color and texture at that pin and follow that same roof surface to its true outer boundary. Separate it from similar-colored patios, concrete, driveways, neighboring roofs, and cast shadows. Shadows may bend or darken an edge; continue the physical roof line through them. Visible gutters, fascia, and drip edges are strong boundary evidence. Do not trace individual roof facets or internal ridge/hip/valley lines. Return one clockwise outer polygon only.
An existing vector/solar candidate is provided as normalized points and is guidance, not ground truth: ${JSON.stringify(candidate)}.
The result must follow the visible roof edge corner by corner. Never return the roof's bounding box, a generic square, or a 4-point axis-aligned rectangle. Include visible offsets, bump-outs, and direction changes; use at least 5 meaningful corners and at most 24. Every x and y must be between 0 and 1. Include one confidence value per polygon edge in the same order.`;

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      signal: AbortSignal.timeout(params.budgetMs ?? DEFAULT_GATEWAY_MS),
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
         * Low effort was fast but repeatedly approximated real roofs as boxes.
         * Streaming keeps the request alive while medium effort follows edges.
         */
        reasoning: { effort: "medium" },
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
                  minItems: 5,
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
  } catch (error) {
    /* AbortSignal.timeout rejects with TimeoutError; a dropped connection
       rejects with something else. The rep needs to know which, because one
       is worth retrying on the spot and the other is not. */
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.warn(
      "[roof-vision] gateway unreachable",
      error instanceof Error ? error.message : String(error),
    );
    params.onError?.(timedOut ? "tracer_timed_out" : "tracer_unreachable");
    return null;
  }
  if (!response.ok) {
    console.warn("[roof-vision] gateway failed", response.status, (await response.text()).slice(0, 300));
    params.onError?.(`tracer_unavailable_${response.status}`);
    return null;
  }

  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    /* The response streams. A stream that dies halfway is a broken read, not
       a roof with no coverage. */
    console.warn(
      "[roof-vision] stream broke",
      error instanceof Error ? error.message : String(error),
    );
    params.onError?.("tracer_stream_broken");
    return null;
  }

  const output = parseResponsesApiText(body);
  if (!output) {
    console.warn("[roof-vision] empty model output");
    params.onError?.("tracer_empty_output");
    return null;
  }
  let parsed: { points?: Point[]; confidence?: number; edge_confidence?: number[] };
  try {
    parsed = JSON.parse(output) as typeof parsed;
  } catch {
    console.warn("[roof-vision] invalid model JSON", output.slice(0, 200));
    params.onError?.("tracer_invalid_json");
    return null;
  }
  const points = (parsed.points ?? []).filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
  );
  if (points.length < 3 || points.length > 24) {
    params.onError?.("tracer_invalid_points");
    return null;
  }
  const ring = points.map((point) => normalizedToLngLat(point, params));
  const area = polygonAreaSqft(ring);
  if (area < 80 || area > 40_000) {
    params.onError?.("tracer_invalid_area");
    return null;
  }
  const pin: [number, number] = [params.lng, params.lat];
  if (!pointInRing(pin, ring)) {
    params.onError?.("tracer_pin_outside_outline");
    return null;
  }
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const edgeConfidence = ring.map((_, index) =>
    Math.max(0, Math.min(1, Number(parsed.edge_confidence?.[index] ?? confidence))),
  );
  const outlineCheck = checkOutline(ring);
  if (!outlineCheck.ok) {
    console.warn("[roof-vision] rejected model outline", outlineCheck.problems);
    params.onError?.(`tracer_${outlineCheck.problems[0] ?? "invalid_outline"}`);
    return null;
  }
  const trace = { ring, confidence, edgeConfidence };
  traceCache.set(key, { trace, at: Date.now() });
  return trace;
}