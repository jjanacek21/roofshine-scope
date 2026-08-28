import { createFileRoute } from "@tanstack/react-router";

/**
 * One fixed aerial photograph for the public measurement demo.
 *
 * The marketing page is served to signed-out visitors, so it cannot be handed
 * a Mapbox token the way the signed-in measurement tool is. This route fetches
 * the still image server-side and returns the bytes, which keeps the token
 * private. The response is cached hard at the edge, so the whole demo costs a
 * handful of Mapbox requests rather than one per visitor.
 *
 * `h` picks between a small set of pre-chosen roofs. It is an allow-list, not a
 * free lat/lng parameter, so the route can never be turned into an open proxy
 * against the Mapbox bill.
 */

const HOUSES: Record<string, { lng: number; lat: number; zoom: number }> = {
  "1": { lng: -80.6187, lat: 28.0206, zoom: 19.4 },
  "2": { lng: -80.6402, lat: 28.0281, zoom: 19.4 },
  "3": { lng: -80.6053, lat: 28.0104, zoom: 19.4 },
  "4": { lng: -80.6284, lat: 27.9968, zoom: 19.4 },
  "5": { lng: -80.6339, lat: 28.0417, zoom: 19.4 },
  "6": { lng: -80.5975, lat: 28.035, zoom: 19.4 },
  "7": { lng: -80.6491, lat: 28.0125, zoom: 19.4 },
  "8": { lng: -80.6118, lat: 27.9885, zoom: 19.4 },
};

const WIDTH = 1000;
const HEIGHT = 650;

export const Route = createFileRoute("/api/demo-aerial")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("h") ?? "1";
        const spot = HOUSES[key] ?? HOUSES["1"];

        const token = process.env.MAPBOX_API_TOKEN;
        if (!token) return new Response("Imagery not configured", { status: 500 });

        const src =
          `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
          `${spot.lng},${spot.lat},${spot.zoom},0/${WIDTH}x${HEIGHT}@2x` +
          `?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`;

        const upstream = await fetch(src);
        if (!upstream.ok || !upstream.body) {
          return new Response("Imagery unavailable", { status: 502 });
        }

        return new Response(upstream.body, {
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
            "cache-control": "public, max-age=86400, s-maxage=2592000",
          },
        });
      },
    },
  },
});
