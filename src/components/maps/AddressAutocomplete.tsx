import { useEffect, useRef, useState } from "react";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

export interface AddressResult {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  text?: string;
  address?: string;
  context?: { id: string; text: string; short_code?: string }[];
}

interface Props {
  value?: string;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ value, onSelect, placeholder = "Search address…" }: Props) {
  const { data: token, isLoading } = useMapboxToken();
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!token || query.length < 3) {
      setResults([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${token}&country=us&types=address&autocomplete=true&limit=5`;
        const res = await fetch(url);
        const json = await res.json();
        setResults(json.features ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 300);
  }, [query, token]);

  function handlePick(f: MapboxFeature) {
    const ctx = f.context ?? [];
    const cityCtx = ctx.find((c) => c.id.startsWith("place"))?.text ?? null;
    const stateCtx = ctx.find((c) => c.id.startsWith("region"))?.short_code?.replace("US-", "") ?? null;
    const zipCtx = ctx.find((c) => c.id.startsWith("postcode"))?.text ?? null;
    const streetNum = f.address ? `${f.address} ` : "";
    const street = `${streetNum}${f.text ?? ""}`.trim();
    setQuery(f.place_name);
    setOpen(false);
    onSelect({
      address: street || f.place_name.split(",")[0],
      city: cityCtx,
      state: stateCtx,
      zip: zipCtx,
      lat: f.center[1],
      lng: f.center[0],
    });
  }

  if (isLoading) return <Skeleton className="h-10 w-full" />;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border bg-[var(--bg-elevated)] px-3" style={{ borderColor: "var(--border)" }}>
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-lg"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          {results.map((f, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(f)}
              className="block w-full border-b px-3 py-2 text-left text-sm text-foreground last:border-0 hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              {f.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
