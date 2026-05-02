import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Calculator, FileDown, Building2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { useLeads } from "@/hooks/useLeads";
import { fmtMoney, fmtNum } from "@/lib/leads";

export const Route = createFileRoute("/_app/leads/savings")({
  component: SavingsReport,
});

interface Inputs {
  sqft: number;
  restorePsf: number;
  replacePsf: number;
  energySavingsPctPerYear: number; // % vs replace baseline ops cost
  baselineOpsPerSqftPerYear: number; // typical maintenance per sqft per year
  recoatYear: number; // when SPF needs re-coat
  recoatPsf: number;
  years: number;
  inflation: number;
}

const DEFAULTS: Inputs = {
  sqft: 30000,
  restorePsf: 5.5,
  replacePsf: 11.5,
  energySavingsPctPerYear: 18,
  baselineOpsPerSqftPerYear: 0.45,
  recoatYear: 10,
  recoatPsf: 2.25,
  years: 20,
  inflation: 3,
};

interface YearRow {
  year: number;
  restoreCum: number;
  replaceCum: number;
  savings: number;
}

function project(inputs: Inputs): YearRow[] {
  const restoreUpfront = inputs.sqft * inputs.restorePsf;
  const replaceUpfront = inputs.sqft * inputs.replacePsf;
  const baselineOps = inputs.sqft * inputs.baselineOpsPerSqftPerYear;
  const energyMultiplier = 1 - inputs.energySavingsPctPerYear / 100;
  const infl = 1 + inputs.inflation / 100;

  const rows: YearRow[] = [];
  let restoreCum = restoreUpfront;
  let replaceCum = replaceUpfront;
  for (let y = 1; y <= inputs.years; y++) {
    const inflate = Math.pow(infl, y - 1);
    const replaceOps = baselineOps * inflate;
    const restoreOps = baselineOps * inflate * energyMultiplier;
    replaceCum += replaceOps;
    restoreCum += restoreOps;
    if (y === inputs.recoatYear) {
      restoreCum += inputs.sqft * inputs.recoatPsf * inflate;
    }
    rows.push({
      year: y,
      restoreCum: Math.round(restoreCum),
      replaceCum: Math.round(replaceCum),
      savings: Math.round(replaceCum - restoreCum),
    });
  }
  return rows;
}

