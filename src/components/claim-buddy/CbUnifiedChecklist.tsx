import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { CbCard, CbSkeleton } from "@/components/cb/primitives";
import { CbCamera } from "@/components/cb/CbCamera";
import { cbHaptic } from "@/components/cb/motion";
import type { CbRow, CbRowGroup } from "@/lib/cbSheetRows";

type Stage = { row: CbRow; kind: "medium" | "close" | "detail" } | null;

/**
 * ONE list per elevation / slope / room: check the item, type the quantity,
 * shoot it — all on the same row. No second takeoff pass.
 */
export function CbUnifiedChecklist({
  groups,
  isLoading,
  jobId,
  workspaceId,
  contextLabel,
  contextKey,
  onToggle,
  onQty,
  onNote,
  onShot,
}: {
  groups: CbRowGroup[];
  isLoading?: boolean;
  jobId: string;
  workspaceId: string | null | undefined;
  /** e.g. "Front elevation" */
  contextLabel: string;
  /** e.g. "front" — written to cb_photos.elevation */
  contextKey: string;
  onToggle: (row: CbRow, next: boolean) => void;
  onQty: (row: CbRow, value: number | null) => void;
  onNote: (row: CbRow, value: string) => void;
  onShot: (row: CbRow, kind: "medium" | "close" | "detail", count: number) => void;
}) {
  const [stage, setStage] = useState<Stage>(null);
  const [pending, setPending] = useState<CbRow | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <CbSkeleton height={54} />
        <CbSkeleton height={54} />
        <CbSkeleton height={54} />
      </div>
    );
  }

  function shoot(row: CbRow) {
    cbHaptic();
    if (row.cameraMode === "pair") {
      setPending(row);
      setStage({ row, kind: "medium" });
    } else {
      setPending(null);
      setStage({ row, kind: "detail" });
    }
  }

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <CbCard key={g.group_name} elevation="card" style={{ padding: 16 }}>
          <span className="cb-microlabel">{g.group_name}</span>
          <div className="mt-2 grid gap-2">
            {g.rows.map((row) => {
              const on = row.selected;
              return (
                <div key={row.id} className={`cb-item-row ${on ? "is-on" : ""}`}>
                  <div className="flex items-center gap-2" style={{ padding: 4 }}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      style={{ minHeight: 48, background: "none", border: 0 }}
                      onClick={() => {
                        cbHaptic();
                        onToggle(row, !on);
                      }}
                    >
                      <span className="cb-item-box" aria-hidden>
                        {on ? <Check size={15} strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="cb-item-label block truncate">{row.label}</span>
                        {row.hint ? <span className="cb-microlabel">{row.hint}</span> : null}
                      </span>
                    </button>

                    <input
                      className="cb-input cb-num"
                      inputMode="decimal"
                      aria-label={`${row.label} quantity`}
                      placeholder={row.unit ?? ""}
                      style={{ width: 88, height: 48, textAlign: "right", padding: "0 10px", flexShrink: 0 }}
                      value={row.qty ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        onQty(row, v === "" ? null : Number(v));
                      }}
                    />

                    <button
                      type="button"
                      aria-label={`Photograph ${row.label}`}
                      onClick={() => shoot(row)}
                      style={{
                        height: 48,
                        width: 48,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--cb-border)",
                        background: "transparent",
                        color: row.photos > 0 ? "var(--cb-accent)" : "var(--cb-text-muted)",
                        flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      <Camera size={18} strokeWidth={1.7} />
                      {row.photos > 0 ? (
                        <span
                          className="cb-num"
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            fontSize: 11,
                            lineHeight: "16px",
                            minWidth: 16,
                            padding: "0 4px",
                            borderRadius: 8,
                            background: "var(--cb-accent)",
                            color: "#fff",
                          }}
                        >
                          {row.photos}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {on && row.catalogKey ? (
                    <div className="cb-item-body">
                      <label className="cb-inline-field">
                        <span className="cb-microlabel">Note</span>
                        <input
                          className="cb-input cb-input-sm"
                          value={row.note ?? ""}
                          onChange={(e) => onNote(row, e.target.value)}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CbCard>
      ))}

      {groups.length === 0 ? (
        <CbCard elevation="card" style={{ padding: 16 }}>
          <span className="cb-microlabel">Nothing to log here yet</span>
        </CbCard>
      ) : null}

      {stage ? (
        <CbCamera
          open
          jobId={jobId}
          workspaceId={workspaceId}
          title={`${contextLabel} — ${stage.row.label}`}
          instruction={
            stage.kind === "medium"
              ? "Back up a few feet. Get the whole item and where it sits on the building."
              : stage.kind === "close"
                ? "Now tight on the damage itself."
                : `Photograph the ${stage.row.label.toLowerCase()} so the line item and the photo stay linked.`
          }
          captionContext={`${contextLabel} — ${stage.row.label}${
            stage.kind === "medium" ? " — medium" : stage.kind === "close" ? " — close-up" : ""
          }`}
          meta={{
            category: stage.row.photoCategory,
            elevation: contextKey,
            item_key: stage.row.photoKey,
            shot_type: stage.kind,
          }}
          onSaved={(count) => onShot(stage.row, stage.kind, count)}
          onClose={() => {
            if (stage.kind === "medium" && pending) {
              setStage({ row: pending, kind: "close" });
            } else {
              setStage(null);
              setPending(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
