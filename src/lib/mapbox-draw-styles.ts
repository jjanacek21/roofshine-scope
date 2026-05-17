// Custom Mapbox GL Draw styles. Polygons get a brand-blue translucent fill,
// lines are colored by feature.properties.edge_type, points are brand-blue dots.

import { LINE_COLORS } from "@/lib/roof-math";

export const MAPBOX_DRAW_STYLES = [
  // ---------- Polygon fill ----------
  // Inactive polygons: very dim while drawing a new one so clicks pass through
  // the perceived shape and the user can keep adding vertices on top of it.
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": "#1e90ff",
      "fill-outline-color": "#1e90ff",
      "fill-opacity": [
        "case",
        ["==", ["get", "active"], "true"], 0.15,
        0.12,
      ],
    },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1e90ff", "line-width": 2 },
  },

  // ---------- Lines (colored per edge_type) ----------
  {
    id: "gl-draw-line",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "user_color"], "#ffffff"],
      "line-width": 3,
      "line-dasharray": [
        "case",
        ["==", ["get", "active"], "true"],
        ["literal", [0.4, 2]],
        ["literal", [1, 0]],
      ],
    },
  },

  // ---------- Vertex points ----------
  // ---------- Vertex points ----------
  // Bigger hit targets so corner pins are easier to grab and drag.
  {
    id: "gl-draw-polygon-and-line-vertex-halo-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: { "circle-radius": 11, "circle-color": "#ffffff" },
  },
  {
    id: "gl-draw-polygon-and-line-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: { "circle-radius": 7, "circle-color": LINE_COLORS.unlabeled },
  },
  // ---------- Midpoints ----------
  // Hidden: midpoint pins between vertices were being mistaken for corner
  // vertices. Users only want pins at corners they explicitly clicked.
  // (To add a new corner, click the polygon edge in direct_select mode and
  // drag — the midpoint is still functionally there, just not rendered.)
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: {
      "circle-radius": 0,
      "circle-opacity": 0,
    },
  },

  // ---------- Standalone points (penetrations) ----------
  {
    id: "gl-draw-point",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["!=", "meta", "midpoint"], ["!=", "meta", "vertex"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 7,
      "circle-color": "#1e90ff",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  },
];

// Penetration types (separate from edge types — these go on Point features)
export const PENETRATION_TYPES = [
  "pipe_boot",
  "vent",
  "skylight",
  "chimney",
  "hvac_curb",
  "satellite",
  "solar_mount",
] as const;
export type PenetrationType = (typeof PENETRATION_TYPES)[number];

export const PENETRATION_LABELS: Record<PenetrationType, string> = {
  pipe_boot: "Pipe Boot",
  vent: "Vent",
  skylight: "Skylight",
  chimney: "Chimney",
  hvac_curb: "HVAC Curb",
  satellite: "Satellite",
  solar_mount: "Solar Mount",
};
