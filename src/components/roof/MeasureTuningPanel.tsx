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
              Roof fitting
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
            <div>
              <span className="text-xs font-medium text-foreground">Building outline</span>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(
                  [
                    ["auto", "Auto"],
                    ["osm", "Vector map"],
                    ["boxes", "Solar only"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("footprint_source", v)}
                    className="rounded-md border px-2 py-1.5 text-[11px] font-semibold"
                    style={{
                      borderColor: tuning.footprint_source === v ? "var(--brand)" : "var(--border)",
                      color: tuning.footprint_source === v ? "var(--brand)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Auto uses the real vector building outline and falls back to Google's roof data when
                the building isn't mapped.
              </p>
            </div>

            <Toggle
              label="Fewer, larger shapes"
              checked={tuning.merge_small}
              onChange={(v) => set("merge_small", v)}
              hint="Merges roof planes that face the same direction instead of many small pieces."
            />

            <Toggle
              label="Snap to square"
              checked={tuning.snap_square}
              onChange={(v) => set("snap_square", v)}
              hint="Straightens near-90° corners so the outline reads as a building."
            />


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

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex w-full items-center justify-between gap-3"
      >
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span
          className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
          style={{ background: checked ? "var(--brand)" : "var(--border)" }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
            style={{ left: checked ? 18 : 2 }}
          />
        </span>
      </button>
      <p className="mt-1 text-left text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

