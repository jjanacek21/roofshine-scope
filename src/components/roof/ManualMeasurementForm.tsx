import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PITCH_OPTIONS, squares, withWaste, bundles } from "@/lib/roof-math";

export type ManualValues = {
  predominant_pitch: string;
  waste_pct: number;
  total_area_sqft: number;
  eaves_lf: number;
  rakes_lf: number;
  ridges_lf: number;
  hips_lf: number;
  valleys_lf: number;
  gutters_lf: number;
  wall_flashing_lf: number;
  step_flashing_lf: number;
  transition_lf: number;
};

export const blankManualValues: ManualValues = {
  predominant_pitch: "6/12",
  waste_pct: 15,
  total_area_sqft: 0,
  eaves_lf: 0,
  rakes_lf: 0,
  ridges_lf: 0,
  hips_lf: 0,
  valleys_lf: 0,
  gutters_lf: 0,
  wall_flashing_lf: 0,
  step_flashing_lf: 0,
  transition_lf: 0,
};

export function ManualMeasurementForm({
  values,
  onChange,
}: {
  values: ManualValues;
  onChange: (v: ManualValues) => void;
}) {
  const sq = squares(values.total_area_sqft);
  const sqWithWaste = squares(withWaste(values.total_area_sqft, values.waste_pct));
  const bundleCount = bundles(values.total_area_sqft, values.waste_pct);

  const num = (key: keyof ManualValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...values, [key]: Number(e.target.value) || 0 });

  const linearFields: { key: keyof ManualValues; label: string }[] = [
    { key: "eaves_lf", label: "Eaves" },
    { key: "rakes_lf", label: "Rakes" },
    { key: "ridges_lf", label: "Ridges" },
    { key: "hips_lf", label: "Hips" },
    { key: "valleys_lf", label: "Valleys" },
    { key: "gutters_lf", label: "Gutters" },
    { key: "wall_flashing_lf", label: "Wall Flashing" },
    { key: "step_flashing_lf", label: "Step Flashing" },
    { key: "transition_lf", label: "Transitions" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Total Roof Area (sqft)</Label>
          <Input
            type="number"
            value={values.total_area_sqft || ""}
            onChange={num("total_area_sqft")}
            placeholder="e.g. 2400"
          />
        </div>
        <div>
          <Label>Predominant Pitch</Label>
          <select
            value={values.predominant_pitch}
            onChange={(e) => onChange({ ...values, predominant_pitch: e.target.value })}
            className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            {PITCH_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <Label>Waste %</Label>
          <div className="flex h-10 gap-1 rounded-md border p-1" style={{ borderColor: "var(--border)" }}>
            {[10, 15, 20].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange({ ...values, waste_pct: w })}
                className={`flex-1 rounded text-xs font-semibold transition ${
                  values.waste_pct === w
                    ? "bg-[var(--brand)] text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {linearFields.map((f) => (
          <div key={f.key}>
            <Label>{f.label} (LF)</Label>
            <Input
              type="number"
              value={(values[f.key] as number) || ""}
              onChange={num(f.key)}
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <Stat label="Squares" value={sq.toFixed(2)} />
        <Stat label={`+ ${values.waste_pct}% waste`} value={sqWithWaste.toFixed(2)} />
        <Stat label="Bundles (3/sq)" value={bundleCount.toString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono-num text-2xl text-foreground">{value}</p>
    </div>
  );
}
