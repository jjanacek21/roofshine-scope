import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, FileDown, Mail, Loader2, Check, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useLeads } from "@/hooks/useLeads";
import { fmtMoney, fmtNum, type LeadRow } from "@/lib/leads";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { supabase } from "@/integrations/supabase/client";
import { analyzeRoofWithAI } from "@/server/lead-ai.functions";
import { useCompany } from "@/hooks/useCompany";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { RK_BRAND } from "@/lib/roofking/brand";

export const Route = createFileRoute("/_app/leads/savings")({
  validateSearch: (search: Record<string, unknown>) => ({
    leadId: typeof search.leadId === "string" ? search.leadId : undefined,
  }),
  component: SavingsReport,
});

// Pricing constants from spec
const TEAROFF_COSTS: Record<string, number> = { bur: 22, tpo: 18, epdm: 17, modified: 20, metal: 25, shingle: 16 };
const SPF_COSTS: Record<string, number> = { bur: 12, tpo: 10, epdm: 9.5, modified: 11, metal: 13, shingle: 8 };
const MAINT_COSTS: Record<string, number> = { bur: 0.35, tpo: 0.25, epdm: 0.30, modified: 0.30, metal: 0.20, shingle: 0.40 };
const ROOF_TYPE_OPTIONS = [
  { value: "bur", label: "BUR (Built-Up)" },
  { value: "tpo", label: "TPO" },
  { value: "epdm", label: "EPDM" },
  { value: "modified", label: "Modified Bitumen" },
  { value: "metal", label: "Metal" },
  { value: "shingle", label: "Shingle" },
];

function normalizeRoofType(roofType: string | null | undefined): string {
  const k = (roofType ?? "").toLowerCase();
  if (k.includes("bur") || k.includes("built")) return "bur";
  if (k.includes("tpo")) return "tpo";
  if (k.includes("epdm") || k.includes("rubber")) return "epdm";
  if (k.includes("mod")) return "modified";
  if (k.includes("metal") || k.includes("standing") || k.includes("r-panel")) return "metal";
  if (k.includes("shingle")) return "shingle";
  return "modified";
}

function fmtRange(low: number, high: number) {
  return `${fmtMoney(Math.round(low))}–${fmtMoney(Math.round(high))}`;
}

