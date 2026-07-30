import { useState } from "react";
import { Sliders, RotateCcw, Loader2 } from "lucide-react";
import {
  DEFAULT_MEASURE_TUNING,
  TUNING_BOUNDS,
  type MeasureTuning,
} from "@/lib/measure-tuning";

/**
 * Per-job AI edge-detection controls. Tweaks how aggressively Google Solar
 * facets are trimmed before they land on the map.
 */
export function MeasureTuningPanel({
  tuning,
  onChange,
  onSave,
  saving,
  scopeLabel,
}: {
  tuning: MeasureTuning;
  onChange: (next: MeasureTuning) => void;
  onSave?: () => void;
  saving?: boolean;
  scopeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof MeasureTuning>(k: K, v: MeasureTuning[K]) =>
    onChange({ ...tuning, [k]: v });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--bg-hover)]"
        style={{ borderColor: "var(--border)" }}
        title="Adjust AI edge-detection sensitivity for this job"
      >
        <Sliders className="h-3.5 w-3.5" />
        AI settings
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-[320px] rounded-xl border p-4 shadow-xl"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Edge detection
            </h4>
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_MEASURE_TUNING })}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              title="Reset to defaults"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {scopeLabel ?? "Applies to this job only. Re-run AI measurements after changing."}
          </p>

          <div className="mt-4 space-y-4">
            <Row
              label="Edge tightness"
              value={`${Math.round(tuning.edge_tightness * 100)}%`}
              hint="Lower pulls facet edges inward on overhanging or shadowed roofs; higher pushes them out."
            >
              <input
                type="range"
                min={TUNING_BOUNDS.edge_tightness.min}
                max={TUNING_BOUNDS.edge_tightness.max}
                step={TUNING_BOUNDS.edge_tightness.step}
                value={tuning.edge_tightness}
                onChange={(e) => set("edge_tightness", Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
              />
            </Row>

            <Row
              label="Min facet size"
              value={`${tuning.min_facet_sqft} sqft`}
              hint="Discards sliver facets the AI hallucinates on busy roofs."
            >
              <input
                type="range"
                min={TUNING_BOUNDS.min_facet_sqft.min}
                max={TUNING_BOUNDS.min_facet_sqft.max}
                step={TUNING_BOUNDS.min_facet_sqft.step}
                value={tuning.min_facet_sqft}
                onChange={(e) => set("min_facet_sqft", Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
              />
            </Row>

            <Row
              label="Search radius"
              value={`${tuning.max_facet_radius_ft} ft`}
              hint="How far from your pin a facet can sit before it's treated as a neighbour's roof."
            >
              <input
                type="range"
                min={TUNING_BOUNDS.max_facet_radius_ft.min}
                max={TUNING_BOUNDS.max_facet_radius_ft.max}
                step={TUNING_BOUNDS.max_facet_radius_ft.step}
                value={tuning.max_facet_radius_ft}
                onChange={(e) => set("max_facet_radius_ft", Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
              />
            </Row>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Imagery quality floor</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(["HIGH", "MEDIUM", "LOW"] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => set("imagery_quality", q)}
                    className="rounded-md border px-2 py-1.5 text-[11px] font-semibold"
                    style={{
                      borderColor: tuning.imagery_quality === q ? "var(--brand)" : "var(--border)",
                      color: tuning.imagery_quality === q ? "var(--brand)" : undefined,
                    }}
                  >
                    {q === "HIGH" ? "High only" : q === "MEDIUM" ? "Medium+" : "Any"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                High only refuses blurry imagery — fewer but cleaner facets.
              </p>
            </div>
          </div>

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="btn-brand mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save for this job
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1.5">{children}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
