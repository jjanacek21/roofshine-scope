import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Check, X, Loader2 } from "lucide-react";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { AddressAutocomplete, type AddressResult } from "@/components/maps/AddressAutocomplete";

const DEFAULT_CENTER: [number, number] = [-96.5, 38.5];

/**
 * Pan/zoom a satellite map and drop a pin on the actual house when geocoding
 * put the property in the wrong spot (or found nothing).
 */
export function PropertyLocationPicker({
  initial,
  onSave,
  onCancel,
  isSaving = false,
}: {
  initial: { lat: number; lng: number } | null;
  onSave: (coords: { lat: number; lng: number }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const { data: token, isLoading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(initial);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initial ? [initial.lng, initial.lat] : DEFAULT_CENTER,
      zoom: initial ? 19 : 4,
      maxZoom: 21,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("click", (e) => {
      const next = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      setPicked(next);
    });
    mapRef.current = map;
    const t = setTimeout(() => map.resize(), 200);
    return () => {
      clearTimeout(t);
      markerRef.current?.remove();
      markerRef.current = null;
      try {
        map.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
    };
  }, [token, initial]);

  // Sync the draggable marker with the picked point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!picked) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#facc15;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab;";
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([picked.lng, picked.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setPicked({ lat: ll.lat, lng: ll.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([picked.lng, picked.lat]);
    }
  }, [picked]);

  function handleAddressSelect(result: AddressResult) {
    if (result.lat == null || result.lng == null) return;
    const next = { lat: result.lat, lng: result.lng };
    setPicked(next);
    mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 19, duration: 800 });
  }

  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[240px] flex-1">
          <AddressAutocomplete onSelect={handleAddressSelect} placeholder="Search an address to fly there…" />
        </div>
        <span className="font-mono-num text-xs text-muted-foreground">
          {picked ? `${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}` : "No pin dropped yet"}
        </span>
      </div>

      {isLoading ? (
        <div className="h-[420px] animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <div
          ref={containerRef}
          className="h-[420px] w-full overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--border)" }}
        />
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        Pan and zoom to the correct house, then click it to drop the pin. Drag the pin to fine-tune.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button
          type="button"
          disabled={!picked || isSaving}
          onClick={() => picked && onSave(picked)}
          className="btn-brand inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save location
        </button>
      </div>
    </div>
  );
}
