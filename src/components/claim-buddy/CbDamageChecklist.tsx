import { useState } from "react";
import { Check } from "lucide-react";
import { CbCard, CbButton, CbBadge, CbSkeleton } from "@/components/cb/primitives";
import { CbCamera } from "@/components/cb/CbCamera";
import { cbHaptic } from "@/components/cb/motion";
import { useCbCatalog, type CbCatalogItem, type CbScope } from "@/lib/cbCatalog";
import type { CbItemEntry } from "@/lib/cbTakeoff";

type Stage = { item: CbCatalogItem; kind: "medium" | "close" } | null;

/**
 * Checking an item immediately walks the two-shot sequence (medium, then close),
 * then asks for the quantity in the catalog unit plus an optional note.
 */
export function CbDamageChecklist({
  scope,
  jobId,
  workspaceId,
  elevationKey,
  elevationLabel,
  entries,
  onShot,
  onEntry,
  onRemove,
  photoCategory,
}: {
  scope: CbScope;
  jobId: string;
  workspaceId: string | null | undefined;
  elevationKey: string;
  elevationLabel: string;
  entries: Record<string, CbItemEntry>;
  onShot: (itemKey: string, kind: "medium" | "close", count: number) => void;
  onEntry: (itemKey: string, patch: Partial<CbItemEntry>) => void;
  onRemove: (itemKey: string) => void;
  photoCategory: string;
}) {
  const { data: groups, isLoading } = useCbCatalog(scope);
  const [stage, setStage] = useState<Stage>(null);
  const [pendingItem, setPendingItem] = useState<CbCatalogItem | null>(null);

  if (isLoading || !groups) {
    return (
      <div className="grid gap-2">
        <CbSkeleton height={54} />
        <CbSkeleton height={54} />
        <CbSkeleton height={54} />
      </div>
    );
  }

  function toggle(item: CbCatalogItem) {
    cbHaptic();
    if (entries[item.item_key]) {
      onRemove(item.item_key);
      return;
    }
    setPendingItem(item);
    setStage({ item, kind: "medium" });
  }

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <CbCard key={g.group_name} elevation="card" style={{ padding: 16 }}>
          <span className="cb-microlabel">{g.group_name}</span>
          <div className="mt-2 grid gap-2">
            {g.items.map((item) => {
              const entry = entries[item.item_key];
              const on = !!entry;
              return (
                <div key={item.item_key} className={`cb-item-row ${on ? "is-on" : ""}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className="cb-item-head"
                    onClick={() => toggle(item)}
                  >
                    <span className="cb-item-box" aria-hidden>
                      {on ? <Check size={15} strokeWidth={3} /> : null}
                    </span>
                    <span className="cb-item-label">{item.label}</span>
                    {on ? (
                      <CbBadge tone="accent">
                        {(entry.medium ?? 0) + (entry.close ?? 0)} photos
                      </CbBadge>
                    ) : item.unit ? (
                      <span className="cb-item-unit cb-num">{item.unit}</span>
                    ) : null}
                  </button>

                  {on ? (
                    <div className="cb-item-body">
                      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
                        <label className="cb-inline-field">
                          <span className="cb-microlabel">Qty {item.unit ? `(${item.unit})` : ""}</span>
                          <input
                            className="cb-input cb-input-sm cb-num"
                            inputMode="decimal"
                            value={entry.qty ?? ""}
                            onChange={(e) =>
                              onEntry(item.item_key, {
                                qty: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="cb-inline-field">
                          <span className="cb-microlabel">Note</span>
                          <input
                            className="cb-input cb-input-sm"
                            value={entry.note ?? ""}
                            onChange={(e) => onEntry(item.item_key, { note: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <CbButton
                          size="md"
                          variant="secondary"
                          onClick={() => {
                            setPendingItem(item);
                            setStage({ item, kind: "medium" });
                          }}
                        >
                          + Medium ({entry.medium ?? 0})
                        </CbButton>
                        <CbButton
                          size="md"
                          variant="secondary"
                          onClick={() => {
                            setPendingItem(item);
                            setStage({ item, kind: "close" });
                          }}
                        >
                          + Close-up ({entry.close ?? 0})
                        </CbButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CbCard>
      ))}

      {stage ? (
        <CbCamera
          open
          jobId={jobId}
          workspaceId={workspaceId}
          title={`${elevationLabel} — ${stage.item.label}`}
          instruction={
            stage.kind === "medium"
              ? "Back up a few feet. Get the whole item and where it sits on the building."
              : "Now tight on the damage itself."
          }
          captionContext={`${elevationLabel} elevation — ${stage.item.label} — ${
            stage.kind === "medium" ? "medium" : "close-up"
          }`}
          meta={{
            category: photoCategory,
            elevation: elevationKey,
            item_key: stage.item.item_key,
            shot_type: stage.kind,
          }}
          onSaved={(count) => {
            onShot(stage.item.item_key, stage.kind, count);
          }}
          onClose={() => {
            // medium → close is one continuous sequence
            if (stage.kind === "medium" && pendingItem) {
              setStage({ item: pendingItem, kind: "close" });
            } else {
              setStage(null);
              setPendingItem(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
