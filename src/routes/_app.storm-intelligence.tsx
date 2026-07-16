import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CloudLightning } from "lucide-react";
import { toast } from "sonner";
import { StormSwathMap } from "@/components/storm/StormSwathMap";
import { AddressAutocomplete, type AddressResult } from "@/components/maps/AddressAutocomplete";

export const Route = createFileRoute("/_app/storm-intelligence")({
  head: () => ({
    meta: [
      { title: "Storm Intelligence" },
      {
        name: "description",
        content:
          "Nationwide live hail swaths, wind gust reports, and severe thunderstorm warnings.",
      },
    ],
  }),
  component: StormIntelligencePage,
});

const DEFAULT_CENTER: [number, number] = [-96.5, 38.5];
const DEFAULT_ZOOM = 4;

type SearchPoint = {
  lng: number;
  lat: number;
  label: string;
};

function StormIntelligencePage() {
  const [searchedPoint, setSearchedPoint] = useState<SearchPoint | null>(null);

  const center = useMemo<[number, number]>(
    () => (searchedPoint ? [searchedPoint.lng, searchedPoint.lat] : DEFAULT_CENTER),
    [searchedPoint],
  );
  const zoom = searchedPoint ? 16 : DEFAULT_ZOOM;

  const handleAddressSelect = (result: AddressResult) => {
    if (result.lat == null || result.lng == null) {
      toast.error("Address location was not found");
      return;
    }
    const label = [result.address, result.city, result.state, result.zip].filter(Boolean).join(", ");
    setSearchedPoint({ lng: result.lng, lat: result.lat, label: label || result.address });
  };

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CloudLightning className="h-4 w-4" style={{ color: "var(--brand)" }} />
          Storm Intelligence
        </div>

        <div className="ml-auto w-full min-w-[280px] max-w-[540px] md:w-[42vw]">
          <div className="h-10">
            <AddressAutocomplete onSelect={handleAddressSelect} placeholder="Search any address…" />
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <StormSwathMap
          center={center}
          zoom={zoom}
          searchedPoint={searchedPoint}
        />
      </div>
    </div>
  );
}
