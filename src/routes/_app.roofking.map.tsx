import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { supabase } from "@/integrations/supabase/client";
import { RK_STATUS_COLORS, RK_STATUS_LABELS, RK_STATUSES, type RKStatus, type RKProperty, type RKTicket } from "@/lib/roofking/types";
import { TicketDrawer } from "@/components/roofking/TicketDrawer";

export const Route = createFileRoute("/_app/roofking/map")({
  component: RoofKingMap,
});

type TicketFeatureProperties = {
  propertyId: string;
  propertyName: string;
  address: string;
  status: RKStatus;
  color: string;
  ticketCount: number;
};

type TicketFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: TicketFeatureProperties;
};

type TicketFeatureCollection = {
  type: "FeatureCollection";
  features: TicketFeature[];
};

type TimeRange = "all" | "30d" | "90d" | "1y";
const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
];

function withinRange(dateStr: string | null | undefined, range: TimeRange): boolean {
  if (range === "all" || !dateStr) return range === "all";
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return false;
  const now = Date.now();
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return now - d <= days * 24 * 60 * 60 * 1000;
}

const FLORIDA_BOUNDS = {
  minLng: -87.8,
  minLat: 24.3,
  maxLng: -79.9,
  maxLat: 31.1,
};

const SOUTH_FLORIDA_BOUNDS = {
  minLng: -80.65,
  minLat: 25.15,
  maxLng: -79.95,
  maxLat: 26.95,
};

const SOUTH_FLORIDA_CITY_RE =
  /\b(miami|miami beach|north miami|miami gardens|hialeah|aventura|sunny isles|surfside|bal harbour|bay harbor|hollywood|hallandale|fort lauderdale|lauderdale|pompano|deerfield|boca|delray|boynton|west palm|palm beach|palm beach gardens|lake worth|jupiter)\b/i;

function isInsideBounds(lat: number, lng: number, bounds: typeof FLORIDA_BOUNDS): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

function isSouthFloridaProperty(property: RKProperty): boolean {
  return SOUTH_FLORIDA_CITY_RE.test([property.name, property.address, property.city].filter(Boolean).join(" "));
}

