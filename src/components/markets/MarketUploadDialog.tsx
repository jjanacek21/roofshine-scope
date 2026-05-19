// CSV upload dialog for ingesting a market price list.
// Parses the CSV with papaparse, shows a preview, then calls the ingestMarketCsv server fn.
import { useState, useMemo } from "react";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ingestMarketCsv } from "@/lib/markets.functions";

type ParsedRow = {
  code: string;
  name: string;
  unit: string;
  unit_price: number;
  trade?: string | null;
  category?: string | null;
  description?: string | null;
};

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(obj).find((c) => c.trim().toLowerCase() === k.toLowerCase());
    if (found && obj[found] != null && String(obj[found]).trim() !== "") return String(obj[found]).trim();
  }
  return "";
}

function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function MarketUploadDialog({
  open,
  onClose,
  marketId,
  marketName,
}: {
  open: boolean;
  onClose: () => void;
  marketId: string;
  marketName: string;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);

  const ingest = useServerFn(ingestMarketCsv);
  const ingestMutation = useMutation({
    mutationFn: () => ingest({ data: { market_id: marketId, replace_existing_prices: true, rows } }),
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.prices_written} prices · ${res.catalog_items_created} new catalog items · ${res.catalog_items_matched} matched`,
      );
      qc.invalidateQueries({ queryKey: ["markets"] });
      qc.invalidateQueries({ queryKey: ["master-catalog-all"] });
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setFile(null);
    setRows([]);
    setErrors([]);
  }

  function handleFile(f: File) {
    setFile(f);
    setParsing(true);
    setErrors([]);
    Papa.parse<Record<string, unknown>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errs: string[] = [];
        const parsed: ParsedRow[] = [];
        result.data.forEach((raw, idx) => {
          const code = pick(raw, "code", "item_code", "xact_code", "selector");
          const name = pick(raw, "name", "description", "activity", "item", "line_item");
          const unit = pick(raw, "unit", "uom", "u/m", "measure") || "EA";
          const priceRaw = pick(raw, "unit_price", "price", "rate", "unit price", "cost");
          const trade = pick(raw, "trade", "category_group");
          const category = pick(raw, "category", "cat", "group");
          const description = pick(raw, "description", "long_description", "details");
          const unit_price = parsePrice(priceRaw);
          if (!code || !name || !Number.isFinite(unit_price)) {
            if (errs.length < 10) errs.push(`Row ${idx + 2}: missing code/name/price`);
            return;
          }
          parsed.push({
            code,
            name,
            unit,
            unit_price,
            trade: trade || null,
            category: category || null,
            description: description && description !== name ? description : null,
          });
        });
        setRows(parsed);
        setErrors(errs);
        setParsing(false);
        if (parsed.length === 0) {
          toast.error("No valid rows found. Check CSV column headers (code, name, unit_price).");
        }
      },
      error: (err) => {
        setErrors([err.message]);
        setParsing(false);
      },
    });
  }

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload price list — {marketName}</DialogTitle>
        </DialogHeader>

        {!file ? (
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold">Drop your CSV here</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Required columns: <code>code</code>, <code>name</code> (or <code>description</code>),{" "}
                <code>unit_price</code>. Optional: <code>unit</code>, <code>trade</code>, <code>category</code>.
              </div>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {parsing ? "parsing…" : `${rows.length} valid rows`}
                </span>
              </div>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <div className="font-semibold">Skipped rows:</div>
                <ul className="ml-4 list-disc">
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.length > 0 && (
              <div className="overflow-hidden rounded-md border text-xs" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-2 py-1 text-left">Code</th>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Unit</th>
                      <th className="px-2 py-1 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.code} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-2 py-1 font-mono">{r.code}</td>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">{r.unit}</td>
                        <td className="px-2 py-1 text-right font-mono">${r.unit_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > preview.length && (
                  <div className="border-t bg-muted/20 px-2 py-1 text-center text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                    + {rows.length - preview.length} more rows
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => (reset(), onClose())}>Cancel</Button>
          <Button
            onClick={() => ingestMutation.mutate()}
            disabled={rows.length === 0 || parsing || ingestMutation.isPending}
          >
            {ingestMutation.isPending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
