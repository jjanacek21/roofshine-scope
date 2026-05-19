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
  replace_price: number;
  remove_price: number;
  trade: string | null;
  subgroup: string | null;
};

function pick(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(obj).find((c) => c.trim().toLowerCase() === k.toLowerCase());
    if (found && obj[found] != null && String(obj[found]).trim() !== "") {
      return String(obj[found]).trim();
    }
  }
  return "";
}

function parseNum(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
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
  const [skippedBlank, setSkippedBlank] = useState(0);
  const [parsing, setParsing] = useState(false);

  const ingest = useServerFn(ingestMarketCsv);
  const ingestMutation = useMutation({
    mutationFn: () =>
      ingest({
        data: {
          market_id: marketId,
          replace_existing_prices: true,
          rows: rows.map((r) => ({
            code: r.code,
            name: r.name,
            unit: r.unit,
            replace_price: r.replace_price,
            remove_price: r.remove_price,
            trade: r.trade,
            subgroup: r.subgroup,
          })),
        },
      }),
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
    setSkippedBlank(0);
  }

  function handleFile(f: File) {
    setFile(f);
    setParsing(true);
    setErrors([]);
    setSkippedBlank(0);
    Papa.parse<Record<string, unknown>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errs: string[] = [];
        const parsed: ParsedRow[] = [];
        let blanks = 0;
        result.data.forEach((raw, idx) => {
          // Catalog code: prefer "item_number" (the column in the uploaded CSVs).
          const code = pick(raw, "item_number", "code", "item_code", "xact_code", "selector");
          const name = pick(raw, "description", "name", "activity", "item", "line_item");
          const unit = pick(raw, "unit", "uom", "u/m", "measure") || "EA";
          const replace_price = parseNum(pick(raw, "replace", "unit_price", "price", "rate", "cost"));
          const remove_price = parseNum(pick(raw, "remove", "removal", "demo"));
          const trade = pick(raw, "trade", "category_group");
          const subgroup = pick(raw, "sub_group", "subgroup", "category", "cat", "group");

          if (!code || !name) {
            if (errs.length < 10) errs.push(`Row ${idx + 2}: missing item_number/description`);
            return;
          }
          if (replace_price <= 0 && remove_price <= 0) {
            blanks += 1;
            return;
          }
          parsed.push({
            code: code.padStart(4, "0"),
            name,
            unit,
            replace_price,
            remove_price,
            trade: trade || null,
            subgroup: subgroup || null,
          });
        });
        setRows(parsed);
        setErrors(errs);
        setSkippedBlank(blanks);
        setParsing(false);
        if (parsed.length === 0) {
          toast.error(
            "No valid rows found. Expected columns: item_number, description, unit, remove, replace, trade, sub_group.",
          );
        }
      },
      error: (err) => {
        setErrors([err.message]);
        setParsing(false);
      },
    });
  }

  const preview = useMemo(() => rows.slice(0, 6), [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-3xl">
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
                Expected columns: <code>item_number</code>, <code>description</code>,{" "}
                <code>unit</code>, <code>remove</code>, <code>replace</code>,{" "}
                <code>trade</code>, <code>sub_group</code>.
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
                  {parsing
                    ? "parsing…"
                    : `${rows.length} valid rows${skippedBlank ? ` · ${skippedBlank} blank skipped` : ""}`}
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
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Unit</th>
                      <th className="px-2 py-1 text-right">Remove</th>
                      <th className="px-2 py-1 text-right">Replace</th>
                      <th className="px-2 py-1 text-left">Trade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.code} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-2 py-1 font-mono">{r.code}</td>
                        <td className="px-2 py-1 max-w-[280px] truncate">{r.name}</td>
                        <td className="px-2 py-1">{r.unit}</td>
                        <td className="px-2 py-1 text-right font-mono">${r.remove_price.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-mono">${r.replace_price.toFixed(2)}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.trade ?? "—"}</td>
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