function SavingsReport() {
  const { leadId: searchLeadId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: leads = [] } = useLeads();
  const { data: mapboxToken } = useMapboxToken();
  const { data: company } = useCompany();
  const { isRoofKing } = useIsRoofKing();
  const brandName = isRoofKing ? RK_BRAND.name.toUpperCase() : (company?.name?.toUpperCase() || "LEAD CENTER");
  const brandLogoUrl = isRoofKing ? RK_BRAND.logoUrl : company?.logo_url;
  const brandPhone = isRoofKing ? RK_BRAND.phone : company?.phone;
  const brandAddressLine = isRoofKing ? `${RK_BRAND.address}, ${RK_BRAND.cityStateZip}` : null;
  const reportRef = useRef<HTMLDivElement>(null);


  const qc = useQueryClient();
  const analyze = useServerFn(analyzeRoofWithAI);

  const [leadId, setLeadId] = useState<string>(searchLeadId ?? "");
  const [sqft, setSqft] = useState<number>(12500);
  const [roofType, setRoofType] = useState<string>("modified");
  const [roofAge, setRoofAge] = useState<number>(18);
  const [address, setAddress] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [liveAnalysis, setLiveAnalysis] = useState<{ analysis: string; observations: string[]; generatedAt: string | null } | null>(null);

  const lead = useMemo<LeadRow | null>(
    () => leads.find((l) => l.id === leadId) ?? null,
    [leads, leadId],
  );

  // Sync URL search param if user picks a different lead
  useEffect(() => {
    if (searchLeadId && searchLeadId !== leadId) setLeadId(searchLeadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLeadId]);

  // Pre-fill from lead when one is selected
  useEffect(() => {
    if (!lead) return;
    setLiveAnalysis(null);
    if (lead.sqft) setSqft(lead.sqft);
    setRoofType(normalizeRoofType(lead.roof_type));
    if (lead.year_built) {
      const yr = parseInt(lead.year_built, 10);
      if (Number.isFinite(yr) && yr > 1900) setRoofAge(new Date().getFullYear() - yr);
    }
    const addrParts = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean);
    setAddress(addrParts.join(", "));
  }, [lead]);

  function applyLead(id: string) {
    setLeadId(id);
    navigate({ to: "/leads/savings", search: { leadId: id || undefined } });
  }

  // ---- Calculations ----
  const tearoffPsf = TEAROFF_COSTS[roofType];
  const spfPsf = SPF_COSTS[roofType];
  const maintPsf = MAINT_COSTS[roofType];

  const tearoffCost = sqft * tearoffPsf;
  const sprayFoamCost = sqft * spfPsf;
  const annualMaintenance = sqft * maintPsf;

  const energyPerSqftPerYear = 0.625;
  const energyYear1 = Math.round(sqft * energyPerSqftPerYear);
  const energy10yr = energyYear1 * 10;
  const energy20yr = energyYear1 * 20;

  const currentMaintPerYear = sqft * maintPsf;
  const spfMaintPerYear = sqft * 0.10;
  const maintYear1 = Math.round(currentMaintPerYear - spfMaintPerYear);
  const maint10yr = maintYear1 * 10;
  const maint20yr = maintYear1 * 20;

  const section179 = Math.round(sprayFoamCost);
  const section179d = Math.round(sqft * 5);

  const totalYear1 = energyYear1 + maintYear1 + section179 + section179d;
  const total10yr = energy10yr + maint10yr + section179 + section179d;
  const total20yr = energy20yr + maint20yr + section179 + section179d;

  const netCostRaw = sprayFoamCost * 0.63 - section179d;
  const netCost = Math.max(0, Math.round(netCostRaw));
  const paybackDenom = energyYear1 + maintYear1;
  const paybackYears = paybackDenom > 0 ? (netCost / paybackDenom).toFixed(1) : "—";

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Mapbox static satellite image
  const satelliteUrl = lead?.lat != null && lead?.lng != null && mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lead.lng},${lead.lat},19,0/600x400@2x?access_token=${mapboxToken}`
    : null;

  // Extract observations from AI report — robust parser
  const aiReport = (lead?.ai_report ?? {}) as { analysis?: string; roof_observations?: string[]; analysis_generated_at?: string };
  const aiAnalysisRaw = liveAnalysis?.analysis ?? aiReport.analysis ?? "";
  const aiGeneratedAt = liveAnalysis?.generatedAt ?? aiReport.analysis_generated_at ?? null;
  const aiObservations: string[] = (() => {
    if (liveAnalysis?.observations.length) return liveAnalysis.observations;
    if (Array.isArray(aiReport.roof_observations) && aiReport.roof_observations.length > 0) return aiReport.roof_observations;
    if (!aiAnalysisRaw) return [];
    const lines = aiAnalysisRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const bullets = lines
      .filter((l) => /^([-•*]|\d+[.)])\s+/.test(l))
      .map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, "").trim())
      .filter((l) => l.length > 4);
    if (bullets.length >= 2) return bullets.slice(0, 10);
    // Fallback: split into sentences
    const sentences = aiAnalysisRaw
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);
    return sentences.slice(0, 8);
  })();


  async function exportPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    const node = reportRef.current;
    node.classList.add("is-exporting");
    const rect = node.getBoundingClientRect();
    const exportWidth = Math.ceil(rect.width);
    const exportHeight = Math.ceil(node.scrollHeight);
    const prevWidth = node.style.width;
    const prevMaxWidth = node.style.maxWidth;
    const prevMinWidth = node.style.minWidth;
    const prevHeight = node.style.height;
    node.style.width = `${exportWidth}px`;
    node.style.maxWidth = `${exportWidth}px`;
    node.style.minWidth = `${exportWidth}px`;
    node.style.height = `${exportHeight}px`;
    try {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(node.querySelectorAll("img")).map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return img.decode?.().catch(() => undefined) ?? Promise.resolve();
        }),
      );
      const safeAddr = (address || "savings-report").replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        width: exportWidth,
        height: exportHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
      const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pageW - margin * 2;
      const pageContentH = pageH - margin * 2;
      const sliceHeight = Math.floor((pageContentH * canvas.width) / imgW);
      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < canvas.height) {
        const currentSliceHeight = Math.min(sliceHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSliceHeight;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("Could not prepare PDF page");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, sourceY, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

        if (pageIndex > 0) pdf.addPage();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageW, pageH, "F");
        const imgH = (currentSliceHeight * imgW) / canvas.width;
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
        sourceY += currentSliceHeight;
        pageIndex += 1;
      }
      const safeBrand = (company?.name || "Savings").replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
      pdf.save(`${safeBrand}_Savings_Report_${safeAddr}.pdf`);
      if (lead?.id && lead?.company_id) {
        await supabase.from("leads").update({ status: "report_sent" }).eq("id", lead.id);
        await supabase.from("lead_activities").insert({
          lead_id: lead.id,
          type: "report_sent",
          note: `email → owner`,
        });
      }
      toast.success("PDF downloaded · lead moved to Follow-Up");
    } catch (e) {
      console.error("PDF export failed:", e);
      toast.error(e instanceof Error ? e.message : "Failed to export PDF");
    } finally {
      node.style.width = prevWidth;
      node.style.maxWidth = prevMaxWidth;
      node.style.minWidth = prevMinWidth;
      node.style.height = prevHeight;
      node.classList.remove("is-exporting");
      setExporting(false);
    }
  }

  async function runAIAnalysis() {
    if (!lead) { toast.error("Pick a lead first"); return; }
    if (lead.lat == null || lead.lng == null) { toast.error("Lead has no coordinates"); return; }
    setAnalyzing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const result = (await analyze({
        data: {
          lat: lead.lat,
          lng: lead.lng,
          address: address || lead.address,
          pinCount: 1,
          leadId: lead.id,
        },
        headers: { Authorization: `Bearer ${token}` },
      })) as { analysis: string; roof_observations: string[]; analysis_generated_at: string | null };
      setLiveAnalysis({
        analysis: result.analysis,
        observations: result.roof_observations,
        generatedAt: result.analysis_generated_at,
      });
      qc.setQueryData<LeadRow[]>(["leads"], (current) => current?.map((item) => item.id === lead.id ? {
        ...item,
        ai_report: {
          ...(item.ai_report ?? {}),
          analysis: result.analysis,
          roof_observations: result.roof_observations,
          analysis_generated_at: result.analysis_generated_at,
          lat: lead.lat,
          lng: lead.lng,
        },
      } : item));
      await Promise.all([
        qc.refetchQueries({ queryKey: ["leads"] }),
        qc.refetchQueries({ queryKey: ["lead", lead.id] }),
      ]);
      toast.success("AI analysis complete — observations updated");
    } catch (e) {
      console.error("AI analysis failed:", e);
      let msg = e instanceof Error ? e.message : "Failed to analyze";
      if (e instanceof Response) {
        msg = (await e.text().catch(() => "")) || `Server error ${e.status}`;
      }
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sticky input bar */}
      <div className="sticky top-0 z-10 -mx-4 border-b bg-slate-900 p-4 sm:mx-0 sm:rounded-xl" style={{ borderColor: "rgb(51 65 85)" }}>
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">Savings Report Builder</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pre-fill from lead</label>
            <select value={leadId} onChange={(e) => applyLead(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
              <option value="">— Manual entry —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.address}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Square Footage</label>
            <input type="number" value={sqft} onChange={(e) => setSqft(parseInt(e.target.value) || 0)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono-num text-sm text-white" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Existing Roof Type</label>
            <select value={roofType} onChange={(e) => setRoofType(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
              {ROOF_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Roof Age (yrs)</label>
            <input type="number" value={roofAge} onChange={(e) => setRoofAge(parseInt(e.target.value) || 0)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono-num text-sm text-white" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => toast.info("Email-to-owner draft coming soon")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700"
          >
            <Mail className="h-3.5 w-3.5" /> Send to Owner
          </button>
          <button
            type="button"
            onClick={exportPDF}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            {exporting ? "Generating…" : "Export as PDF"}
          </button>
        </div>
      </div>

      {/* The report */}
      <div className="mx-auto max-w-4xl">
        <div ref={reportRef} id="savings-report-content" className="space-y-6 rounded-xl bg-white p-6 text-slate-900 shadow-xl print:shadow-none">
          {/* Brand header */}
          <div className="-mx-6 -mt-6 mb-0">
            <div className="flex items-center gap-3 bg-slate-900 px-6 py-5">
              {company?.logo_url && (
                <img
                  src={company.logo_url}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                  crossOrigin="anonymous"
                />
              )}
              <div>
                <div className="text-2xl font-bold uppercase tracking-wider text-white">{brandName}</div>
                <div className="text-xs uppercase tracking-widest text-slate-300">Commercial Roofing Solutions</div>
              </div>
            </div>
            <div className="h-1 bg-emerald-500" />
            <div className="px-6 py-4 text-center">
              <h1 className="text-lg font-semibold text-slate-900">Commercial Roof Restoration — Savings Report</h1>
            </div>
          </div>

          {/* Section 1 — Property Info */}
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {["Property", "Tenant/Owner", "Roof Size", "Type", "Est. Age", "Report Date"].map((h) => (
                    <th key={h} className="border-r border-slate-300 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="border-r border-slate-300 px-3 py-2 text-slate-900">{address || "—"}</td>
                  <td className="border-r border-slate-300 px-3 py-2 text-slate-900">{lead?.owner ?? "N/A"}</td>
                  <td className="border-r border-slate-300 px-3 py-2 font-mono-num text-slate-900">{fmtNum(sqft)} SF</td>
                  <td className="border-r border-slate-300 px-3 py-2 text-slate-900">{ROOF_TYPE_OPTIONS.find((o) => o.value === roofType)?.label}</td>
                  <td className="border-r border-slate-300 px-3 py-2 font-mono-num text-slate-900">{roofAge} yrs</td>
                  <td className="px-3 py-2 text-slate-900">{today}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2 — Satellite + Scope */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              {satelliteUrl ? (
                <>
                  <img src={satelliteUrl} alt="Satellite view of property" className="aspect-[3/2] w-full rounded-lg object-cover" crossOrigin="anonymous" />
                  <div className="mt-2 text-xs text-slate-500">Building 1 ({fmtNum(sqft)} SF)</div>
                </>
              ) : (
                <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                  {lead && (lead.lat == null || lead.lng == null)
                    ? "Lead has no coordinates yet — open the lead details to geocode it."
                    : "Pick a lead with coordinates to show satellite imagery."}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-5">
                <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-900">SCOPE OF WORK</h3>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {[
                    "Pressure wash & clean surface",
                    "Repair blisters, cracks, deterioration",
                    "Apply SPF recovery system",
                    "Apply silicone seamless top coat",
                    "Flash penetrations, curbs, HVAC, drains",
                    "Seal parapet walls & edge details",
                    "Install new termination bars",
                  ].map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50 p-5">
                <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-900">RESTORATION SYSTEM</h3>
                <ul className="space-y-2 text-sm text-slate-700 list-none">
                  {[
                    { n: 1, label: "High-Solids Silicone Top Coat", color: "bg-emerald-600" },
                    { n: 2, label: "Spray Polyurethane Foam (SPF)", color: "bg-blue-600" },
                    { n: 3, label: "Substrate Prep & Repairs", color: "bg-slate-600" },
                  ].map((s) => (
                    <li key={s.n} className="flex items-center gap-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${s.color}`}>{s.n}</span>
                      <span>{s.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-xs italic text-slate-500">
                  Your existing {ROOF_TYPE_OPTIONS.find((o) => o.value === roofType)?.label} roof
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 — Roof Observations */}
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-slate-300 pb-2">
              <h3 className="text-sm font-bold tracking-wider text-slate-900">ROOF OBSERVATIONS</h3>
              <div className="flex items-center gap-3">
                {aiGeneratedAt && (
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Generated {new Date(aiGeneratedAt).toLocaleDateString()}
                  </span>
                )}
                {aiAnalysisRaw && (
                  <button
                    type="button"
                    onClick={runAIAnalysis}
                    disabled={analyzing || !lead}
                    className="no-print inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Re-run
                  </button>
                )}
              </div>
            </div>
            {aiObservations.length > 0 ? (
              <ul className="space-y-1.5">
                {aiObservations.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            ) : aiAnalysisRaw ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">{aiAnalysisRaw}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">No AI analysis yet. Run AI vision on the satellite image to generate roof observations.</p>
                <button
                  type="button"
                  onClick={runAIAnalysis}
                  disabled={analyzing || !lead}
                  className="no-print inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {analyzing ? "Analyzing…" : "Run AI Analysis"}
                </button>
              </div>
            )}
          </div>

          {/* Section 4 — Benefits */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-900">BENEFITS</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "Stops all leaks permanently",
                "Drops energy bills 20–35%",
                "Eliminates thermal bridging",
                "Hurricane-rated wind uplift",
                "15–20 year renewable warranty",
                "Zero business disruption",
              ].map((b) => (
                <div key={b} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5 — Three-option cost comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-red-300 bg-red-50 p-4">
              <div className="text-xs font-semibold uppercase text-red-700">Full Replacement</div>
              <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900">{fmtRange(tearoffCost * 0.85, tearoffCost * 1.28)}</div>
              <div className="mt-1 text-xs text-slate-600">Tear-off, weeks of disruption</div>
            </div>
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase text-amber-700">Keep Patching</div>
              <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900">{fmtRange(annualMaintenance * 0.7, annualMaintenance * 1.35)}/yr</div>
              <div className="mt-1 text-xs text-slate-600">Band-aids on a failing roof</div>
            </div>
            <div className="relative rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase text-white">Best Value</span>
              <div className="text-xs font-semibold uppercase text-emerald-700">SPF Restoration ✓</div>
              <div className="mt-2 font-mono-num text-2xl font-bold text-emerald-700">{fmtMoney(Math.round(sprayFoamCost))}</div>
              <div className="mt-1 text-xs text-slate-600">Seamless, 20-yr warranty</div>
            </div>
          </div>

          {/* Section 6 — ROI Table */}
          <div className="overflow-hidden rounded-lg border border-slate-300">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {["Benefit", "Year 1", "10-Year", "20-Year"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono-num">
                {[
                  { label: "Energy Savings", y1: energyYear1, y10: energy10yr, y20: energy20yr },
                  { label: "Maintenance Savings", y1: maintYear1, y10: maint10yr, y20: maint20yr },
                  { label: "Section 179 (100%)", y1: section179, y10: section179, y20: section179 },
                  { label: "Section 179D ($5/SF)", y1: section179d, y10: section179d, y20: section179d },
                ].map((r) => (
                  <tr key={r.label} className="border-b border-slate-200 bg-white">
                    <td className="px-3 py-2 font-sans text-slate-700">{r.label}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{fmtMoney(r.y1)}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{fmtMoney(r.y10)}</td>
                    <td className="px-3 py-2 text-right text-slate-900">{fmtMoney(r.y20)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-emerald-500 bg-emerald-50">
                  <td className="px-3 py-2 font-sans font-bold text-slate-900">Total Savings</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtMoney(totalYear1)}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtMoney(total10yr)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmtMoney(total20yr)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 7 — Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Section 179" value="100%" sub="Full project Year 1" tone="dark" />
            <StatCard label="Section 179D" value="$5/SF" sub="Energy deduction" tone="dark" />
            <StatCard label="Net Cost After Tax" value={fmtMoney(netCost)} sub="Out-of-pocket" tone="green" />
            <StatCard label="Payback" value={`${paybackYears} yr`} sub="Energy + maint savings" tone="green" />
          </div>

          {/* Section 8 — Urgency banner */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-red-600 py-3 text-center text-sm font-semibold text-white">
            <AlertTriangle className="h-4 w-4" />
            Section 179 expires June 30, 2026 — Act now
          </div>

          {/* Section 9 — Footer */}
          <div className="mt-4 flex flex-col items-start justify-between gap-2 border-t border-slate-300 pt-4 sm:flex-row">
            <div>
              <div className="text-sm font-bold text-slate-900">{brandName}</div>
              <div className="text-xs text-slate-600">
                {[company?.phone, company?.email, company?.website].filter(Boolean).join(" · ") ||
                  "Schedule a free roof assessment"}
              </div>
            </div>
            <div className="text-xs italic text-slate-500">* Estimates for illustration only. Consult your tax advisor.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "dark" | "green" }) {
  const isGreen = tone === "green";
  return (
    <div
      className={`rounded-xl border p-4 ${isGreen ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-slate-50"}`}
    >
      <div className="text-xs uppercase tracking-wider text-slate-600">{label}</div>
      <div className={`mt-1 font-mono-num text-2xl font-bold ${isGreen ? "text-emerald-700" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
