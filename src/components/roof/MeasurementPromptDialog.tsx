import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EDGE_LABELS, EDGE_COLORS, type EdgeType } from "@/lib/roof-math";
import { PENETRATION_LABELS, type PenetrationType } from "@/lib/mapbox-draw-styles";

const PITCH_PRESETS = ["0/12", "3/12", "4/12", "6/12", "8/12", "10/12", "12/12"];

export type PitchResult = { pitch: string; name: string };

export type PromptKind =
  | {
      type: "pitch";
      defaultName?: string;
      onConfirm: (result: PitchResult) => void;
      onCancel: () => void;
    }
  | {
      type: "edge";
      initial?: EdgeType | null;
      restrictTo?: EdgeType[];
      title?: string;
      allowClear?: boolean;
      onConfirm: (edge: EdgeType | null) => void;
      onCancel: () => void;
    }
  | {
      type: "penetration";
      initial?: PenetrationType | null;
      onConfirm: (p: PenetrationType) => void;
      onCancel: () => void;
    };

export function MeasurementPromptDialog({ prompt }: { prompt: PromptKind | null }) {
  const [pitch, setPitch] = useState("6/12");
  const [name, setName] = useState("");
  const [customRise, setCustomRise] = useState("");
  const [edge, setEdge] = useState<EdgeType>("eave");
  const [penetration, setPenetration] = useState<PenetrationType>("pipe_boot");

  useEffect(() => {
    if (prompt?.type === "pitch") {
      setPitch("6/12");
      setName(prompt.defaultName ?? "");
    }
    if (prompt?.type === "edge") setEdge((prompt.initial ?? prompt.restrictTo?.[0] ?? "eave") as EdgeType);
    if (prompt?.type === "penetration") setPenetration((prompt.initial ?? "pipe_boot") as PenetrationType);
    setCustomRise("");
  }, [prompt]);

  if (!prompt) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) prompt.onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {prompt.type === "pitch" && (
          <>
            <DialogHeader>
              <DialogTitle>Roof section details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Section name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={prompt.defaultName ?? "Roof 1"}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Pitch</Label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {PITCH_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPitch(p)}
                      className={`h-10 rounded-md border text-sm font-mono-num transition ${
                        pitch === p
                          ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                          : "text-muted-foreground hover:bg-[var(--surface-hover)]"
                      }`}
                      style={{ borderColor: pitch === p ? undefined : "var(--border)" }}
                    >
                      {p === "0/12" ? "Flat" : p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Custom rise (over /12)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={24}
                  step={1}
                  value={customRise}
                  onChange={(e) => {
                    setCustomRise(e.target.value);
                    if (e.target.value) setPitch(`${e.target.value}/12`);
                  }}
                  placeholder="e.g. 7"
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <button
                onClick={prompt.onCancel}
                className="h-9 rounded-md border px-4 text-sm text-muted-foreground hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  prompt.onConfirm({
                    pitch,
                    name: name.trim() || prompt.defaultName || "Roof",
                  })
                }
                className="btn-brand h-9 rounded-md px-4 text-sm font-semibold"
              >
                Save section
              </button>
            </DialogFooter>
          </>
        )}

        {prompt.type === "edge" && (
          <>
            <DialogHeader>
              <DialogTitle>What type of edge is this?</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-2">
              {(Object.keys(EDGE_LABELS) as EdgeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setEdge(t)}
                  className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm transition ${
                    edge === t
                      ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                      : "text-muted-foreground hover:bg-[var(--surface-hover)]"
                  }`}
                  style={{ borderColor: edge === t ? undefined : "var(--border)" }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EDGE_COLORS[t] }} />
                  {EDGE_LABELS[t]}
                </button>
              ))}
            </div>
            <DialogFooter>
              <button
                onClick={prompt.onCancel}
                className="h-9 rounded-md border px-4 text-sm text-muted-foreground hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => prompt.onConfirm(edge)}
                className="btn-brand h-9 rounded-md px-4 text-sm font-semibold"
              >
                Save edge
              </button>
            </DialogFooter>
          </>
        )}

        {prompt.type === "penetration" && (
          <>
            <DialogHeader>
              <DialogTitle>Penetration type</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-2">
              {(Object.keys(PENETRATION_LABELS) as PenetrationType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setPenetration(t)}
                  className={`h-10 rounded-md border px-3 text-sm transition ${
                    penetration === t
                      ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                      : "text-muted-foreground hover:bg-[var(--surface-hover)]"
                  }`}
                  style={{ borderColor: penetration === t ? undefined : "var(--border)" }}
                >
                  {PENETRATION_LABELS[t]}
                </button>
              ))}
            </div>
            <DialogFooter>
              <button
                onClick={prompt.onCancel}
                className="h-9 rounded-md border px-4 text-sm text-muted-foreground hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => prompt.onConfirm(penetration)}
                className="btn-brand h-9 rounded-md px-4 text-sm font-semibold"
              >
                Save
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
