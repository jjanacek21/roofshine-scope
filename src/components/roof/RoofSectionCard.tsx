import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { PITCH_OPTIONS, pitchMultiplier, polygonEdgeLengths, type EdgeType } from "@/lib/roof-math";
import { EdgeLabelEditor } from "./EdgeLabelEditor";

export type SectionState = {
  id: string;
  name: string;
  color: string;
  ring: number[][]; // [[lng,lat],...]
  plan_area_sqft: number;
  pitch: string;
  edges: (EdgeType | null)[];
};

export function RoofSectionCard({
  section,
  onChange,
  onDelete,
}: {
  section: SectionState;
  onChange: (s: SectionState) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const mult = pitchMultiplier(section.pitch);
  const actual = section.plan_area_sqft * mult;
  const edgeLengths = polygonEdgeLengths(section.ring);

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-center gap-2 p-3">
        <span
          className="inline-block h-3 w-3 rounded-full ring-2 ring-white/10"
          style={{ backgroundColor: section.color }}
        />
        <Input
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
          className="h-8 flex-1 text-sm font-semibold"
        />
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-red-400"
          aria-label="Delete section"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-hover)]"
          aria-label="Toggle section"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t p-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Pitch</Label>
              <select
                value={section.pitch}
                onChange={(e) => onChange({ ...section, pitch: e.target.value })}
                className="h-9 w-full rounded-md border bg-[var(--bg-elevated)] px-2 text-sm text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                {PITCH_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>Plan Area</Label>
              <p className="mt-2 font-mono-num text-sm text-foreground">
                {section.plan_area_sqft.toFixed(0)} sqft
              </p>
            </div>
            <div>
              <Label>Actual Area</Label>
              <p className="mt-2 font-mono-num text-sm text-foreground">
                {actual.toFixed(0)} sqft
                <span className="ml-1 text-[10px] text-muted-foreground">×{mult.toFixed(3)}</span>
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Edges ({section.edges.length})
            </p>
            <EdgeLabelEditor
              edges={section.edges}
              lengths={edgeLengths}
              onChange={(next) => onChange({ ...section, edges: next })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
