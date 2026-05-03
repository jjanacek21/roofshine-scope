import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useLeads } from "@/hooks/useLeads";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import { fmtNum, leadStatusColor } from "@/lib/leads";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/leads/map")({
  component: LeadsMap,
});

function LeadsMap() {
  const { data: token } = useMapboxToken();
  const { data: leads = [] } = useLeads();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-80.25, 25.85],
      zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    leads.forEach((l) => {
      if (l.lat == null || l.lng == null) return;
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;border-radius:50%;border:2px solid #fff;cursor:pointer;background:${leadStatusColor(l.status)};box-shadow:0 1px 4px rgba(0,0,0,.5);`;
      el.onclick = () => setOpenId(l.id);
      const m = new mapboxgl.Marker(el).setLngLat([l.lng, l.lat]).addTo(map);
      markersRef.current.push(m);
    });
  }, [leads]);

  function flyTo(lat: number | null, lng: number | null) {
    if (lat == null || lng == null) return;
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 18 });
  }

  return (
    <div className="grid h-[calc(100vh-260px)] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div ref={containerRef} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }} />
      <div className="overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold text-foreground">Leads</h3>
          <p className="text-xs text-muted-foreground">{leads.length} total</p>
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {leads.map((l) => (
            <li
              key={l.id}
              className="cursor-pointer px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
              onClick={() => {
                flyTo(l.lat, l.lng);
                setOpenId(l.id);
              }}
            >
              <div className="text-sm font-medium text-foreground">{l.address}</div>
              <div className="text-xs text-muted-foreground">{l.city}, {l.state}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span style={{ color: leadStatusColor(l.status) }}>●</span>
                <span>{l.owner ?? "—"}</span>
                <span className="font-mono-num">{fmtNum(l.sqft)} sf</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
