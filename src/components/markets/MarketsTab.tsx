// Markets tab: list of master price-book "markets" (geographically scoped price overlays).
// Super admin can create, rename, set ZIPs, upload CSV, and delete.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, MapPin, Upload, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listMarkets, upsertMarket, deleteMarket } from "@/lib/markets.functions";
import { MarketUploadDialog } from "./MarketUploadDialog";

type Market = {
  id: string;
  name: string;
  region_name: string | null;
  jurisdiction: string | null;
  zip_codes: string[];
  item_count: number;
  notes: string | null;
};

export function MarketsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listMarkets);
  const upsert = useServerFn(upsertMarket);
  const remove = useServerFn(deleteMarket);

  const { data, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<Partial<Market> | null>(null);
  const [uploadFor, setUploadFor] = useState<Market | null>(null);

  const upsertMut = useMutation({
    mutationFn: (m: Partial<Market>) =>
      upsert({
        data: {
          id: m.id,
          region_name: m.region_name || m.name || "",
          jurisdiction: m.jurisdiction || null,
          zip_codes: (m.zip_codes ?? []).map((z) => z.trim()).filter(Boolean),
          notes: m.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Market saved");
      qc.invalidateQueries({ queryKey: ["markets"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Market deleted");
      qc.invalidateQueries({ queryKey: ["markets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markets: Market[] = (data?.markets ?? []).map((m) => ({
    ...m,
    zip_codes: m.zip_codes ?? [],
  })) as Market[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Markets</h2>
          <p className="text-sm text-muted-foreground">
            Each market shares the same catalog of line items but holds its own per-region unit prices.
          </p>
        </div>
        <Button onClick={() => setEditing({ region_name: "", zip_codes: [] })}>
          <Plus className="mr-1 h-4 w-4" /> New market
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : markets.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-semibold">No markets yet</div>
          <div className="text-xs text-muted-foreground">
            Create a market, then upload its CSV price list.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {markets.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <h3 className="truncate font-semibold">{m.region_name ?? m.name}</h3>
                  </div>
                  {m.jurisdiction && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{m.jurisdiction}</div>
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{m.item_count} items</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {m.zip_codes.slice(0, 8).map((z) => (
                  <span
                    key={z}
                    className="rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {z}
                  </span>
                ))}
                {m.zip_codes.length > 8 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{m.zip_codes.length - 8} more
                  </span>
                )}
                {m.zip_codes.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">No ZIPs set</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setUploadFor(m)}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Delete market "${m.region_name ?? m.name}" and all its prices?`)) {
                      removeMut.mutate(m.id);
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit market" : "New market"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Region name</Label>
                <Input
                  value={editing.region_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, region_name: e.target.value })}
                  placeholder="South Florida"
                />
              </div>
              <div>
                <Label>Jurisdiction (optional)</Label>
                <Input
                  value={editing.jurisdiction ?? ""}
                  onChange={(e) => setEditing({ ...editing, jurisdiction: e.target.value })}
                  placeholder="Miami-Dade"
                />
              </div>
              <div>
                <Label>ZIP codes</Label>
                <Textarea
                  rows={4}
                  value={(editing.zip_codes ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      zip_codes: e.target.value
                        .split(/[\s,;\n]+/)
                        .map((z) => z.trim())
                        .filter((z) => /^\d{3,5}$/.test(z)),
                    })
                  }
                  placeholder="33101, 33102, 33125, 33126…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Comma / space / newline separated. {(editing.zip_codes ?? []).length} valid ZIPs.
                </p>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={!editing.region_name || upsertMut.isPending}
                onClick={() => upsertMut.mutate(editing)}
              >
                {upsertMut.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {uploadFor && (
        <MarketUploadDialog
          open
          marketId={uploadFor.id}
          marketName={uploadFor.region_name ?? uploadFor.name}
          onClose={() => setUploadFor(null)}
        />
      )}
    </div>
  );
}
