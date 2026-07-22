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

function RoofKingMap() {
  const { companyId } = useIsRoofKing();
  const { data: token } = useMapboxToken();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const qc = useQueryClient();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
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
      return !!p && p.lat != null && p.lng != null;
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
      properties.filter((p) => (p.lat == null || p.lng == null) && hasStreetName(p.address))
        .length,
    [properties],
  );

  const [regeocodeAll, setRegeocodeAll] = useState(false);

  async function geocodeMissing() {
    if (!token || geocoding) return;
    const targets = properties.filter((p) => {
      if (!hasStreetName(p.address)) return false;
      if (regeocodeAll) return true;
      return p.lat == null || p.lng == null;
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

    // South Florida proximity bias so bare numbers/streets don't jump to Orlando etc.
    const PROX_LNG = -80.15;
    const PROX_LAT = 26.15;

    async function worker() {
      while (cursor < targets.length) {
        const idx = cursor++;
        const prop = targets[idx];
        const q = [prop.address, prop.city, prop.state || "FL", prop.zip, "USA"]
          .filter(Boolean)
          .join(", ");
        try {
          const params = new URLSearchParams({
            access_token: token,
            country: "us",
            limit: "1",
            types: "address",
            autocomplete: "false",
            proximity: `${PROX_LNG},${PROX_LAT}`,
          });
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
          const res = await fetch(url);
          const json = await res.json();
          const f = json?.features?.[0];
          // Require an address-level match with strong relevance; otherwise skip.
          const isAddress = Array.isArray(f?.place_type) && f.place_type.includes("address");
          if (f?.center && isAddress && (f.relevance ?? 0) >= 0.75) {
            const [lng, lat] = f.center;
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
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Render pins whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let count = 0;

    grouped.forEach(({ property, tickets: pts }) => {
      if (property.lat == null || property.lng == null) return;
      // Dominant status = most recent ticket's status
      const sorted = [...pts].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
      const top = sorted[0];
      const color = RK_STATUS_COLORS[top.status] ?? "#6b7888";
      const badge = pts.length > 1 ? `<span style="position:absolute;top:-6px;right:-6px;background:#111;color:#fff;font-size:10px;font-weight:700;border-radius:9px;padding:1px 5px;border:1px solid #fff;">${pts.length}</span>` : "";
      const el = document.createElement("div");
      el.style.cssText = "position:relative;width:20px;height:20px;cursor:pointer;";
      el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:${color};box-shadow:0 1px 4px rgba(0,0,0,.5);"></div>${badge}`;
      el.onclick = () => {
        popupRef.current?.remove();
        const list = sorted.slice(0, 8).map((t) => {
          const a = accountById.get(t.account_id);
          const c = RK_STATUS_COLORS[t.status];
          return `<div data-ticket-id="${t.id}" style="cursor:pointer;padding:6px 8px;border-top:1px solid #2a2a2a;display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <div style="min-width:0;">
              <div style="font-weight:600;color:#fff;font-size:12px;">WO-${t.wo_number ?? "—"} · ${(a?.name ?? "—").replace(/</g, "&lt;")}</div>
              <div style="font-size:11px;color:#9ca3af;">${t.service_date ?? "No date"}${t.price != null ? ` · $${Number(t.price).toFixed(0)}` : ""}</div>
            </div>
            <span style="display:inline-block;padding:1px 6px;border-radius:9999px;background:${c};color:#fff;font-size:10px;font-weight:600;">${RK_STATUS_LABELS[t.status]}</span>
          </div>`;
        }).join("");
        const head = `<div style="padding:8px 10px;">
          <div style="font-weight:700;color:#fff;font-size:13px;">${(property.name ?? "Property").replace(/</g, "&lt;")}</div>
          <div style="font-size:11px;color:#9ca3af;">${[property.address, property.city, property.state].filter(Boolean).join(", ").replace(/</g, "&lt;")}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${pts.length} ticket${pts.length === 1 ? "" : "s"}</div>
        </div>`;
        const html = `<div style="background:#111;color:#fff;border-radius:8px;overflow:hidden;min-width:240px;max-width:300px;font-family:system-ui,sans-serif;">${head}${list}</div>`;
        const popup = new mapboxgl.Popup({ offset: 14, closeButton: true, className: "rk-map-popup" })
          .setLngLat([property.lng!, property.lat!])
          .setHTML(html)
          .addTo(map);
        popupRef.current = popup;
        // Wire clicks after mount
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
      };
      const marker = new mapboxgl.Marker(el).setLngLat([property.lng, property.lat]).addTo(map);
      markersRef.current.push(marker);
      bounds.extend([property.lng, property.lat]);
      count++;
    });

    if (count > 0 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
    }
  }, [grouped, accountById]);

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
          {missingCount > 0 && (
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
                  Geocode {missingCount.toLocaleString()} missing
                </>
              )}
            </button>
          )}
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
