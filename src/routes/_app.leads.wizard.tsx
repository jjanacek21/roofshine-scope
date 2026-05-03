import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, MapPin, Loader2, RotateCcw, Save, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useLeads } from "@/hooks/useLeads";
import { fmtNum } from "@/lib/leads";
import { analyzeRoofWithAI } from "@/server/lead-ai.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/leads/wizard")({
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
  }),
  component: AIRoofWizard,
});

interface Pin {
  id: string;
  lat: number;
  lng: number;
}

interface Measurements {
  total_sqft: number;
  sun_hours_per_year: number;
  avg_pitch: number;
  segments: { pitch: number; azimuth: number; area_sqft: number }[];
}

interface PlaceResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

// US state name → 2-letter code, for normalizing messy CSV imports.
const US_STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};

function clean(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[.,;]+$/g, "")
    .trim();
}

function normState(s: string | null | undefined): string {
  const v = clean(s).toLowerCase();
  if (!v) return "";
  if (v.length === 2) return v.toUpperCase();
  return US_STATE_CODES[v] ?? clean(s).toUpperCase();
}

function normZip(s: string | null | undefined): string {
  const digits = (s ?? "").replace(/\D+/g, "");
  if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  if (digits.length >= 5) return digits.slice(0, 5);
  return "";
}

