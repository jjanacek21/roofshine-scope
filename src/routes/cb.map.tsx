import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CbSurface } from "@/components/cb/CbSurface";
import { useAuth } from "@/hooks/useAuth";
import { usePropertyDispositions } from "@/hooks/usePropertyDispositions";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { DoorToDoorMap } from "@/components/door-to-door/DoorToDoorMap";
import { StormSwathMap } from "@/components/storm/StormSwathMap";
import { AddressAutocomplete, type AddressResult } from "@/components/maps/AddressAutocomplete";
import { CbMapPropertyPanel, type CbMapPoint } from "@/components/claim-buddy/map/CbMapPropertyPanel";

export const Route = createFileRoute("/cb/map")({
  validateSearch: (search: Record<string, unknown>): { lat?: number; lng?: number } => {
    const lat = Number(search.lat);
    const lng = Number(search.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {};
  },
  head: () => ({
    meta: [
      { title: "Door to Door mode — Claim Buddy" },
      {
        name: "description",
        content:
          "Canvass on a satellite map, log dispositions and resident details, check storm history, and start an inspection with everything prefilled.",
      },
      { property: "og:title", content: "Door to Door mode — Claim Buddy" },
      {
        property: "og:description",
        content: "Knock, log, and launch inspections straight from the Claim Buddy map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbMapPage,
});

const DEFAULT_CENTER: [number, number] = [-96.5, 38.5];

function CbMapPage() {
  const navigate = useNavigate();
  const { lat: searchLat, lng: searchLng } = Route.useSearch();
  const { user } = useAuth();
  const { workspace } = useCbSession();
  const [mode, setMode] = useState<"canvass" | "storm">("canvass");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<CbMapPoint | null>(
    searchLat != null && searchLng != null ? { lat: searchLat, lng: searchLng } : null,
  );
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(
    searchLat != null && searchLng != null ? { lat: searchLat, lng: searchLng } : null,
  );
  const [stormCenter, setStormCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [stormPoint, setStormPoint] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const boundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);

  const { properties, fetchPropertiesInBounds } = usePropertyDispositions(
    user?.id,
    workspace?.role === "owner" || workspace?.role === "admin" ? workspace.id : null,
  );

  const locate = useCallback((announce = true) => {
    if (!navigator.geolocation) {
      if (announce) toast.error("Location is not available on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setFocus(next);
        setStormCenter([next.lng, next.lat]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (announce) toast.error("Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (searchLat != null && searchLng != null) return;
    locate(false);
  }, [locate, searchLat, searchLng]);

  const onBoundsChange = useCallback(
    (b: { north: number; south: number; east: number; west: number }) => {
      boundsRef.current = b;
      void fetchPropertiesInBounds(b);
    },
    [fetchPropertiesInBounds],
  );

  const refresh = useCallback(() => {
    if (boundsRef.current) void fetchPropertiesInBounds(boundsRef.current);
  }, [fetchPropertiesInBounds]);

  function onAddress(result: AddressResult) {
    if (result.lat == null || result.lng == null) {
      toast.error("Address location was not found");
      return;
    }
    const label = [result.address, result.city, result.state, result.zip].filter(Boolean).join(", ");
    setFocus({ lat: result.lat, lng: result.lng });
    setStormCenter([result.lng, result.lat]);
    setStormPoint({ lat: result.lat, lng: result.lng, label: label || result.address });
  }

  return (
    <CbSurface>
      <div className="flex h-[100dvh] flex-col">
        <header
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{
            borderBottom: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
            background: "var(--cb-surface, #fff)",
          }}
        >
          <button
            aria-label="Back to dashboard"
            onClick={() => navigate({ to: "/cb" })}
            className="rounded-full p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-[15px] font-semibold">Door to Door</p>

          <div
            className="ml-auto flex rounded-full p-1"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            {(["canvass", "storm"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (m === "storm" && !featureGuard("storm_intel")) return;
                  setMode(m);
                }}
                className="rounded-full px-3 py-1 text-[13px] font-semibold"
                style={
                  mode === m
                    ? { background: "var(--cb-accent)", color: "#fff" }
                    : { color: "var(--cb-text-muted)" }
                }
              >
                {m === "canvass" ? "Canvass" : "Storm intel"}
              </button>
            ))}
          </div>

          <button
            aria-label="Current location"
            onClick={() => locate(true)}
            className="rounded-full p-2"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          </button>

          <div className="w-full md:ml-3 md:w-[360px]">
            <div className="h-10">
              <AddressAutocomplete onSelect={onAddress} placeholder="Search any address…" />
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {mode === "canvass" ? (
              <DoorToDoorMap
                position={position}
                route={[]}
                doorKnocks={[]}
                properties={properties}
                isSessionActive
                onBoundsChange={onBoundsChange}
                onMapClick={(lat, lng) => setSelected({ lat, lng })}
                onPropertyClick={(p) => setSelected(p)}
                focusLat={focus?.lat}
                focusLng={focus?.lng}
              />
            ) : (
              <StormSwathMap
                center={stormCenter}
                zoom={stormPoint || position ? 17 : 4}
                searchedPoint={stormPoint}
                onPointSelect={(p) => setSelected({ lat: p.lat, lng: p.lng })}
              />
            )}
          </div>

          {selected ? (
            <div className="absolute inset-0 z-20 md:static md:inset-auto md:z-auto md:h-full md:shrink-0">
              <CbMapPropertyPanel
                key={`${selected.lat}-${selected.lng}`}
                point={selected}
                onClose={() => setSelected(null)}
                onSaved={refresh}
              />
            </div>
          ) : null}
        </div>
      </div>
    </CbSurface>
  );
}