function hasValidCoordinate(property: RKProperty): property is RKProperty & { lat: number; lng: number } {
  if (property.lat == null || property.lng == null) return false;
  const lat = Number(property.lat);
  const lng = Number(property.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!isInsideBounds(lat, lng, FLORIDA_BOUNDS)) return false;
  if (isSouthFloridaProperty(property) && !isInsideBounds(lat, lng, SOUTH_FLORIDA_BOUNDS)) return false;
  return true;
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function RoofKingMap() {
  const { companyId } = useIsRoofKing();
  const { data: token } = useMapboxToken();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const qc = useQueryClient();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [statusFilter, setStatusFilter] = useState<Record<RKStatus, boolean>>({
    new: true, dispatched: true, field: true, ready: true, invoiced: true,
  });
  const [geocoding, setGeocoding] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0 });

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  // Tickets filtered by status + time range, joined w/ property coordinates.
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (!statusFilter[t.status]) return false;
      if (!withinRange(t.service_date ?? t.updated_at, timeRange)) return false;
      const p = propById.get(t.property_id);
      return !!p && hasValidCoordinate(p);
    });
  }, [tickets, statusFilter, timeRange, propById]);

  // Group tickets by property for clustering pins at the same location.
  const grouped = useMemo(() => {
    const map = new Map<string, { property: RKProperty; tickets: RKTicket[] }>();
    for (const t of filteredTickets) {
      const p = propById.get(t.property_id);
      if (!p) continue;
      const cur = map.get(p.id);
      if (cur) cur.tickets.push(t);
      else map.set(p.id, { property: p, tickets: [t] });
    }
    return Array.from(map.values());
  }, [filteredTickets, propById]);

  const ticketsByPropertyId = useMemo(() => {
    const map = new Map<string, RKTicket[]>();
    for (const item of grouped) map.set(item.property.id, item.tickets);
    return map;
  }, [grouped]);

  const popupDataRef = useRef({ accountById, propById, ticketsByPropertyId });
  useEffect(() => {
    popupDataRef.current = { accountById, propById, ticketsByPropertyId };
  }, [accountById, propById, ticketsByPropertyId]);

  const mapData = useMemo<TicketFeatureCollection>(() => {
    const features = grouped
      .filter(({ property }) => hasValidCoordinate(property))
      .map(({ property, tickets: pts }) => {
        const sorted = [...pts].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
        const top = sorted[0];
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [property.lng, property.lat] as [number, number] },
          properties: {
            propertyId: property.id,
            propertyName: property.name ?? "Property",
            address: [property.address, property.city, property.state].filter(Boolean).join(", "),
            status: top.status,
            color: RK_STATUS_COLORS[top.status] ?? "#6b7888",
            ticketCount: pts.length,
          },
        };
      });
    return { type: "FeatureCollection", features };
  }, [grouped]);

  const skippedTicketCount = useMemo(() => {
    return tickets.filter((t) => {
      if (!statusFilter[t.status]) return false;
      if (!withinRange(t.service_date ?? t.updated_at, timeRange)) return false;
      const p = propById.get(t.property_id);
      return !p || !hasValidCoordinate(p);
    }).length;
  }, [tickets, statusFilter, timeRange, propById]);

  const suspiciousProperties = useMemo(
    () => properties.filter((p) => p.lat != null && p.lng != null && !hasValidCoordinate(p)),
    [properties],
  );

  // Detect addresses that are just a number / range with no street name — Mapbox
  // returns garbage matches for these, so we treat them as ungeocodable.
  function hasStreetName(addr: string | null | undefined): boolean {
    if (!addr) return false;
    const cleaned = addr.replace(/[#\-,.]/g, " ").trim();
    // needs at least one word that isn't a pure number or a range like "2570"
    return /[a-zA-Z]{3,}/.test(cleaned);
  }

  const missingCount = useMemo(
    () =>
      properties.filter((p) => (p.lat == null || p.lng == null || !hasValidCoordinate(p)) && hasStreetName(p.address))
        .length,
    [properties],
  );

  const [regeocodeAll, setRegeocodeAll] = useState(false);

  async function geocodeMissing() {
    if (!token || geocoding) return;
    const targets = properties.filter((p) => {
      if (!hasStreetName(p.address)) return false;
      if (regeocodeAll) return true;
      return p.lat == null || p.lng == null || !hasValidCoordinate(p);
    });
    if (targets.length === 0) {
      toast.success("Nothing to geocode. Properties missing a street name are skipped.");
      return;
    }
    setGeocoding(true);
    setProgress({ done: 0, total: targets.length, ok: 0 });

    let done = 0;
    let ok = 0;
    let skipped = 0;
    const CONCURRENCY = 5;
    let cursor = 0;

    async function worker() {
      while (cursor < targets.length) {
        const idx = cursor++;
        const prop = targets[idx];
        const q = [prop.address, prop.city, prop.state || "FL", prop.zip, "USA"]
          .filter(Boolean)
          .join(", ");
        try {
          const params = new URLSearchParams({
            access_token: token!,
            country: "us",
            limit: "1",
            types: "address",
            autocomplete: "false",
            proximity: isSouthFloridaProperty(prop) ? "-80.15,26.15" : "-81.7,27.8",
            bbox: isSouthFloridaProperty(prop)
              ? `${SOUTH_FLORIDA_BOUNDS.minLng},${SOUTH_FLORIDA_BOUNDS.minLat},${SOUTH_FLORIDA_BOUNDS.maxLng},${SOUTH_FLORIDA_BOUNDS.maxLat}`
              : `${FLORIDA_BOUNDS.minLng},${FLORIDA_BOUNDS.minLat},${FLORIDA_BOUNDS.maxLng},${FLORIDA_BOUNDS.maxLat}`,
          });

          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
          const res = await fetch(url);
          const json = await res.json();
          const f = json?.features?.[0];
          // Require an address-level match with strong relevance; otherwise skip.
          const isAddress = Array.isArray(f?.place_type) && f.place_type.includes("address");
          if (f?.center && isAddress && (f.relevance ?? 0) >= 0.75) {
            const [lng, lat] = f.center;
            const candidate = { ...prop, lat, lng };
            if (!hasValidCoordinate(candidate)) {
              skipped++;
              done++;
              setProgress({ done, total: targets.length, ok });
              continue;
            }
            const { error } = await supabase.from("rk_properties").update({ lat, lng }).eq("id", prop.id);
            if (!error) {
              ok++;
              qc.setQueryData<RKProperty[]>(["rk", "properties", companyId], (prev) =>
                Array.isArray(prev) ? prev.map((row) => (row.id === prop.id ? { ...row, lat, lng } : row)) : prev,
              );
            }
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
        done++;
        setProgress({ done, total: targets.length, ok });
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setGeocoding(false);
    qc.invalidateQueries({ queryKey: ["rk", "properties", companyId] });
    toast.success(
      `Geocoded ${ok} of ${targets.length}${skipped ? ` · ${skipped} low-confidence skipped` : ""}`,
    );
  }


  // Init map once token is ready
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-95, 37],
      zoom: 3.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("rk-service-tickets", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 44,
      });

      map.addLayer({
        id: "rk-clusters",
        type: "circle",
        source: "rk-service-tickets",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#2f80ed", 10, "#f39c2d", 25, "#8b5cf6"],
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 25, 29],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.96,
        },
      });

      map.addLayer({
        id: "rk-cluster-count",
        type: "symbol",
        source: "rk-service-tickets",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "rk-unclustered-points",
        type: "circle",
        source: "rk-service-tickets",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 16, 11, 20, 14],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.97,
        },
      });

      map.addLayer({
        id: "rk-unclustered-counts",
        type: "symbol",
        source: "rk-service-tickets",
        filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "ticketCount"], 1]],
        layout: {
          "text-field": ["get", "ticketCount"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 10,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.on("click", "rk-clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["rk-clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("rk-service-tickets") as mapboxgl.GeoJSONSource | undefined;
        if (clusterId == null || !source) return;
        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || zoom == null) return;
          const geometry = features[0].geometry;
          if (geometry.type !== "Point") return;
          map.easeTo({ center: geometry.coordinates as [number, number], zoom });
        });
      });

      map.on("click", "rk-unclustered-points", (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const properties = feature.properties as TicketFeatureProperties;
        const { accountById: currentAccounts, propById: currentProperties, ticketsByPropertyId: currentTickets } = popupDataRef.current;
        const pts = currentTickets.get(properties.propertyId) ?? [];
        const property = currentProperties.get(properties.propertyId);
        if (!property) return;
        popupRef.current?.remove();
        const sorted = [...pts].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
        const list = sorted.slice(0, 8).map((t) => {
          const account = currentAccounts.get(t.account_id);
          const color = RK_STATUS_COLORS[t.status];
          return `<div data-ticket-id="${escapeHtml(t.id)}" style="cursor:pointer;padding:6px 8px;border-top:1px solid #2a2a2a;display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <div style="min-width:0;">
              <div style="font-weight:600;color:#fff;font-size:12px;">WO-${escapeHtml(t.wo_number == null ? "—" : String(t.wo_number))} · ${escapeHtml(account?.name ?? "—")}</div>
              <div style="font-size:11px;color:#9ca3af;">${escapeHtml(t.service_date ?? "No date")}${t.price != null ? ` · $${Number(t.price).toFixed(0)}` : ""}</div>
            </div>
            <span style="display:inline-block;padding:1px 6px;border-radius:9999px;background:${color};color:#fff;font-size:10px;font-weight:600;">${RK_STATUS_LABELS[t.status]}</span>
          </div>`;
        }).join("");
        const head = `<div style="padding:8px 10px;">
          <div style="font-weight:700;color:#fff;font-size:13px;">${escapeHtml(property.name ?? "Property")}</div>
          <div style="font-size:11px;color:#9ca3af;">${escapeHtml([property.address, property.city, property.state].filter(Boolean).join(", "))}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${pts.length} ticket${pts.length === 1 ? "" : "s"}</div>
        </div>`;
        const html = `<div style="background:#111;color:#fff;border-radius:8px;overflow:hidden;min-width:240px;max-width:300px;font-family:system-ui,sans-serif;">${head}${list}</div>`;
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: true, className: "rk-map-popup" })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setHTML(html)
          .addTo(map);
        popupRef.current = popup;
        setTimeout(() => {
          const node = popup.getElement();
          node?.querySelectorAll<HTMLElement>("[data-ticket-id]").forEach((row) => {
            row.addEventListener("click", () => {
              const id = row.getAttribute("data-ticket-id");
              if (id) setOpenTicket(id);
              popup.remove();
            });
          });
        }, 0);
      });

      map.on("mouseenter", "rk-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "rk-clusters", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "rk-unclustered-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "rk-unclustered-points", () => { map.getCanvas().style.cursor = ""; });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Feed clustered map source whenever data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyData = () => {
      const source = map.getSource("rk-service-tickets") as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(mapData as never);
      if (mapData.features.length === 0) return;
      const bounds = new mapboxgl.LngLatBounds();
      mapData.features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 600 });
    };
    if (map.loaded()) applyData();
    else map.once("load", applyData);
  }, [mapData]);

  const shownTickets = filteredTickets.length;
  const totalTickets = tickets.length;

  return (
    <div className="grid h-[calc(100vh-260px)] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--rk-line)" }}
      />
      <div
        className="overflow-y-auto rounded-xl border"
        style={{ borderColor: "var(--rk-line)", backgroundColor: "var(--rk-bg-card)" }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--rk-line)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--rk-ink)" }}>Service Ticket Heat Map</h3>
          <p className="text-xs" style={{ color: "var(--rk-ink-muted)" }}>
            <span className="rk-num">{shownTickets}</span> of <span className="rk-num">{totalTickets}</span> tickets shown
          </p>
          <p className="text-[11px]" style={{ color: "var(--rk-ink-muted)" }}>
            <span className="rk-num">{mapData.features.length}</span> mapped properties
            {skippedTicketCount > 0 ? (
              <> · <span className="rk-num">{skippedTicketCount}</span> tickets need better coordinates</>
            ) : null}
          </p>
          {suspiciousProperties.length > 0 ? (
            <p className="mt-1 text-[11px]" style={{ color: "var(--rk-warning, #f59e0b)" }}>
              {suspiciousProperties.length.toLocaleString()} saved pin{suspiciousProperties.length === 1 ? "" : "s"} look off and are hidden until re-geocoded.
            </p>
          ) : null}
          <button
            type="button"
            onClick={geocodeMissing}
            disabled={geocoding || !token}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-[var(--rk-panel-2)] disabled:opacity-50"
            style={{ borderColor: "var(--rk-line)", color: "var(--rk-ink)" }}
          >
            {geocoding ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Geocoding {progress.done}/{progress.total}…
              </>
            ) : (
              <>
                <MapPin className="h-3 w-3" />
                {regeocodeAll
                  ? `Re-geocode ${properties.filter((p) => hasStreetName(p.address)).length.toLocaleString()} properties`
                  : `Fix ${missingCount.toLocaleString()} missing/bad pins`}
              </>
            )}
          </button>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px]" style={{ color: "var(--rk-ink-muted)" }}>
            <input
              type="checkbox"
              checked={regeocodeAll}
              onChange={(e) => setRegeocodeAll(e.target.checked)}
            />
            <span>Re-geocode all (fixes wrong pins)</span>
          </label>

        </div>

        <div className="border-b px-4 py-3" style={{ borderColor: "var(--rk-line)" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
            Time range
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="rk-input w-full text-xs"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
            Status
          </div>
          <div className="space-y-1.5">
            {RK_STATUSES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--rk-ink)" }}>
                <input
                  type="checkbox"
                  checked={statusFilter[s]}
                  onChange={(e) => setStatusFilter((prev) => ({ ...prev, [s]: e.target.checked }))}
                />
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: RK_STATUS_COLORS[s], border: "1px solid rgba(255,255,255,0.5)" }}
                />
                <span>{RK_STATUS_LABELS[s]}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <TicketDrawer ticketId={openTicket} accounts={accounts} properties={properties} onClose={() => setOpenTicket(null)} />
    </div>
  );
}
