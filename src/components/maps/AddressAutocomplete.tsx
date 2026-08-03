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
        const base = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${token}&country=us&autocomplete=true&limit=5`;
        const res = await fetch(`${base}&types=address`);
        const json = await res.json();
        let features: MapboxFeature[] = json.features ?? [];
        if (features.length === 0) {
          // Grid / rural addresses (e.g. "19W565 Deerpath Ln") are often missing from
          // the address index — fall back to broader place types.
          const res2 = await fetch(`${base}&types=address,place,postcode,locality,neighborhood`);
          const json2 = await res2.json();
          features = json2.features ?? [];
        }
        setResults(features);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      }
    }, 300);
  }, [query, token]);

  // Best-effort parse of a typed address so users can proceed when Mapbox has no match.
  async function handleUseTyped() {
    const raw = query.trim();
    if (!raw) return;
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const street = parts[0] ?? raw;
    const city = parts.length > 1 ? parts[1] : null;
    const tail = parts.length > 2 ? parts[2] : "";
    const stateMatch = tail.match(/\b([A-Za-z]{2})\b/) ?? raw.match(/\b(IL|FL|TX|GA|CA|NY|NJ|OH|MI|IN|WI|MO|CO|AZ|NC|SC|TN|PA|VA|MD|MN|OK|KS|LA|AL|MS|KY|IA|NE|AR|NV|UT|OR|WA|CT|MA|NH|ME|RI|DE|WV|ID|MT|WY|ND|SD|NM|AK|HI|DC)\b/i);
    const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const q = [city, stateMatch?.[1], zipMatch?.[1]].filter(Boolean).join(" ") || raw;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          q,
        )}.json?access_token=${token}&country=us&limit=1`,
      );
      const json = await res.json();
      const c = json.features?.[0]?.center;
      if (Array.isArray(c)) {
        lng = c[0];
        lat = c[1];
      }
    } catch {
      /* keep null coords */
    }
    setOpen(false);
    onSelect({
      address: street,
      city,
      state: stateMatch?.[1]?.toUpperCase() ?? null,
      zip: zipMatch?.[1] ?? null,
      lat,
      lng,
    });
  }


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
          onFocus={() => query.length >= 3 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none"
        />
      </div>
      {open && query.trim().length >= 3 && (
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
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleUseTyped}
            className="block w-full border-t px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Use “{query.trim()}” as typed
            <span className="ml-1 font-normal text-muted-foreground">
              (for rural / grid addresses)
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
