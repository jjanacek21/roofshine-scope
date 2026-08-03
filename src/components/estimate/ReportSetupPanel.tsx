import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { CoverMeta } from "@/components/estimate/XactimateReport";
import type { ReportNote } from "@/lib/xact-report";

const FIELDS: { key: keyof CoverMeta; label: string; wide?: boolean }[] = [
  { key: "estimateName", label: "Estimate name" },
  { key: "coverageLabel", label: "Coverage" },
  { key: "insuredName", label: "Insured" },
  { key: "insuredPhone", label: "Insured phone" },
  { key: "insuredEmail", label: "Insured e-mail" },
  { key: "homeAddress", label: "Home address", wide: true },
  { key: "propertyAddress", label: "Property address", wide: true },
  { key: "claimRepName", label: "Claim rep." },
  { key: "claimRepCompany", label: "Claim rep. company" },
  { key: "claimRepPhone", label: "Claim rep. phone" },
  { key: "claimRepEmail", label: "Claim rep. e-mail" },
  { key: "referenceName", label: "Reference" },
  { key: "referenceCompany", label: "Reference company" },
  { key: "referencePhone", label: "Reference phone" },
  { key: "referenceEmail", label: "Reference e-mail" },
  { key: "claimNumber", label: "Claim number" },
  { key: "policyNumber", label: "Policy number" },
  { key: "typeOfLoss", label: "Type of loss" },
  { key: "dateContacted", label: "Date contacted" },
  { key: "dateOfLoss", label: "Date of loss" },
  { key: "dateInspected", label: "Date inspected" },
  { key: "dateReceived", label: "Date received" },
  { key: "dateEntered", label: "Date entered" },
  { key: "dateCompleted", label: "Date est. completed" },
  { key: "priceListCode", label: "Price list code" },
  { key: "priceListDescription", label: "Price list description", wide: true },
];

export function ReportSetupPanel({
  meta,
  onMetaChange,
  deductible,
  onDeductibleChange,
  notes,
  onNotesChange,
}: {
  meta: CoverMeta;
  onMetaChange: (patch: Partial<CoverMeta>) => void;
  deductible: number;
  onDeductibleChange: (v: number) => void;
  notes: ReportNote[];
  onNotesChange: (next: ReportNote[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold"
      >
        Report details, deductible & notes
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t px-4 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Deductible
              </span>
              <input
                type="number"
                step="0.01"
                value={deductible}
                onChange={(e) => onDeductibleChange(Number(e.target.value) || 0)}
                className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-[13px] outline-none"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
            {FIELDS.map((f) => (
              <label key={f.key} className={`space-y-1 ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </span>
                <input
                  value={(meta[f.key] as string) ?? ""}
                  onChange={(e) => onMetaChange({ [f.key]: e.target.value } as Partial<CoverMeta>)}
                  className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-[13px] outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider">Notes</span>
              <button
                onClick={() =>
                  onNotesChange([
                    ...notes,
                    { id: crypto.randomUUID(), title: "", body: "" },
                  ])
                }
                className="btn-ghost flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add note
              </button>
            </div>
            {notes.length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                Notes print on their own page at the end of the report.
              </p>
            )}
            {notes.map((n, idx) => (
              <div
                key={n.id}
                className="space-y-2 rounded-lg border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={n.title}
                    placeholder={`Note ${idx + 1} title`}
                    onChange={(e) =>
                      onNotesChange(
                        notes.map((x) => (x.id === n.id ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    className="flex-1 bg-transparent text-[13px] font-semibold outline-none"
                  />
                  <button
                    onClick={() => onNotesChange(notes.filter((x) => x.id !== n.id))}
                    className="rounded-md p-1 text-muted-foreground hover:text-[var(--danger)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  value={n.body}
                  placeholder="Note text"
                  rows={3}
                  onChange={(e) =>
                    onNotesChange(
                      notes.map((x) => (x.id === n.id ? { ...x, body: e.target.value } : x)),
                    )
                  }
                  className="w-full resize-y bg-transparent text-[13px] outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