// Strip secondary unit info (APT 4B, #12, UNIT 3) — Mapbox's address index doesn't
// know about these and they routinely cause "no match" results.
function stripUnit(street: string): string {
  return street
    .replace(/\b(apt|apartment|unit|ste|suite|#|no\.?|number|fl|floor|bldg|building|lot|trlr|trailer|rm|room)\s*\.?\s*\S+/gi, "")
    .replace(/\s+#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAddressForGeocoding(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const street = stripUnit(clean(parts.address));
  const city = clean(parts.city);
  const state = normState(parts.state);
  const zip = normZip(parts.zip);
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [street, cityStateZip, "USA"].filter(Boolean).join(", ");
}

function AIRoofWizard() {
  const { data: token } = useMapboxToken();
  const { data: leads = [] } = useLeads();
  const search = Route.useSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | "">("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisImage, setAnalysisImage] = useState<string>("");
  const [loading, setLoading] = useState<"none" | "measure" | "analyze">("none");
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [manualPlace, setManualPlace] = useState<PlaceResult | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  const analyze = useServerFn(analyzeRoofWithAI);
  const qc = useQueryClient();

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  // Auto-select lead when arriving via ?leadId=...
  useEffect(() => {
    if (!search.leadId) return;
    if (selectedLeadId === search.leadId) return;
    if (!leads.some((l) => l.id === search.leadId)) return;
    setSelectedLeadId(search.leadId);
  }, [search.leadId, leads, selectedLeadId]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-80.25, 25.85],
        zoom: 17,
        maxZoom: 20,
        attributionControl: false,
      });
    } catch (err) {
      console.error("Mapbox init failed", err);
      toast.error("Map failed to initialize.");
      return;
    }
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("error", (e) => {
      // Mapbox fires non-fatal tile errors here too — just log them.
      console.warn("Mapbox event error:", e?.error?.message ?? e);
    });
    map.on("click", (e) => {
      setPins((prev) => [
        ...prev,
        { id: crypto.randomUUID(), lat: e.lngLat.lat, lng: e.lngLat.lng },
      ]);
    });
    mapRef.current = map;
    return () => {
      try { map.remove(); } catch { /* noop */ }
      mapRef.current = null;
    };
  }, [token]);

  // Safe fly helper — only fly when the style is loaded and coords are finite.
  function flySafe(lat: number, lng: number, zoom = 18) {
    const map = mapRef.current;
    if (!map) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const go = () => {
      try {
        map.flyTo({ center: [lng, lat], zoom, essential: true });
      } catch (err) {
        console.warn("flyTo failed", err);
        try { map.jumpTo({ center: [lng, lat], zoom }); } catch { /* noop */ }
      }
    };
    if (map.isStyleLoaded()) go();
    else map.once("load", go);
  }


  // Debounced Mapbox forward-geocode for the search input
  useEffect(() => {
    const raw = searchInput.trim();
    if (!token || raw.length < 3) {
      setPlaceResults([]);
      setSearching(false);
      return;
    }
    // Clean unit suffixes / extra punctuation so Mapbox's address index matches.
    const q = stripUnit(clean(raw));
    if (q.length < 3) {
      setPlaceResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${token}&country=us&types=address,postcode&autocomplete=true&limit=5`;
        const res = await fetch(url);
        const json = await res.json();
        const features: PlaceResult[] = (json?.features ?? [])
          .filter((f: any) => Array.isArray(f.center))
          .map((f: any) => ({
            id: String(f.id),
            label: String(f.place_name ?? f.text ?? ""),
            lng: Number(f.center[0]),
            lat: Number(f.center[1]),
          }));
        setPlaceResults(features);
      } catch {
        setPlaceResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput, token]);

  // Fly to selected lead — geocode client-side via Mapbox if coords are missing
  useEffect(() => {
    if (!selectedLead) {
      setResolvedCoords(null);
      return;
    }
    setManualPlace(null);
    setPins([]);
    setMeasurements(null);
    setAnalysis("");
    setAnalysisImage("");

    const flyHere = (lat: number, lng: number) => {
      setResolvedCoords({ lat, lng });
      flySafe(lat, lng);
    };

    if (selectedLead.lat != null && selectedLead.lng != null) {
      flyHere(selectedLead.lat, selectedLead.lng);
      return;
    }

    if (!token) return;

    const leadIdAtStart = selectedLead.id;
    setResolvedCoords(null);
    setLocating(true);

    const query = formatAddressForGeocoding({
      address: selectedLead.address,
      city: selectedLead.city,
      state: selectedLead.state,
      zip: (selectedLead as any).zip,
    });

    (async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${token}&country=us&limit=1`;
        const res = await fetch(url);
        const json = await res.json();
        const f = json?.features?.[0];
        if (leadIdAtStart !== selectedLeadId) return;
        if (f?.center) {
          const [lng, lat] = f.center;
          flyHere(lat, lng);
          // persist back to the lead
          const { error } = await supabase
            .from("leads")
            .update({ lat, lng })
            .eq("id", leadIdAtStart);
          if (!error) {
            qc.invalidateQueries({ queryKey: ["leads"] });
            qc.invalidateQueries({ queryKey: ["lead", leadIdAtStart] });
          }
        } else {
          toast.error("Address not found — drop pins manually.");
        }
      } catch (e) {
        if (leadIdAtStart !== selectedLeadId) return;
        toast.error(e instanceof Error ? e.message : "Geocoding failed");
      } finally {
        if (leadIdAtStart === selectedLeadId) setLocating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id, token]);

  // Render pin markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    pins.forEach((p, i) => {
      const el = document.createElement("div");
      el.style.cssText = `width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:#3b82f6;box-shadow:0 2px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font:600 11px system-ui;`;
      el.textContent = String(i + 1);
      const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(mapRef.current!);
      markersRef.current.push(m);
    });
  }, [pins]);

  const center = useMemo(() => {
    if (pins.length > 0) {
      return {
        lat: pins.reduce((a, p) => a + p.lat, 0) / pins.length,
        lng: pins.reduce((a, p) => a + p.lng, 0) / pins.length,
      };
    }
    if (selectedLead?.lat != null && selectedLead?.lng != null) {
      return { lat: selectedLead.lat, lng: selectedLead.lng };
    }
    if (resolvedCoords) return resolvedCoords;
    if (manualPlace) return { lat: manualPlace.lat, lng: manualPlace.lng };
    return null;
  }, [pins, selectedLead, resolvedCoords, manualPlace]);

  function pickPlace(place: PlaceResult) {
    setSelectedLeadId("");
    setManualPlace(place);
    setResolvedCoords({ lat: place.lat, lng: place.lng });
    setPins([]);
    setMeasurements(null);
    setAnalysis("");
    setAnalysisImage("");
    setPickerOpen(false);
    flySafe(place.lat, place.lng);
  }

  async function runMeasurements() {
    if (!center) {
      toast.error("Drop at least one pin or select a lead first.");
      return;
    }
    setLoading("measure");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to get measurements.");

      const targets = pins.length > 0 ? pins : [{ id: "selected", lat: center.lat, lng: center.lng }];
      const results: Measurements[] = [];
      const failures: string[] = [];

      for (const target of targets) {
        const response = await fetch("/api/solar-roof-extract", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ lat: target.lat, lng: target.lng, property_id: selectedLeadId || undefined }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          failures.push(String(payload.message ?? payload.detail ?? payload.error ?? `Pin ${failures.length + 1} failed`));
          continue;
        }
        const segments = ((payload.segments ?? []) as Array<{ pitch_degrees?: number; azimuth_degrees?: number; plan_area_sqft?: number }>).map((segment) => ({
          pitch: Number(segment.pitch_degrees ?? 0),
          azimuth: Number(segment.azimuth_degrees ?? 0),
          area_sqft: Number(segment.plan_area_sqft ?? 0),
        }));
        const avgPitch = segments.length > 0
          ? segments.reduce((sum, segment) => sum + segment.pitch, 0) / segments.length
          : 0;
        results.push({
          total_sqft: Number(payload.total_plan_sqft ?? 0),
          sun_hours_per_year: Number(payload.max_sunshine_hours_per_year ?? 0),
          avg_pitch: avgPitch,
          segments,
        });
      }

      if (results.length === 0) {
        setMeasurements(null);
        toast.error(failures[0] ?? "No roof data available for these pins.");
        return;
      }
      const allSegments = results.flatMap((result) => result.segments);
      setMeasurements({
        total_sqft: results.reduce((sum, result) => sum + result.total_sqft, 0),
        sun_hours_per_year: Math.max(...results.map((result) => result.sun_hours_per_year)),
        avg_pitch: allSegments.length > 0
          ? allSegments.reduce((sum, segment) => sum + segment.pitch, 0) / allSegments.length
          : 0,
        segments: allSegments,
      });
      toast.success(failures.length > 0 ? `Measurements ready for ${results.length} pin${results.length === 1 ? "" : "s"}` : "Measurements ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to measure");
    } finally {
      setLoading("none");
    }
  }

  async function runAnalysis() {
    if (!center) {
      toast.error("Drop at least one pin or select a lead first.");
      return;
    }
    setLoading("analyze");
    try {
      const res = await analyze({
        data: {
          lat: center.lat,
          lng: center.lng,
          address:
            selectedLead?.address ??
            manualPlace?.label ??
            `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
          pinCount: Math.max(1, pins.length),
          leadId: selectedLeadId || undefined,
        },
      });
      setAnalysis(res.analysis);
      setAnalysisImage(res.image_url);
      toast.success("AI analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyze");
    } finally {
      setLoading("none");
    }
  }

  const triggerLabel = selectedLead?.address ?? manualPlace?.label ?? "Search any address or pick a lead…";

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <Sparkles className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">AI Roof Wizard</h2>
          <p className="text-sm text-[var(--text-dim)]">
            Search any address or pick a lead, then click the satellite to drop pins on the roof.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Address
            </label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="flex w-full items-center justify-between rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-left text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className={cn("truncate", !selectedLead && !manualPlace && "text-[var(--text-dim)]")}>
                    {triggerLabel}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="relative">
                    <CommandInput
                      placeholder="Search any address…"
                      value={searchInput}
                      onValueChange={setSearchInput}
                    />
                    {searching && (
                      <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[var(--text-dim)]" />
                    )}
                  </div>
                  <CommandList className="max-h-80">
                    <CommandEmpty>
                      {searchInput.length < 3 ? "Type at least 3 characters." : "No matches."}
                    </CommandEmpty>
                    {placeResults.length > 0 && (
                      <CommandGroup heading="Search results">
                        {placeResults.map((p) => (
                          <CommandItem
                            key={`place-${p.id}`}
                            value={`place-${p.id}`}
                            onSelect={() => pickPlace(p)}
                            className="flex items-start gap-2"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm">{p.label}</div>
                              <div className="truncate font-mono-num text-xs text-[var(--text-dim)]">
                                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {leads.length > 0 && (
                      <CommandGroup heading="Your leads">
                        {leads
                          .filter((l) => {
                            const q = searchInput.trim().toLowerCase();
                            if (!q) return true;
                            const hay = `${l.address ?? ""} ${l.owner ?? ""} ${l.reported_owner ?? ""} ${l.city ?? ""}`.toLowerCase();
                            return hay.includes(q);
                          })
                          .slice(0, 25)
                          .map((l) => {
                            const hasCoords = l.lat != null && l.lng != null;
                            return (
                              <CommandItem
                                key={l.id}
                                value={`lead-${l.id}`}
                                onSelect={() => {
                                  setSelectedLeadId(l.id);
                                  setManualPlace(null);
                                  setPickerOpen(false);
                                }}
                                className="flex items-start gap-2"
                              >
                                <Check
                                  className={cn(
                                    "mt-0.5 h-4 w-4 shrink-0",
                                    selectedLeadId === l.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm">{l.address}</div>
                                  <div className="truncate text-xs text-[var(--text-dim)]">
                                    {(l.owner ?? l.reported_owner ?? "Unknown owner")}
                                    {l.city ? ` · ${l.city}, ${l.state ?? ""}` : ""}
                                    {!hasCoords ? " · no coords" : ""}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedLead && (
              <div className="mt-2 text-xs text-[var(--text-dim)]">
                {selectedLead.city}, {selectedLead.state} · {fmtNum(selectedLead.sqft)} sq ft on file
              </div>
            )}
            {!selectedLead && manualPlace && (
              <div className="mt-2 text-xs text-[var(--text-dim)]">
                <span className="font-mono-num">
                  {manualPlace.lat.toFixed(5)}, {manualPlace.lng.toFixed(5)}
                </span>
                {" · not saved as a lead"}
              </div>
            )}
            {locating && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Locating address…
              </div>
            )}
          </div>

          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Pins ({pins.length})
              </p>
              {pins.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPins([])}
                  className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {pins.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                <MapPin className="h-3.5 w-3.5" />
                Click the satellite to drop pins.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {pins.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between text-foreground">
                    <span className="font-mono-num">
                      {i + 1}. {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPins((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-[var(--text-dim)] hover:text-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={runMeasurements}
              disabled={loading !== "none" || !center}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
            >
              {loading === "measure" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Get measurements
            </button>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading !== "none" || !center}
              className="btn-brand flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-40"
            >
              {loading === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run AI analysis
            </button>
            {selectedLeadId && analysis && (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                <Save className="h-3 w-3" /> Saved to lead automatically.
              </p>
            )}
          </div>
        </aside>

        <div className="space-y-3">
          <div
            ref={containerRef}
            className="h-[460px] w-full overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          />

          {measurements && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Google Solar — Building Insights
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total roof" value={`${fmtNum(Math.round(measurements.total_sqft))} sqft`} />
                <Stat label="Sun hours / yr" value={fmtNum(Math.round(measurements.sun_hours_per_year))} />
                <Stat label="Avg pitch" value={`${measurements.avg_pitch.toFixed(1)}°`} />
                <Stat label="Segments" value={fmtNum(measurements.segments.length)} />
              </div>
            </div>
          )}

          {analysis && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Claude vision report
              </p>
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                {analysisImage && (
                  <img
                    src={analysisImage}
                    alt="Roof satellite"
                    className="h-auto w-full rounded-lg border"
                    style={{ borderColor: "var(--border)" }}
                  />
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{analysis}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="mt-0.5 font-mono-num text-base font-bold text-foreground">{value}</div>
    </div>
  );
}
