import { useMapboxToken } from "@/hooks/useMapboxToken";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

export function MapPreview({
  jobId,
  lat,
  lng,
  width = 600,
  height = 360,
}: {
  jobId: string;
  lat: number | null;
  lng: number | null;
  width?: number;
  height?: number;
}) {
  const { data: token } = useMapboxToken();

  if (lat == null || lng == null) {
    return (
      <div
        className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border text-center text-muted-foreground"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
      >
        <MapPin className="h-6 w-6 opacity-50" />
        <p className="text-xs">No coordinates yet — add an address to the property.</p>
      </div>
    );
  }

  if (!token) {
    return <div className="h-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />;
  }

  const w = Math.min(width, 1280);
  const h = Math.min(height, 1280);
  const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-l-home+1e90ff(${lng},${lat})/${lng},${lat},19,0/${w}x${h}@2x?access_token=${token}`;

  return (
    <Link
      to="/jobs/$id/measure"
      params={{ id: jobId }}
      className="block overflow-hidden rounded-lg border transition hover:opacity-95"
      style={{ borderColor: "var(--border)" }}
    >
      <img src={url} alt="Property satellite view" className="block w-full" />
    </Link>
  );
}
