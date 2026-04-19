import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Sparkles, AlertCircle } from "lucide-react";
import { autoMapHeader, type ColumnRole } from "@/lib/xactimate-parser";

const BASE_ROLES: { value: ColumnRole; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "code", label: "Code" },
  { value: "name", label: "Name/Description" },
  { value: "unit", label: "Unit" },
  { value: "unit_price", label: "Unit Price" },
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
            setError(data?.error ?? "Failed to parse PDF");
            return;
          }
          const headers: string[] = data.headers ?? ["Code", "Description", "Unit", "Unit Price", "Category"];
          const rows: Record<string, unknown>[] = data.rows ?? [];
          const mapping = headers.map((h) => autoMapHeader(h));
          onChange({ file, headers, rows, mapping });
        } else {
          setParseStage("spreadsheet");
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
          const headers = json.length > 0 ? Object.keys(json[0]) : [];
          const mapping = headers.map((h) => autoMapHeader(h));
          onChange({ file, headers, rows: json, mapping });
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
                ? "Parsing…"
                : isDragActive
                  ? "Drop the file here"
                  : "Drag & drop or click to upload"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls, .csv, .pdf</p>
          <p className="mt-2 max-w-md text-[11px] text-muted-foreground">
            PDFs are auto-parsed with AI. Spreadsheets let you map columns manually.
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

  const isPdf = value.file.type === "application/pdf" || value.file.name.toLowerCase().endsWith(".pdf");

  const requiredRoles: ColumnRole[] = ["code", "name", "unit_price"];
  const missing = requiredRoles.filter((r) => !value.mapping.includes(r));
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
            {pricingType === "retail" && " · retail cost-build mode"}
          </p>
        </div>
        <button onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground">
          Replace
        </button>
      </div>

      {isPdf && (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-xs"
          style={{ borderColor: "var(--success, #10b981)", color: "var(--success, #10b981)" }}
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            ✓ AI extracted <strong>{value.rows.length}</strong> line items. Click <strong>Next</strong> to review &amp; confirm.
          </span>
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-md border p-3 text-xs" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
          Map columns for: <strong>{missing.join(", ")}</strong> before continuing.
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
