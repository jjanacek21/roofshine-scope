import { useState } from "react";
import { JURISDICTION_OPTIONS } from "@/lib/xactimate-parser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

export interface MetadataValue {
  name: string;
  jurisdiction: string;
  zip_codes: string[];
  effective_month: string; // YYYY-MM-01
  notes: string;
  pricing_type: "insurance" | "retail";
}

interface Props {
  value: MetadataValue;
  onChange: (v: MetadataValue) => void;
}

export function MetadataStep({ value, onChange }: Props) {
  const [zipInput, setZipInput] = useState("");

  function addZip() {
    const z = zipInput.trim();
    if (/^\d{5}$/.test(z) && !value.zip_codes.includes(z)) {
      onChange({ ...value, zip_codes: [...value.zip_codes, z] });
    }
    setZipInput("");
  }

  function removeZip(z: string) {
    onChange({ ...value, zip_codes: value.zip_codes.filter((x) => x !== z) });
  }

  function updateAuto(jur: string, month: string) {
    const dateLabel = month
      ? new Date(month + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "";
    if (jur && dateLabel && (!value.name || /^.+ — .+$/.test(value.name))) {
      onChange({ ...value, jurisdiction: jur, effective_month: month, name: `${jur} — ${dateLabel}` });
    } else {
      onChange({ ...value, jurisdiction: jur, effective_month: month });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Pricing Type</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["insurance", "retail"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...value, pricing_type: t })}
              className={`h-10 rounded-md border text-sm font-semibold capitalize transition ${
                value.pricing_type === t
                  ? "bg-[var(--brand)] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Insurance pricing is used for claim estimates. Retail is used for cash quotes.
        </p>
      </div>
      <div>
        <Label>Name</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Miami-Dade — Apr 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Jurisdiction <span className="text-muted-foreground">(optional)</span></Label>
          <select
            value={value.jurisdiction}
            onChange={(e) => updateAuto(e.target.value, value.effective_month)}
            className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">Select…</option>
            {JURISDICTION_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Effective Month <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            type="month"
            value={value.effective_month ? value.effective_month.slice(0, 7) : ""}
            onChange={(e) => updateAuto(value.jurisdiction, e.target.value ? `${e.target.value}-01` : "")}
          />
        </div>
      </div>
      <div>
        <Label>Zip Codes</Label>
        <div className="flex gap-2">
          <Input
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addZip();
              }
            }}
            placeholder="33101"
          />
          <button type="button" onClick={addZip} className="btn-brand h-10 rounded-md px-4 text-sm font-semibold">
            Add
          </button>
        </div>
        {value.zip_codes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.zip_codes.map((z) => (
              <span
                key={z}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono-num text-xs text-foreground"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                {z}
                <button type="button" onClick={() => removeZip(z)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
