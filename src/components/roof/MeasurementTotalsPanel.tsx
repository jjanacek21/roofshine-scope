import { useMemo } from "react";
import { Save } from "lucide-react";
import { EDGE_LABELS, EDGE_COLORS, type EdgeType } from "@/lib/roof-math";
import { PENETRATION_LABELS, type PenetrationType } from "@/lib/mapbox-draw-styles";

export type MeasurementTotals = {
  total_area_sqft: number;
  sloped_area_sqft: number;
  squares: number;
  sloped_squares: number;
  avg_pitch: string;
  edges: Partial<Record<EdgeType, number>>;
  penetrations: Partial<Record<PenetrationType, number>>;
};

export function MeasurementTotalsPanel({
  totals,
  wastePct,
  onWasteChange,
  onSave,
  isSaving,
}: {
  totals: MeasurementTotals;
  wastePct: number;
  onWasteChange: (n: number) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const wastedSquares = useMemo(
    () => totals.sloped_squares * (1 + wastePct / 100),
    [totals.sloped_squares, wastePct],
  );

  const edgeEntries = (Object.keys(EDGE_LABELS) as EdgeType[])
    .map((k) => [k, totals.edges[k] ?? 0] as const)
    .filter(([, v]) => v > 0);

  const penEntries = (Object.keys(PENETRATION_LABELS) as PenetrationType[])
    .map((k) => [k, totals.penetrations[k] ?? 0] as const)
    .filter(([, v]) => v > 0);

  return (
    <aside
      className="space-y-5 rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <Section label="Imagery">
        <p className="text-xs text-muted-foreground">Mapbox Satellite · Q1 2026</p>
      </Section>

      <Section label="Roof Totals">
        <div className="space-y-2">
          <BigStat
            label="Area (Flat)"
            value={`${totals.squares.toFixed(2)} SQ`}
          />
          <Row label="Area (Sloped)" value={`${totals.sloped_squares.toFixed(2)} SQ`} />
          <Row label="Square Feet" value={`${Math.round(totals.sloped_area_sqft).toLocaleString()} sf`} />
          <Row label="Avg. Pitch" value={totals.avg_pitch} />
        </div>
      </Section>

      <Section label="Edges">
        {edgeEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No labeled edges yet.</p>
        ) : (
          <div className="space-y-1.5">
            {edgeEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-foreground/80">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EDGE_COLORS[k] }} />
                  {EDGE_LABELS[k]}
                </span>
                <span className="font-mono-num text-foreground">{v.toFixed(0)} LF</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Penetrations">
        {penEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No penetrations placed.</p>
        ) : (
          <div className="space-y-1.5">
            {penEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-foreground/80">{PENETRATION_LABELS[k]}</span>
                <span className="font-mono-num text-foreground">{v}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Waste Factor">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Waste %</span>
            <span className="font-mono-num text-sm text-foreground">{wastePct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            step={1}
            value={wastePct}
            onChange={(e) => onWasteChange(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { l: "Gable 10%", v: 10 },
              { l: "Hip 12%", v: 12 },
              { l: "Complex 15%", v: 15 },
            ].map((p) => (
              <button
                key={p.v}
                onClick={() => onWasteChange(p.v)}
                className={`h-7 rounded-full border px-3 text-[11px] transition ${
                  wastePct === p.v
                    ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                    : "text-muted-foreground hover:bg-[var(--surface-hover)]"
                }`}
                style={{ borderColor: wastePct === p.v ? undefined : "var(--border)" }}
              >
                {p.l}
              </button>
            ))}
          </div>
          <Row label="With waste" value={`${wastedSquares.toFixed(2)} SQ`} />
        </div>
      </Section>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="btn-brand inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:opacity-40"
      >
        <Save className="h-4 w-4" />
        {isSaving ? "Saving…" : "Save Measurement"}
      </button>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      {children}
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono-num text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-num text-foreground">{value}</span>
    </div>
  );
}
