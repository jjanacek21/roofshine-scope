import { useMemo } from "react";
import {
  XactimateReport,
  type CoverMeta,
  type ReportProfile,
} from "@/components/estimate/XactimateReport";
import { useCbLogoUrl } from "@/lib/cbLogo";
import type { CbDraftLine, CbEstimatePercents } from "@/lib/cbEstimate";

export interface CbCarrierCompany {
  name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  license_numbers?: unknown;
}

export interface CbCarrierJob {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  claim_number?: string | null;
  policy_number?: string | null;
  carrier?: string | null;
  date_of_loss?: string | null;
  deductible?: number | null;
}

function areaFor(l: CbDraftLine): string {
  const t = (l.trade || "").toLowerCase();
  if (t.includes("interior")) return "Interior";
  if (t.includes("exterior")) return "Exterior";
  if (t.includes("gutter")) return "Gutters";
  return "Roof";
}

/**
 * The Claim Buddy estimate rendered in the same carrier (Xactimate) document
 * used by the GlobalContractor job workflow — one format on screen and in PDF.
 */
export function CbCarrierReport({
  lines,
  percents,
  company,
  job,
  bookName,
}: {
  lines: CbDraftLine[];
  percents: CbEstimatePercents;
  company: CbCarrierCompany | null;
  job: CbCarrierJob | null;
  bookName?: string | null;
}) {
  const logoUrl = useCbLogoUrl(company?.logo_url ?? null);

  const profile: ReportProfile = useMemo(() => {
    const licenses = Array.isArray(company?.license_numbers)
      ? (company!.license_numbers as unknown[]).map(String).filter(Boolean)
      : [];
    return {
      companyName: company?.legal_name || company?.name || "Company",
      logoUrl,
      addressLine1: company?.address ?? null,
      addressLine2: [company?.city, company?.state, company?.zip].filter(Boolean).join(", ") || null,
      businessPhone: company?.phone ?? null,
      claimsEmail: company?.email ?? null,
      website: company?.website ?? null,
      estimatorLicense: licenses.join(", ") || null,
    };
  }, [company, logoUrl]);

  const meta: CoverMeta = useMemo(
    () => ({
      insuredName: job?.customer_name ?? null,
      insuredPhone: job?.customer_phone ?? null,
      insuredEmail: job?.customer_email ?? null,
      propertyAddress:
        [job?.address, job?.city, job?.state, job?.zip].filter(Boolean).join(", ") || null,
      claimRepCompany: job?.carrier ?? null,
      claimNumber: job?.claim_number ?? null,
      policyNumber: job?.policy_number ?? null,
      typeOfLoss: "Storm / Wind & Hail",
      dateOfLoss: job?.date_of_loss ?? null,
      dateEntered: new Date().toISOString().slice(0, 10),
      priceListDescription: bookName ?? null,
      estimateName: "Estimate of repair",
      reportDate: new Date().toLocaleDateString(),
    }),
    [job, bookName],
  );

  const items = useMemo(
    () =>
      lines
        .filter((l) => l.name.trim())
        .map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          unit: l.unit,
          qty: Number(l.qty ?? 0),
          unit_price: Number(l.unit_price ?? 0),
          note: l.basis || null,
          category: l.category ?? null,
          area: areaFor(l),
        })),
    [lines],
  );

  return (
    <XactimateReport
      profile={profile}
      meta={meta}
      items={items}
      taxPct={percents.tax_pct ?? 0}
      deductible={Number(job?.deductible ?? 0) || 0}
      markupPct={percents.markup_pct ?? 0}
      overheadPct={percents.overhead_pct ?? 0}
      profitPct={percents.profit_pct ?? 0}
    />
  );
}
