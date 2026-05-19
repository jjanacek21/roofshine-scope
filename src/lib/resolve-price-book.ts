// Resolves the best price book for a job based on ZIP, jurisdiction, company, and pricing type.
// Priority order:
//   1. Company book matching ZIP
//   2. Company book matching jurisdiction
//   3. Company book (any), preferring matching pricing_type
//   4. Master/global default book matching ZIP
//   5. Master/global default book matching jurisdiction
//   6. Master/global default book (any)
import { supabase } from "@/integrations/supabase/client";

export type ResolvedBook = {
  id: string;
  name: string;
  jurisdiction: string | null;
  zip_codes: string[];
  pricing_type: string;
  is_default: boolean;
  company_id: string | null;
  effective_month: string | null;
  reason: string;
};

export interface ResolveOpts {
  companyId: string | null;
  zip?: string | null;
  jurisdiction?: string | null;
  pricingType?: "insurance" | "retail" | null;
}

export async function resolvePriceBook(opts: ResolveOpts): Promise<ResolvedBook | null> {
  const { companyId, zip, jurisdiction, pricingType } = opts;

  // Look up the company's chosen default market (if any) so it can win over
  // generic master-book fallbacks.
  let chosenMarketId: string | null = null;
  if (companyId) {
    const { data: co } = await supabase
      .from("companies")
      .select("default_market_id")
      .eq("id", companyId)
      .maybeSingle();
    chosenMarketId = (co?.default_market_id as string | null) ?? null;
  }

  // Pull every relevant book in one query (RLS already restricts what you can see)
  const { data: books } = await supabase
    .from("price_books")
    .select("id, name, jurisdiction, zip_codes, pricing_type, is_default, company_id, effective_month, is_active")
    .eq("is_active", true)
    .order("effective_month", { ascending: false, nullsFirst: false });

  if (!books?.length) return null;

  const score = (b: typeof books[number]): { score: number; reason: string } | null => {
    const isCompany = companyId && b.company_id === companyId;
    const isMaster = b.is_default && b.company_id === null;
    const isChosenMarket = chosenMarketId && b.id === chosenMarketId;
    if (!isCompany && !isMaster) return null;

    const matchesZip = zip && Array.isArray(b.zip_codes) && b.zip_codes.includes(zip);
    const matchesJur = jurisdiction && b.jurisdiction && b.jurisdiction.toLowerCase() === jurisdiction.toLowerCase();
    const matchesType = pricingType ? b.pricing_type === pricingType : false;

    let s = 0;
    let reason = "";
    if (isCompany) s += 1000;
    if (matchesZip) { s += 500; reason = `Company book matching ZIP ${zip}`; }
    else if (matchesJur) { s += 200; reason = `Company book matching ${jurisdiction}`; }
    if (matchesType) s += 50;
    if (isMaster && !isCompany) {
      if (isChosenMarket) { s += 400; reason = `Company's chosen market (${b.name})`; }
      else if (matchesZip) { s += 100; reason = `Master book matching ZIP ${zip}`; }
      else if (matchesJur) { s += 50; reason = `Master book matching ${jurisdiction}`; }
      else { s += 1; reason = `Master default (${b.name})`; }
    } else if (isCompany && !reason) {
      reason = `Company book (${b.name})`;
    }
    return { score: s, reason };
  };


  const ranked = books
    .map((b) => {
      const r = score(b);
      return r ? { book: b, ...r } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;
  const top = ranked[0];
  return {
    id: top.book.id,
    name: top.book.name,
    jurisdiction: top.book.jurisdiction,
    zip_codes: top.book.zip_codes ?? [],
    pricing_type: top.book.pricing_type,
    is_default: top.book.is_default,
    company_id: top.book.company_id,
    effective_month: top.book.effective_month,
    reason: top.reason,
  };
}