function SavingsReport() {
  const { data: leads = [] } = useLeads();
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [leadId, setLeadId] = useState<string>("");
  const reportRef = useRef<HTMLDivElement>(null);

  const lead = useMemo(() => leads.find((l) => l.id === leadId) ?? null, [leads, leadId]);

  function applyLead(id: string) {
    setLeadId(id);
    const l = leads.find((x) => x.id === id);
    if (l?.sqft) setInputs((prev) => ({ ...prev, sqft: l.sqft! }));
  }

  const rows = useMemo(() => project(inputs), [inputs]);
  const final = rows[rows.length - 1];
  const restoreUpfront = inputs.sqft * inputs.restorePsf;
  const replaceUpfront = inputs.sqft * inputs.replacePsf;
  const upfrontSavings = replaceUpfront - restoreUpfront;
  const totalSavings = final?.savings ?? 0;
  const roiPct = restoreUpfront > 0 ? (totalSavings / restoreUpfront) * 100 : 0;

  function exportPDF() {
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = doc.internal.pageSize.getWidth();
      let y = 56;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("SPF Restoration Savings Report", 56, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(110);
      doc.text(`Generated ${new Date().toLocaleDateString()}`, 56, y);
      y += 24;

      if (lead) {
        doc.setTextColor(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("Property", 56, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(lead.address, 56, y);
        y += 14;
        doc.text(`${lead.city ?? ""}, ${lead.state ?? ""} ${lead.zip ?? ""}`, 56, y);
        y += 14;
        if (lead.owner) {
          doc.text(`Owner: ${lead.owner}`, 56, y);
          y += 14;
        }
        y += 10;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Inputs", 56, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const ipairs: [string, string][] = [
        ["Roof area", `${fmtNum(inputs.sqft)} sq ft`],
        ["Restoration cost", `${fmtMoney(inputs.restorePsf)} / sq ft`],
        ["Replacement cost", `${fmtMoney(inputs.replacePsf)} / sq ft`],
        ["Energy savings vs. replace", `${inputs.energySavingsPctPerYear}% / yr`],
        ["Baseline maintenance", `${fmtMoney(inputs.baselineOpsPerSqftPerYear)} / sqft / yr`],
        ["Re-coat at year", `${inputs.recoatYear} (${fmtMoney(inputs.recoatPsf)} / sqft)`],
        ["Horizon", `${inputs.years} years`],
        ["Inflation", `${inputs.inflation}% / yr`],
      ];
      ipairs.forEach(([k, v]) => {
        doc.text(k, 56, y);
        doc.text(v, 280, y);
        y += 14;
      });

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Headline numbers", 56, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const hpairs: [string, string][] = [
        ["Up-front savings (Day 1)", fmtMoney(upfrontSavings)],
        [`Total savings over ${inputs.years} years`, fmtMoney(totalSavings)],
        ["ROI on restoration", `${roiPct.toFixed(0)}%`],
      ];
      hpairs.forEach(([k, v]) => {
        doc.text(k, 56, y);
        doc.text(v, 280, y);
        y += 14;
      });

      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Year-by-year cumulative cost", 56, y);
      y += 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Year", 56, y);
      doc.text("Restore", 130, y);
      doc.text("Replace", 230, y);
      doc.text("Savings", 330, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      rows.forEach((r) => {
        if (y > 740) {
          doc.addPage();
          y = 56;
        }
        doc.text(String(r.year), 56, y);
        doc.text(fmtMoney(r.restoreCum), 130, y);
        doc.text(fmtMoney(r.replaceCum), 230, y);
        doc.text(fmtMoney(r.savings), 330, y);
        y += 12;
      });

      y += 20;
      if (y > 720) {
        doc.addPage();
        y = 56;
      }
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        "Estimates only. Actual results depend on roof condition, climate, energy rates, and selected system.",
        56,
        y,
        { maxWidth: W - 112 },
      );

      const safeName = (lead?.address ?? "savings-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      doc.save(`${safeName}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <Calculator className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Savings Report</h2>
          <p className="text-sm text-[var(--text-dim)]">
            20-year cost comparison: SPF restoration vs. tear-off + replace.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-3">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              <Building2 className="h-3.5 w-3.5" /> Pre-fill from lead
            </label>
            <select
              value={leadId}
              onChange={(e) => applyLead(e.target.value)}
              className="w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">— Manual entry —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.address}
                  {l.sqft ? ` (${fmtNum(l.sqft)} sf)` : ""}
                </option>
              ))}
            </select>
          </div>

          <NumberField
            label="Roof area (sq ft)"
            value={inputs.sqft}
            step={500}
            onChange={(v) => setInputs({ ...inputs, sqft: v })}
          />
          <NumberField
            label="Restore cost ($/sqft)"
            value={inputs.restorePsf}
            step={0.25}
            decimals={2}
            onChange={(v) => setInputs({ ...inputs, restorePsf: v })}
          />
          <NumberField
            label="Replace cost ($/sqft)"
            value={inputs.replacePsf}
            step={0.25}
            decimals={2}
            onChange={(v) => setInputs({ ...inputs, replacePsf: v })}
          />
          <NumberField
            label="Energy savings (% / yr)"
            value={inputs.energySavingsPctPerYear}
            step={1}
            onChange={(v) => setInputs({ ...inputs, energySavingsPctPerYear: v })}
          />
          <NumberField
            label="Baseline ops ($/sqft/yr)"
            value={inputs.baselineOpsPerSqftPerYear}
            step={0.05}
            decimals={2}
            onChange={(v) => setInputs({ ...inputs, baselineOpsPerSqftPerYear: v })}
          />
          <NumberField
            label="Re-coat year"
            value={inputs.recoatYear}
            step={1}
            onChange={(v) => setInputs({ ...inputs, recoatYear: Math.round(v) })}
          />
          <NumberField
            label="Re-coat ($/sqft)"
            value={inputs.recoatPsf}
            step={0.25}
            decimals={2}
            onChange={(v) => setInputs({ ...inputs, recoatPsf: v })}
          />
          <NumberField
            label="Horizon (years)"
            value={inputs.years}
            step={1}
            onChange={(v) => setInputs({ ...inputs, years: Math.max(1, Math.round(v)) })}
          />
          <NumberField
            label="Inflation (%/yr)"
            value={inputs.inflation}
            step={0.5}
            decimals={1}
            onChange={(v) => setInputs({ ...inputs, inflation: v })}
          />

          <button
            type="button"
            onClick={exportPDF}
            className="btn-brand mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold"
          >
            <FileDown className="h-4 w-4" /> Export PDF
          </button>
        </aside>

        <div ref={reportRef} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI label="Up-front savings" value={fmtMoney(upfrontSavings)} accent="var(--primary)" />
            <KPI
              label={`Total savings · ${inputs.years} yr`}
              value={fmtMoney(totalSavings)}
              accent="#22c55e"
            />
            <KPI label="ROI on restoration" value={`${roiPct.toFixed(0)}%`} accent="#a855f7" />
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Cumulative cost over {inputs.years} years
            </p>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={rows}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis dataKey="year" stroke="var(--text-dim)" fontSize={11} />
                  <YAxis
                    stroke="var(--text-dim)"
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    formatter={(v: number) => fmtMoney(v)}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="restoreCum" name="Restore" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="replaceCum" name="Replace" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Annual cumulative savings
            </p>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={rows}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis dataKey="year" stroke="var(--text-dim)" fontSize={11} />
                  <YAxis
                    stroke="var(--text-dim)"
                    fontSize={11}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    formatter={(v: number) => fmtMoney(v)}
                  />
                  <Bar dataKey="savings" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  step,
  decimals,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
        {label}
      </label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) {
            onChange(decimals != null ? Number(n.toFixed(decimals)) : n);
          }
        }}
        className="w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 font-mono-num text-sm"
        style={{ borderColor: "var(--border)" }}
      />
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-card)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="mt-1 font-mono-num text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
