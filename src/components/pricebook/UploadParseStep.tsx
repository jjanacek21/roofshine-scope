import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { autoMapHeader, extractEstimateFromSpreadsheet, type ColumnRole } from "@/lib/xactimate-parser";

const BASE_ROLES: { value: ColumnRole; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "code", label: "Code / Selector" },
  { value: "name", label: "Description / Activity" },
  { value: "unit", label: "Unit" },
  { value: "qty", label: "Qty" },
  { value: "unit_price", label: "Unit Price" },
  { value: "line_total", label: "Line Total / RCV" },
  { value: "category", label: "Category" },
  { value: "labor_pct", label: "Labor %" },
  { value: "material_pct", label: "Material %" },
  { value: "equipment_pct", label: "Equipment %" },
];

const RETAIL_EXTRA_ROLES: { value: ColumnRole; label: string }[] = [
  { value: "material_cost", label: "Material Cost ($)" },
  { value: "labor_cost", label: "Labor Cost ($)" },
  { value: "equipment_cost", label: "Equipment Cost ($)" },
  { value: "misc_cost", label: "Misc/Tax/Permit/Dump ($)" },
  { value: "overhead_pct_val", label: "Overhead %" },
];

export interface ParsedFile {
  file: File;
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: ColumnRole[];
  sheetName?: string;
  source: "pdf" | "spreadsheet";
}

interface Props {
  value: ParsedFile | null;
  onChange: (v: ParsedFile | null) => void;
  pricingType?: "insurance" | "retail";
}

export function UploadParseStep({ value, onChange, pricingType = "insurance" }: Props) {
  const [parsing, setParsing] = useState(false);
  const [parseStage, setParseStage] = useState<"idle" | "spreadsheet" | "pdf-extract" | "pdf-ai">("idle");
  const [error, setError] = useState<string | null>(null);
  const roleOptions = pricingType === "retail" ? [...BASE_ROLES, ...RETAIL_EXTRA_ROLES] : BASE_ROLES;

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setError(null);
      setParsing(true);
      try {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          setParseStage("pdf-ai");
          const fd = new FormData();
          fd.append("file", file);
          const resp = await fetch("/api/parse-xactimate-pdf", { method: "POST", body: fd });
          const data = await resp.json();
          if (!resp.ok) {
            setError(data?.error ?? "Failed to extract line items from PDF");
            return;
          }
          const headers: string[] = data.headers ?? ["Code", "Description", "Unit", "Unit Price", "Category"];
          const rows: Record<string, unknown>[] = data.rows ?? [];
          const mapping = headers.map((h) => autoMapHeader(h));
          onChange({ file, headers, rows, mapping, source: "pdf" });
        } else {
          setParseStage("spreadsheet");
          const buf = await file.arrayBuffer();
          const extracted = extractEstimateFromSpreadsheet(buf);
          if (extracted.rows.length === 0) {
            setError("No line items found in this file. Make sure the sheet has a header row with at least Code/Selector and Description/Activity columns.");
            return;
          }
          onChange({
            file,
            headers: extracted.headers,
            rows: extracted.rows,
            mapping: extracted.mapping,
            sheetName: extracted.sheetName,
            source: "spreadsheet",
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
      } finally {
        setParsing(false);
        setParseStage("idle");
      }
    },
    [onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  function updateMapping(idx: number, role: ColumnRole) {
    if (!value) return;
    const next = [...value.mapping];
    next[idx] = role;
    onChange({ ...value, mapping: next });
  }

  if (!value) {
    return (
      <div className="space-y-3">
        <div
          {...getRootProps()}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors"
          style={{
            borderColor: isDragActive ? "var(--brand)" : "var(--border)",
            backgroundColor: isDragActive ? "var(--bg-hover)" : "var(--bg-card)",
          }}
        >
          <input {...getInputProps()} />
          {parseStage === "pdf-ai" ? (
            <Sparkles className="mb-3 h-10 w-10 animate-pulse text-[var(--brand)]" />
          ) : (
            <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          )}
          <p className="text-sm font-medium text-foreground">
            {parseStage === "pdf-ai"
              ? "Extracting line items with AI… (10–30 s)"
              : parsing
                ? "Reading file & detecting columns…"
                : isDragActive
                  ? "Drop your estimate here"
                  : "Drop your Xactimate estimate file here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">PDF · Excel (.xlsx, .xls) · CSV</p>
          <p className="mt-2 max-w-md text-[11px] text-muted-foreground">
            We'll scan every sheet, find the header row (Selector / Activity / Qty / Unit Price / RCV…), and extract every line item.
          </p>
          {pricingType === "retail" && (
            <p className="mt-3 max-w-md text-[11px] text-muted-foreground">
              Retail uploads can include cost columns (material, labor, equipment, misc, overhead %).
              Re-upload the same items with different cost columns to merge by code.
            </p>
          )}
        </div>
        {error && (
          <div
            className="flex items-start gap-2 rounded-md border p-3 text-xs"
            style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  const isPdf = value.source === "pdf";

  // Need code + name + at least one of (unit_price | line_total | cost components)
  const hasCode = value.mapping.includes("code");
  const hasName = value.mapping.includes("name");
  const hasPriceish =
    value.mapping.includes("unit_price") ||
    value.mapping.includes("line_total") ||
    value.mapping.includes("material_cost") ||
    value.mapping.includes("labor_cost") ||
    value.mapping.includes("equipment_cost");
  const missing: string[] = [];
  if (!hasCode) missing.push("code/selector");
  if (!hasName) missing.push("description/activity");
  if (!hasPriceish) missing.push("a price column (unit price, line total / RCV, or cost components)");

  const previewRows = value.rows.slice(0, 5);

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-3 rounded-md border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <FileSpreadsheet className="h-5 w-5 text-[var(--brand)]" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{value.file.name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono-num">{value.rows.length.toLocaleString()}</span> rows · {value.headers.length} columns
            {value.sheetName ? ` · sheet: ${value.sheetName}` : ""}
            {pricingType === "retail" && " · retail cost-build mode"}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground">
          Replace
        </button>
      </div>

      {isPdf ? (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--success, #10b981)", color: "var(--success, #10b981)" }}
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            ✓ AI extracted <strong>{value.rows.length}</strong> line items from your PDF estimate. Click <strong>Next</strong> to review.
          </span>
        </div>
      ) : missing.length === 0 ? (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--success, #10b981)", color: "var(--success, #10b981)" }}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            ✓ Detected <strong>{value.rows.length}</strong> rows with all required columns mapped. Click <strong>Next</strong> to review.
          </span>
        </div>
      ) : null}

      {missing.length > 0 && (
        <div className="rounded-md border p-3 text-xs" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
          Map columns for: <strong>{missing.join(", ")}</strong> before continuing. (If you have <em>Qty</em> + <em>Total/RCV</em> but no unit price, that works too — we'll derive it.)
        </div>
      )}

      <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead style={{ backgroundColor: "var(--bg-card)" }}>
            <tr>
              {value.headers.map((h, i) => (
                <th key={i} className="border-b px-3 py-2 text-left" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{h}</div>
                  <select
                    value={value.mapping[i]}
                    onChange={(e) => updateMapping(i, e.target.value as ColumnRole)}
                    className="mt-1 h-7 w-full rounded border bg-[var(--bg-elevated)] px-1 text-[11px] text-foreground"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {roleOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                {value.headers.map((h, j) => (
                  <td key={j} className="px-3 py-1.5 text-muted-foreground">{String(r[h] ?? "—").slice(0, 40)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
