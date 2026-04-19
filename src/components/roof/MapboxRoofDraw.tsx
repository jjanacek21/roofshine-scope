import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import {
  polygonAreaSqft, polygonEdgeLengths, lineStringLengthFeet,
  EDGE_LABELS, EDGE_COLORS, type EdgeType,
} from "@/lib/roof-math";
import { RoofSectionCard, type SectionState } from "./RoofSectionCard";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

export type RoofLineState = {
  id: string;
  coords: number[][];
  type: EdgeType;
};

export type MapboxRoofData = {
  sections: SectionState[];
  lines: RoofLineState[];
};

export function MapboxRoofDraw({
  center,
  initial,
  onChange,
}: {
  center: { lng: number; lat: number };
  initial?: MapboxRoofData;
  onChange: (data: MapboxRoofData) => void;
}) {
  const { data: token, isLoading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [sections, setSections] = useState<SectionState[]>(initial?.sections ?? []);
  const [lines, setLines] = useState<RoofLineState[]>(initial?.lines ?? []);
  const [pendingLineType, setPendingLineType] = useState<EdgeType>("ridge");

  // Push state up
  useEffect(() => {
    onChange({ sections, lines });
  }, [sections, lines, onChange]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [center.lng, center.lat],
      zoom: 19,
      pitch: 0,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, line_string: true, trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw);
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("draw.create", handleDrawChange);
    map.on("draw.update", handleDrawChange);
    map.on("draw.delete", handleDrawChange);

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, center.lng, center.lat]);

  function handleDrawChange() {
    const d = drawRef.current;
    if (!d) return;
    const fc = d.getAll();
    const newSections: SectionState[] = [];
    const newLines: RoofLineState[] = [];
    fc.features.forEach((f) => {
      if (f.geometry.type === "Polygon") {
        const ring = f.geometry.coordinates[0];
        const existing = sections.find((s) => s.id === String(f.id));
        const edges = polygonEdgeLengths(ring);
        const edgeLabels: (EdgeType | null)[] = existing && existing.edges.length === edges.length
          ? existing.edges
          : edges.map(() => null);
        newSections.push({
          id: String(f.id),
          name: existing?.name ?? `Section ${newSections.length + 1}`,
          color: existing?.color ?? SECTION_COLORS[newSections.length % SECTION_COLORS.length],
          ring,
          plan_area_sqft: polygonAreaSqft(ring),
          pitch: existing?.pitch ?? "6/12",
          edges: edgeLabels,
        });
      } else if (f.geometry.type === "LineString") {
        const coords = f.geometry.coordinates;
        const existing = lines.find((l) => l.id === String(f.id));
        newLines.push({
          id: String(f.id),
          coords,
          type: existing?.type ?? pendingLineType,
        });
      }
    });
    setSections(newSections);
    setLines(newLines);
  }

  function startPolygon() {
    drawRef.current?.changeMode("draw_polygon");
  }
  function startLine(t: EdgeType) {
    setPendingLineType(t);
    drawRef.current?.changeMode("draw_line_string");
  }
  function deleteSection(id: string) {
    drawRef.current?.delete(id);
    setSections((s) => s.filter((x) => x.id !== id));
  }
  function deleteLine(id: string) {
    drawRef.current?.delete(id);
    setLines((l) => l.filter((x) => x.id !== id));
  }
  function updateSection(next: SectionState) {
    setSections((s) => s.map((x) => x.id === next.id ? next : x));
  }
  function updateLineType(id: string, t: EdgeType) {
    setLines((l) => l.map((x) => x.id === id ? { ...x, type: t } : x));
  }

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-xl bg-[var(--surface)]" />;
  }
  if (!token) {
    return (
      <div className="rounded-xl border p-6 text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
        Map unavailable. Mapbox token not configured.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={startPolygon} className="btn-brand h-8 rounded-md px-3 text-xs font-semibold">
            + Roof Section
          </button>
          {(Object.keys(EDGE_LABELS) as EdgeType[]).map((t) => (
            <button
              key={t}
              onClick={() => startLine(t)}
              className="h-8 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
              style={{ borderColor: EDGE_COLORS[t], borderLeftWidth: 4 }}
            >
              + {EDGE_LABELS[t]}
            </button>
          ))}
        </div>
        <div ref={containerRef} className="h-[560px] w-full rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }} />
        <p className="text-[11px] text-muted-foreground">
          Click "+ Roof Section" then click points on the map to draw a polygon. Double-click to finish.
        </p>
      </div>

      <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sections ({sections.length})
        </h3>
        {sections.length === 0 && (
          <p className="text-xs text-muted-foreground">No sections drawn yet.</p>
        )}
        {sections.map((s) => (
          <RoofSectionCard
            key={s.id}
            section={s}
            onChange={updateSection}
            onDelete={() => deleteSection(s.id)}
          />
        ))}

        {lines.length > 0 && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lines ({lines.length})
            </h3>
            {lines.map((l) => {
              const len = lineStringLengthFeet(l.coords);
              return (
                <div key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-xs" style={{ borderColor: "var(--border)" }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[l.type] }} />
                  <select
                    value={l.type}
                    onChange={(e) => updateLineType(l.id, e.target.value as EdgeType)}
                    className="h-7 flex-1 rounded border bg-[var(--bg-elevated)] px-2 text-xs text-foreground"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {(Object.keys(EDGE_LABELS) as EdgeType[]).map((t) => (
                      <option key={t} value={t}>{EDGE_LABELS[t]}</option>
                    ))}
                  </select>
                  <span className="font-mono-num text-muted-foreground">{len.toFixed(1)} ft</span>
                  <button
                    onClick={() => deleteLine(l.id)}
                    className="text-muted-foreground hover:text-red-400"
                    aria-label="Delete line"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
