/**
 * Public record card for map mode.
 *
 * Everything here comes from the Florida assessment roll — free, public, no
 * vendor. It answers "is this door worth knocking" before the rep spends a
 * step: who owns it, do they live there, how old is the structure, when did
 * it last sell.
 *
 * It stops at public record. No phone numbers, no email addresses.
 */
import { Home, Landmark, Loader2, RefreshCw, UserPlus } from "lucide-react";
import {
  canvassSignals,
  roofAgeFloor,
  type CanvassSignal,
  type FlParcel,
} from "@/lib/parcels/fl-cadastral";
import { useFlParcel } from "@/hooks/useFlParcel";

const TONE: Record<CanvassSignal["tone"], { bg: string; fg: string; bd: string }> = {
  good: { bg: "rgba(21,128,61,.10)", fg: "#15803d", bd: "rgba(21,128,61,.30)" },
  warn: { bg: "rgba(180,120,10,.10)", fg: "#8a5d00", bd: "rgba(180,120,10,.30)" },
  hot: { bg: "rgba(190,60,40,.10)", fg: "#b03a28", bd: "rgba(190,60,40,.30)" },
  neutral: { bg: "rgba(0,0,0,.04)", fg: "var(--cb-text-muted)", bd: "rgba(0,0,0,.12)" },
};

function money(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
        {label}
      </span>
      <span className="text-right text-[13px] font-medium">{value}</span>
    </div>
  );
}

export function CbParcelCard({
  lat,
  lng,
  onUseOwnerName,
}: {
  lat: number;
  lng: number;
  /** Push the roll's owner name up into the panel's Name field. */
  onUseOwnerName?: (name: string) => void;
}) {
  const { data: parcel, isFetching, error, refetch, outOfCoverage } = useFlParcel(lat, lng);

  const shell = (children: React.ReactNode) => (
    <div
      className="mt-4 rounded-[14px] p-3"
      style={{
        background: "var(--cb-surface, #fff)",
        border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
      }}
    >
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4" style={{ color: "var(--cb-accent)" }} />
        <p className="cb-microlabel">Public record</p>
        {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      </div>
      {children}
    </div>
  );

  if (outOfCoverage) {
    return shell(
      <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        Parcel records are wired up for Florida so far. This address is outside that coverage.
      </p>,
    );
  }

  if (error) {
    return shell(
      <div className="mt-2">
        <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
          {(error as Error).message || "The parcel service did not respond."}
        </p>
        <button
          onClick={() => void refetch()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>,
    );
  }

  if (isFetching && !parcel) {
    return shell(
      <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        Reading the county roll…
      </p>,
    );
  }

  if (!parcel) {
    return shell(
      <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
        No parcel on record at this point. Tap directly on the roof.
      </p>,
    );
  }

  const p: FlParcel = parcel;
  const signals = canvassSignals(p);
  const age = roofAgeFloor(p);

  return shell(
    <div className="mt-2">
      {/* Owner */}
      <div className="flex items-start gap-2">
        {p.owner.isEntity ? (
          <Landmark
            className="mt-[3px] h-4 w-4 shrink-0"
            style={{ color: "var(--cb-text-muted)" }}
          />
        ) : (
          <Home className="mt-[3px] h-4 w-4 shrink-0" style={{ color: "var(--cb-text-muted)" }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">
            {p.owner.display || "Owner not on record"}
          </p>
          {p.ownerMailing.full ? (
            <p
              className="mt-[2px] text-[12px] leading-snug"
              style={{ color: "var(--cb-text-muted)" }}
            >
              {p.absentee ? "Mails to " : "Mailing "}
              {p.ownerMailing.full}
            </p>
          ) : null}
        </div>
        {onUseOwnerName && p.owner.display && !p.owner.isEntity ? (
          <button
            onClick={() => onUseOwnerName(p.owner.display)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
            style={{
              border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
              color: "var(--cb-accent)",
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Use
          </button>
        ) : null}
      </div>

      {/* Signals */}
      {signals.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {signals.map((s) => {
            const t = TONE[s.tone];
            return (
              <span
                key={s.label}
                className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Facts */}
      <div
        className="mt-3 border-t pt-2"
        style={{ borderColor: "var(--cb-hairline, rgba(0,0,0,.12))" }}
      >
        <Row label="Property type" value={p.useLabel ?? "—"} />
        <Row
          label="Year built"
          value={p.yearBuilt ? `${p.yearBuilt}${age != null ? ` · ${age} yr old` : ""}` : "—"}
        />
        {p.improvementGap ? (
          <Row label="Effective year" value={`${p.effectiveYearBuilt} — work done`} />
        ) : null}
        <Row
          label="Heated area"
          value={p.heatedAreaSqFt ? `${p.heatedAreaSqFt.toLocaleString()} sq ft` : "—"}
        />
        {p.buildings && p.buildings > 1 ? <Row label="Buildings" value={p.buildings} /> : null}
        <Row label="Lot" value={p.landSqFt ? `${p.landSqFt.toLocaleString()} sq ft` : "—"} />
        {/* The GIS join only carries sales on ~1 parcel in 10. Say "not carried",
            never "never sold" — a rep would read that as a signal. */}
        <Row
          label="Last sale"
          value={
            p.lastSale ? (
              `${money(p.lastSale.price)} · ${p.lastSale.year}`
            ) : (
              <span style={{ color: "var(--cb-text-muted)" }}>Not carried for this parcel</span>
            )
          }
        />
        <Row label="Just value" value={money(p.justValue)} />
        <Row
          label="Parcel"
          value={<span className="font-mono text-[12px]">{p.parcelId || "—"}</span>}
        />
      </div>

      <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--cb-text-muted)" }}>
        Florida Department of Revenue assessment roll
        {p.assessmentYear ? `, ${p.assessmentYear}` : ""}. Public record — no phone or email is
        stored here.
      </p>
    </div>,
  );
}
