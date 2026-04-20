import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { generateProposalPdf } from "@/lib/pdf-generator";
import { getTradeLabel } from "@/lib/trades";

export const Route = createFileRoute("/_app/jobs/$id/report")({
  component: JobReport,
});

type JobRow = {
  id: string;
  company_id: string;
  name: string;
  job_number: string | null;
  job_type: string | null;
  property_address: string | null;
  property_id: string | null;
  client_id: string | null;
  primary_trade: string | null;
};

function JobReport() {
  const { id: jobId } = Route.useParams();
  const { data: mapboxToken } = useMapboxToken();
  const [hidePricing, setHidePricing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data as JobRow | null;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["report-company", job?.company_id],
    enabled: !!job?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", job!.company_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["report-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", job!.client_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: property } = useQuery({
    queryKey: ["report-property", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("*")
        .eq("id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["report-estimates", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const primaryEstimate = estimates[0] ?? null;

  const { data: lineItems = [] } = useQuery({
    queryKey: ["report-items", primaryEstimate?.id],
    enabled: !!primaryEstimate,
    queryFn: async () => {
      const { data } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", primaryEstimate!.id)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["report-photos", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!photos.length) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos.slice(0, 8)) {
        const { data } = await supabase.storage
          .from("roof-photos")
          .createSignedUrl(p.storage_path, 3600);
        if (data?.signedUrl) map[p.id] = data.signedUrl;
      }
      setPhotoUrls(map);
    })();
  }, [photos]);

  const { data: measurement } = useQuery({
    queryKey: ["report-measurement", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_measurements")
        .select("*")
        .eq("property_id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: roofSections = [] } = useQuery({
    queryKey: ["report-roof-sections", measurement?.id],
    enabled: !!measurement?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_sections")
        .select("*")
        .eq("measurement_id", measurement!.id)
        .order("sort_order");
      return data ?? [];
    },
  });

  const damageRows = useMemo(() => {
    type Damage = { severity: string; finding: string; location: string };
    const rows: Damage[] = [];
    for (const p of photos) {
      const a = (p.ai_analysis ?? {}) as Record<string, unknown>;
      const sev = (a.severity as string) ?? null;
      const defects = (a.observed_defects as string[]) ?? [];
      const loc = (p.tag as string) ?? "—";
      for (const d of defects) {
        rows.push({ severity: sev ?? "minor", finding: d, location: loc });
      }
    }
    const order: Record<string, number> = { critical: 0, major: 1, moderate: 2, minor: 3, cosmetic: 4 };
    return rows.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  }, [photos]);

  const subtotal = lineItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const markup = (subtotal * Number(primaryEstimate?.markup_pct ?? 0)) / 100;
  const overhead = (subtotal * Number(primaryEstimate?.overhead_pct ?? 0)) / 100;
  const profit = (subtotal * Number(primaryEstimate?.profit_pct ?? 0)) / 100;
  const beforeTax = subtotal + markup + overhead + profit;
  const tax = (beforeTax * Number(primaryEstimate?.tax_pct ?? 0)) / 100;
  const grandTotal = beforeTax + tax;

  const itemsByTrade = useMemo(() => {
    const map = new Map<string, typeof lineItems>();
    for (const i of lineItems) {
      if (!map.has(i.trade)) map.set(i.trade, []);
      map.get(i.trade)!.push(i);
    }
    return Array.from(map.entries());
  }, [lineItems]);

  const staticMapUrl = useMemo(() => {
    if (!mapboxToken || !property?.lat || !property?.lng) return null;
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${property.lng},${property.lat},19,0/720x360@2x?access_token=${mapboxToken}`;
  }, [mapboxToken, property]);

  const handleGenerate = async () => {
    if (!previewRef.current || !job) return;
    setGenerating(true);
    const t = toast.loading("Generating PDF…");
    try {
      const { signedUrl } = await generateProposalPdf({
        rootEl: previewRef.current,
        jobId,
        estimateId: primaryEstimate?.id ?? null,
        companyId: job.company_id,
        hidePricing,
      });
      toast.dismiss(t);
      toast.success("Proposal PDF ready", {
        action: signedUrl
          ? { label: "Open", onClick: () => window.open(signedUrl, "_blank") }
          : undefined,
      });
    } catch (err) {
      console.error(err);
      toast.dismiss(t);
      toast.error("PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!job) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const heroPhotoUrl = Object.values(photoUrls)[0] ?? null;

  return (
    <div className="space-y-4">
      {measurement && Number(measurement.total_area_sqft ?? 0) > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Saved Measurements
              </div>
              <div className="mt-1 font-mono-num text-base font-semibold text-foreground">
                {Number(measurement.squares ?? 0).toFixed(1)} SQ ·{" "}
                {Number(measurement.total_area_sqft ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{" "}
                SF · {measurement.predominant_pitch ?? "—"} pitch
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {roofSections.length} section{roofSections.length === 1 ? "" : "s"} · Source:{" "}
                {String(measurement.source).replace(/_/g, " ")} · Updated{" "}
                {new Date(measurement.updated_at).toLocaleDateString()}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <MiniStat label="Eaves" value={Number(measurement.eaves_lf ?? 0).toFixed(0)} />
              <MiniStat label="Rakes" value={Number(measurement.rakes_lf ?? 0).toFixed(0)} />
              <MiniStat label="Ridges" value={Number(measurement.ridges_lf ?? 0).toFixed(0)} />
              <MiniStat label="Hips" value={Number(measurement.hips_lf ?? 0).toFixed(0)} />
              <MiniStat label="Valleys" value={Number(measurement.valleys_lf ?? 0).toFixed(0)} />
              <MiniStat label="Gutters" value={Number(measurement.gutters_lf ?? 0).toFixed(0)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Proposal preview</h2>
          <p className="text-[12px] text-muted-foreground">
            Live preview · 9 sections · {hidePricing ? "Pricing hidden" : "Pricing visible"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHidePricing((v) => !v)}
            className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
          >
            {hidePricing ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hidePricing ? "Show pricing" : "Hide pricing"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-brand flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Generate PDF
          </button>
        </div>
      </div>

      <div
        ref={previewRef}
        className="mx-auto space-y-6"
        style={{ maxWidth: 820 }}
      >
        {/* 1. COVER */}
        <Section>
          <div className="flex items-start justify-between">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-lg text-xl font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, #1e90ff, #0c5fb3)" }}
            >
              {company?.name?.[0] ?? "B"}
            </div>
            <div className="text-right font-mono-num text-[11px] text-neutral-500">
              <div>{job.job_number ?? "DRAFT"}</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-neutral-900">
            {job.job_type ?? "Construction"} Proposal
          </h1>
          <p className="mt-1 text-lg italic text-neutral-600" style={{ fontFamily: "var(--font-serif)" }}>
            Prepared for {client?.name ?? "Client"}
          </p>
          <div
            className="my-5 h-1.5 rounded-full"
            style={{ background: "linear-gradient(90deg, #000, #1e90ff)" }}
          />
          {heroPhotoUrl && (
            <img
              src={heroPhotoUrl}
              alt=""
              className="h-72 w-full rounded-xl object-cover"
              crossOrigin="anonymous"
            />
          )}
          <div className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Property
              </div>
              <div className="text-neutral-800">{job.property_address ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Scope
              </div>
              <div className="text-neutral-800">
                {measurement?.squares ? `${Number(measurement.squares).toFixed(1)} SQ · ` : ""}
                {job.primary_trade ? getTradeLabel(job.primary_trade) : "—"}
              </div>
            </div>
          </div>
        </Section>

        {/* 2. EXECUTIVE SUMMARY */}
        <Section>
          <H2>Executive Summary</H2>
          <p className="text-[13px] leading-relaxed text-neutral-700">
            {primaryEstimate?.notes ||
              `${company?.name ?? "Our team"} inspected the property at ${job.property_address ?? "the address on file"} on ${new Date().toLocaleDateString()}. Based on our findings, we recommend the scope of work outlined in this proposal.`}
          </p>
        </Section>

        {/* 3. DAMAGE SUMMARY */}
        <Section>
          <H2>Damage Summary</H2>
          {damageRows.length === 0 ? (
            <p className="text-[13px] text-neutral-500">
              No AI-analyzed damage findings yet. Analyze photos in the Photos tab to populate this section.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="border-b border-neutral-200 py-2">Severity</th>
                  <th className="border-b border-neutral-200 py-2">Finding</th>
                  <th className="border-b border-neutral-200 py-2">Location</th>
                </tr>
              </thead>
              <tbody>
                {damageRows.slice(0, 20).map((d, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: severityBg(d.severity),
                          color: severityFg(d.severity),
                        }}
                      >
                        {d.severity}
                      </span>
                    </td>
                    <td className="py-2 text-neutral-800">{d.finding}</td>
                    <td className="py-2 text-neutral-600">{d.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 4. MEASUREMENT REPORT */}
        {measurement && (
          <Section>
            <H2>Measurement Report</H2>
            {staticMapUrl && (
              <img
                src={staticMapUrl}
                alt="Property satellite"
                className="h-60 w-full rounded-lg object-cover"
                crossOrigin="anonymous"
              />
            )}
            {roofSections.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                  Roof Sections ({roofSections.length})
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                      <th className="border-b border-neutral-200 py-1.5">Name</th>
                      <th className="border-b border-neutral-200 py-1.5">Pitch</th>
                      <th className="border-b border-neutral-200 py-1.5 text-right">Plan SF</th>
                      <th className="border-b border-neutral-200 py-1.5 text-right">Sloped SF</th>
                      <th className="border-b border-neutral-200 py-1.5 text-right">Squares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roofSections.map((s) => {
                      const plan = Number(s.plan_area_sqft ?? 0);
                      const actual = Number(s.actual_area_sqft ?? 0);
                      return (
                        <tr key={s.id} className="border-b border-neutral-100">
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-neutral-800">{s.name}</span>
                            </span>
                          </td>
                          <td className="py-1.5 font-mono-num text-neutral-700">
                            {s.pitch === "0/12" ? "Flat" : s.pitch}
                          </td>
                          <td className="py-1.5 text-right font-mono-num text-neutral-700">
                            {plan.toFixed(0)}
                          </td>
                          <td className="py-1.5 text-right font-mono-num text-neutral-700">
                            {actual.toFixed(0)}
                          </td>
                          <td className="py-1.5 text-right font-mono-num font-semibold text-neutral-900">
                            {(actual / 100).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-neutral-300">
                      <td className="py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                        Combined
                      </td>
                      <td />
                      <td className="py-1.5 text-right font-mono-num font-bold text-neutral-900">
                        {roofSections.reduce((s, x) => s + Number(x.plan_area_sqft ?? 0), 0).toFixed(0)}
                      </td>
                      <td className="py-1.5 text-right font-mono-num font-bold text-neutral-900">
                        {roofSections.reduce((s, x) => s + Number(x.actual_area_sqft ?? 0), 0).toFixed(0)}
                      </td>
                      <td className="py-1.5 text-right font-mono-num font-bold text-neutral-900">
                        {(
                          roofSections.reduce((s, x) => s + Number(x.actual_area_sqft ?? 0), 0) / 100
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
              <Stat label="Squares" value={Number(measurement.squares ?? 0).toFixed(1)} />
              <Stat label="Area (SF)" value={Number(measurement.total_area_sqft ?? 0).toFixed(0)} />
              <Stat label="Eaves LF" value={Number(measurement.eaves_lf ?? 0).toFixed(0)} />
              <Stat label="Ridges LF" value={Number(measurement.ridges_lf ?? 0).toFixed(0)} />
              <Stat label="Hips LF" value={Number(measurement.hips_lf ?? 0).toFixed(0)} />
              <Stat label="Valleys LF" value={Number(measurement.valleys_lf ?? 0).toFixed(0)} />
              <Stat label="Rakes LF" value={Number(measurement.rakes_lf ?? 0).toFixed(0)} />
              <Stat label="Pitch" value={measurement.predominant_pitch ?? "—"} />
            </div>
          </Section>
        )}

        {/* 5. INVESTMENT */}
        <Section>
          <H2>Investment</H2>
          {lineItems.length === 0 ? (
            <p className="text-[13px] text-neutral-500">
              No line items yet. Add items in the Estimate tab.
            </p>
          ) : (
            <>
              {itemsByTrade.map(([trade, items]) => (
                <div key={trade} className="mb-4">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                    {getTradeLabel(trade)}
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                        <th className="border-b border-neutral-200 py-1.5">Item</th>
                        <th className="border-b border-neutral-200 py-1.5 text-right">Qty</th>
                        <th className="border-b border-neutral-200 py-1.5">Unit</th>
                        {!hidePricing && (
                          <>
                            <th className="border-b border-neutral-200 py-1.5 text-right">Price</th>
                            <th className="border-b border-neutral-200 py-1.5 text-right">Total</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-b border-neutral-100">
                          <td className="py-1.5 text-neutral-800">{it.name}</td>
                          <td className="py-1.5 text-right font-mono-num text-neutral-700">
                            {Number(it.qty).toFixed(2)}
                          </td>
                          <td className="py-1.5 text-neutral-600">{it.unit}</td>
                          {!hidePricing && (
                            <>
                              <td className="py-1.5 text-right font-mono-num text-neutral-700">
                                ${Number(it.unit_price).toFixed(2)}
                              </td>
                              <td className="py-1.5 text-right font-mono-num font-semibold text-neutral-900">
                                ${(Number(it.qty) * Number(it.unit_price)).toFixed(2)}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {!hidePricing && (
                <div className="mt-4 space-y-1 border-t border-neutral-300 pt-3 text-[12px]">
                  <Row label="Subtotal" value={subtotal} />
                  <Row label={`Markup (${primaryEstimate?.markup_pct ?? 0}%)`} value={markup} />
                  <Row label={`Overhead (${primaryEstimate?.overhead_pct ?? 0}%)`} value={overhead} />
                  <Row label={`Profit (${primaryEstimate?.profit_pct ?? 0}%)`} value={profit} />
                  <Row label={`Tax (${primaryEstimate?.tax_pct ?? 0}%)`} value={tax} />
                  <div className="mt-3 flex items-baseline justify-between border-t border-neutral-300 pt-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                      Grand Total
                    </span>
                    <span
                      className="font-mono-num font-extrabold text-neutral-900"
                      style={{ fontSize: 28 }}
                    >
                      ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        {/* 6. DOCUMENTATION */}
        {photos.length > 0 && (
          <Section>
            <H2>Documentation</H2>
            <div className="grid grid-cols-2 gap-3">
              {photos.slice(0, 8).map((p) => (
                <div key={p.id}>
                  {photoUrls[p.id] && (
                    <img
                      src={photoUrls[p.id]}
                      alt=""
                      crossOrigin="anonymous"
                      className="h-44 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
                    {p.tag ?? "Untagged"}
                  </div>
                  {p.caption && <div className="text-[11px] text-neutral-700">{p.caption}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 7. GOOD/BETTER/BEST */}
        {estimates.length > 1 && !hidePricing && (
          <Section>
            <H2>Your Options</H2>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="border-b border-neutral-200 py-2">Tier</th>
                  <th className="border-b border-neutral-200 py-2">Status</th>
                  <th className="border-b border-neutral-200 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-100">
                    <td className="py-2 font-semibold capitalize text-neutral-800">
                      {e.tier === "original" ? e.name : e.tier}
                    </td>
                    <td className="py-2 capitalize text-neutral-600">{e.status}</td>
                    <td className="py-2 text-right font-mono-num font-bold text-neutral-900">
                      ${Number(e.total ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* 8. TERMS & SIGNATURE */}
        <Section>
          <H2>Terms & Authorization</H2>
          {company?.warranty_blurb && (
            <>
              <h3 className="mt-2 text-[13px] font-bold text-neutral-800">Warranty</h3>
              <p className="text-[12px] leading-relaxed text-neutral-700">{company.warranty_blurb}</p>
            </>
          )}
          {company?.financing_blurb && (
            <>
              <h3 className="mt-3 text-[13px] font-bold text-neutral-800">Financing</h3>
              <p className="text-[12px] leading-relaxed text-neutral-700">{company.financing_blurb}</p>
            </>
          )}
          {company?.license_numbers && company.license_numbers.length > 0 && (
            <p className="mt-3 font-mono-num text-[11px] text-neutral-500">
              License: {company.license_numbers.join(" · ")}
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <div className="border-b border-neutral-400 pb-1 text-neutral-300">·</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
                Customer Signature
              </div>
            </div>
            <div>
              <div className="border-b border-neutral-400 pb-1 text-neutral-300">·</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">Date</div>
            </div>
            <div className="col-span-2">
              <div className="border-b border-neutral-400 pb-1 text-neutral-300">·</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">
                Printed Name
              </div>
            </div>
          </div>
        </Section>

        {/* 9. FOOTER */}
        <Section>
          <div
            className="mb-4 h-1 rounded-full"
            style={{ background: "linear-gradient(90deg, #000, #1e90ff)" }}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-neutral-600">
            <div className="font-bold text-neutral-800">{company?.name ?? "Company"}</div>
            <div className="font-mono-num">
              {company?.phone && <span>{company.phone}</span>}
              {company?.email && <span> · {company.email}</span>}
              {company?.website && <span> · {company.website}</span>}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pdf-section rounded-xl p-8 shadow-md"
      style={{ backgroundColor: "#ffffff", color: "#0a0a0b", fontFamily: "var(--font-sans)" }}
    >
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 border-b-2 border-neutral-900 pb-1 text-xl font-extrabold text-neutral-900"
    >
      {children}
    </h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="font-mono-num text-base font-bold text-neutral-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-neutral-600">{label}</span>
      <span className="font-mono-num text-neutral-800">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function severityBg(s: string): string {
  switch (s) {
    case "critical":
    case "major":
      return "rgba(239,68,68,0.15)";
    case "moderate":
      return "rgba(234,179,8,0.18)";
    default:
      return "rgba(161,161,170,0.15)";
  }
}
function severityFg(s: string): string {
  switch (s) {
    case "critical":
    case "major":
      return "#b91c1c";
    case "moderate":
      return "#a16207";
    default:
      return "#52525b";
  }
}
