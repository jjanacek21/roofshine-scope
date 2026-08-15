import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchLineItems, type CbCatalogLineItem } from "@/lib/cbCatalogResolve";

/** Price book search used by every mapping editor in the Claim Buddy admin. */
export function CbLineItemSearch({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (item: CbCatalogLineItem) => void;
}) {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CbCatalogLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await searchLineItems(term);
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find a price book line item</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            className="border-0 focus-visible:ring-0"
            placeholder="Search by code or name"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left hover:bg-accent"
                    onClick={() => {
                      onPick(r);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.unit ?? "EA"}</span>
                    </div>
                    <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                      <span>{r.code ?? "—"}</span>
                      <span>${Number(r.default_price ?? 0).toFixed(2)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
