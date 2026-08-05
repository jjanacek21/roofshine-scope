import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Pencil, RotateCcw, Save, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { polygonAreaSqft } from "@/lib/roof-math";

export type EditableFootprint = {
  id: string;
  ring: number[][];
  originalRing?: number[][];
};

type Props = {
  map: mapboxgl.Map | null;
  footprints: EditableFootprint[];
  onChange: (footprints: EditableFootprint[]) => void;
  onSave?: (footprints: EditableFootprint[]) => Promise<void> | void;
  compact?: boolean;
};

const clone = (items: EditableFootprint[]) =>
  items.map((item) => ({
    ...item,
    ring: item.ring.map((point) => point.slice()),
    originalRing: item.originalRing?.map((point) => point.slice()),
  }));

function closedRing(ring: number[][]) {
  if (ring.length < 3) return ring;
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring.slice();
  return [...open, open[0]];
}

export function FootprintOverlayEditor({ map, footprints, onChange, onSave, compact = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const undoRef = useRef<EditableFootprint[][]>([]);
  const editStartRef = useRef<EditableFootprint[]>([]);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const currentRef = useRef(footprints);
  currentRef.current = footprints;

  useEffect(() => {
    if (!map) return;
    const sourceId = "editable-roof-footprints";
    const fillId = `${sourceId}-fill`;
    const lineId = `${sourceId}-line`;
    const data = () => ({
      type: "FeatureCollection" as const,
      features: currentRef.current
        .filter((item) => item.ring.length >= 3)
        .map((item) => ({
          type: "Feature" as const,
          properties: { id: item.id },
          geometry: { type: "Polygon" as const, coordinates: [closedRing(item.ring)] },
        })),
    });
    const paint = () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getSource(sourceId)) map.addSource(sourceId, { type: "geojson", data: data() });
      if (!map.getLayer(fillId)) {
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": "#facc15", "fill-opacity": 0.38 },
        });
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": "#f59e0b", "line-width": 3 },
        });
      }
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined)?.setData(data());
    };
    paint();
    map.on("load", paint);
    map.on("styledata", paint);
    return () => {
      map.off("load", paint);
      map.off("styledata", paint);
    };
  }, [map, footprints]);

  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (!map || !editing) return;

    const mutate = (itemIndex: number, transform: (ring: number[][]) => number[][]) => {
      undoRef.current = [...undoRef.current.slice(-19), clone(currentRef.current)];
      const next = clone(currentRef.current);
      next[itemIndex].ring = closedRing(transform(next[itemIndex].ring));
      onChange(next);
    };

    footprints.forEach((item, itemIndex) => {
      const ring = closedRing(item.ring);
      const open = ring.slice(0, -1);
      open.forEach((point, vertexIndex) => {
        const element = document.createElement("button");
        element.type = "button";
        element.title = "Drag corner · right-click to delete";
        element.style.cssText = "width:16px;height:16px;border-radius:50%;background:#facc15;border:3px solid #171717;box-shadow:0 1px 4px rgba(0,0,0,.65);cursor:grab";
        const marker = new mapboxgl.Marker({ element, draggable: true }).setLngLat(point as [number, number]).addTo(map);
        marker.on("dragend", () => {
          const location = marker.getLngLat();
          mutate(itemIndex, (value) => {
            const next = closedRing(value).slice(0, -1);
            next[vertexIndex] = [location.lng, location.lat];
            return next;
          });
        });
        element.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          if (open.length <= 3) return;
          mutate(itemIndex, (value) => closedRing(value).slice(0, -1).filter((_, index) => index !== vertexIndex));
        });
        markersRef.current.push(marker);
      });
      open.forEach((point, vertexIndex) => {
        const nextPoint = open[(vertexIndex + 1) % open.length];
        const element = document.createElement("div");
        element.title = "Drag to add a corner";
        element.style.cssText = "width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,.55);cursor:grab";
        const marker = new mapboxgl.Marker({ element, draggable: true })
          .setLngLat([(point[0] + nextPoint[0]) / 2, (point[1] + nextPoint[1]) / 2])
          .addTo(map);
        marker.on("dragend", () => {
          const location = marker.getLngLat();
          mutate(itemIndex, (value) => {
            const next = closedRing(value).slice(0, -1);
            next.splice(vertexIndex + 1, 0, [location.lng, location.lat]);
            return next;
          });
        });
        markersRef.current.push(marker);
      });
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [editing, footprints, map, onChange]);

  if (footprints.length === 0) return null;
  const area = footprints.reduce((sum, item) => sum + polygonAreaSqft(item.ring), 0);

  const begin = () => {
    editStartRef.current = clone(footprints);
    undoRef.current = [];
    setEditing(true);
  };

  return (
    <div className={`flex ${compact ? "flex-col" : "flex-wrap"} gap-2`}>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{Math.round(area).toLocaleString()} sq ft</strong> highlighted</span>
        {!editing && <Button type="button" size="sm" variant="outline" onClick={begin}><Pencil className="h-3.5 w-3.5" /> Edit footprint</Button>}
      </div>
      {editing && (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => {
            const previous = undoRef.current.pop();
            if (previous) onChange(previous);
          }} disabled={undoRef.current.length === 0}><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(footprints.map((item) => ({ ...item, ring: closedRing(item.originalRing ?? item.ring) })))}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { onChange(editStartRef.current); setEditing(false); }}><X className="h-3.5 w-3.5" /> Cancel</Button>
          <Button type="button" size="sm" disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onSave?.(footprints); setEditing(false); } finally { setSaving(false); }
          }}><Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save to brain"}</Button>
        </div>
      )}
    </div>
  );
}