import { useMemo } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { EDGE_LABELS, EDGE_COLORS, type EdgeType } from "@/lib/roof-math";
import { PENETRATION_LABELS, type PenetrationType } from "@/lib/mapbox-draw-styles";

export type SectionTotal = {
  id: string;
  name: string;
  color: string;
  pitch: string;
  pitch_multiplier: number;
  plan_area_sqft: number;
  sloped_area_sqft: number;
  squares: number;
  sloped_squares: number;
  waste_pct: number;
};

export type MeasurementTotals = {
  total_area_sqft: number;
  sloped_area_sqft: number;
  squares: number;
  sloped_squares: number;
  avg_pitch: string;
  edges: Partial<Record<EdgeType, number>>;
  penetrations: Partial<Record<PenetrationType, number>>;
  sections: SectionTotal[];
};

export type PerimeterSegment = { idx: number; lf: number; label: EdgeType | null };
export type UnlabeledLine = { id: string; lf: number };

export function MeasurementTotalsPanel({
  totals,
  wastePct,
  onWasteChange,
  onSave,
  isSaving,
  onAddRoof,
  onSectionWasteChange,
  onSectionDelete,
  onSectionRename,
  perimeterBySection,
  onPerimeterEdgeClick,
  unlabeledLines,
  onUnlabeledLineClick,
}: {
  totals: MeasurementTotals;
  wastePct: number;
  onWasteChange: (n: number) => void;
  onSave: () => void;
  isSaving: boolean;
  onAddRoof?: () => void;
  onSectionWasteChange?: (sectionId: string, n: number) => void;
  onSectionDelete?: (sectionId: string) => void;
  onSectionRename?: (sectionId: string, name: string) => void;
  perimeterBySection?: Record<string, PerimeterSegment[]>;
  onPerimeterEdgeClick?: (sectionId: string, segIdx: number) => void;
  unlabeledLines?: UnlabeledLine[];
  onUnlabeledLineClick?: (lineId: string) => void;
}) {
  const combinedAdjusted = useMemo(
    () =>
      totals.sections.reduce(
        (s, sec) => s + sec.sloped_squares * (1 + sec.waste_pct / 100),
        0,
      ),
    [totals.sections],
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
        <p className="text-xs text-muted-foreground">Mapbox Satellite</p>
      </Section>

      <Section label={`Roof Sections (${totals.sections.length})`}>
        {totals.sections.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">
            Draw a polygon on the map to add your first roof section.
          </p>
        ) : (
          <div className="space-y-2">
            {totals.sections.map((sec) => {
              const adjusted = sec.sloped_squares * (1 + sec.waste_pct / 100);
              return (
                <div
                  key={sec.id}
                  className="rounded-lg border p-2.5"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full ring-2 ring-white/10"
                      style={{ backgroundColor: sec.color }}
                    />
                    {onSectionRename ? (
                      <input
                        value={sec.name}
                        onChange={(e) => onSectionRename(sec.id, e.target.value)}
                        className="h-6 flex-1 rounded border bg-transparent px-1.5 text-xs font-semibold text-foreground outline-none focus:border-[var(--brand)]"
                        style={{ borderColor: "transparent" }}
                      />
                    ) : (
                      <span className="flex-1 text-xs font-semibold text-foreground">{sec.name}</span>
                    )}
                    <span className="font-mono-num text-[10px] text-muted-foreground">
                      {sec.pitch === "0/12" ? "Flat" : sec.pitch}
                    </span>
                    {onSectionDelete && (
                      <button
                        onClick={() => onSectionDelete(sec.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-red-400"
                        aria-label="Delete section"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
                    <RowMini label="Plan" value={`${Math.round(sec.plan_area_sqft).toLocaleString()} sf`} />
                    <RowMini label="Sloped" value={`${sec.sloped_squares.toFixed(2)} SQ`} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Waste
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={1}
                      value={sec.waste_pct}
                      onChange={(e) => onSectionWasteChange?.(sec.id, Number(e.target.value))}
                      className="flex-1 accent-[var(--brand)]"
                    />
                    <span className="font-mono-num w-9 text-right text-[11px] text-foreground">
                      {sec.waste_pct}%
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-[11px]">
                    <span className="text-muted-foreground">w/ waste</span>
                    <span className="font-mono-num font-semibold text-foreground">
                      {adjusted.toFixed(2)} SQ
                    </span>
                  </div>
                  {perimeterBySection?.[sec.id]?.length ? (
                    <PerimeterEdgesList
                      segments={perimeterBySection[sec.id]}
                      onClick={(idx) => onPerimeterEdgeClick?.(sec.id, idx)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {onAddRoof && (
          <button
            onClick={onAddRoof}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed text-xs font-semibold text-foreground transition hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Additional Roof
          </button>
        )}
      </Section>

      {totals.sections.length > 0 && (
        <Section label="Combined">
          <div className="space-y-1">
            <Row label="Plan area" value={`${Math.round(totals.total_area_sqft).toLocaleString()} sf`} />
            <Row label="Sloped area" value={`${Math.round(totals.sloped_area_sqft).toLocaleString()} sf`} />
            <Row label="Sloped squares" value={`${totals.sloped_squares.toFixed(2)} SQ`} />
            <Row label="Avg pitch" value={totals.avg_pitch} />
            <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold text-foreground">With waste</span>
              <span className="font-mono-num text-lg font-bold text-foreground">
                {combinedAdjusted.toFixed(2)} SQ
              </span>
            </div>
          </div>
        </Section>
      )}

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

      <Section label="Default Waste (new sections)">
        <div className="space-y-2">
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-num text-foreground">{value}</span>
    </div>
  );
}

function RowMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono-num text-foreground">{value}</span>
    </div>
  );
}
