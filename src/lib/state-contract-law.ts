/**
 * State-specific legal language that must appear in residential roofing
 * contracts and insurance contingency agreements.
 *
 * The contract STRUCTURE never changes — these clauses are appended to the
 * standard sections, with the company's own name, license and address merged
 * in. Admins can override any of it per company in
 * Admin → Companies → Manage → Contracts.
 */

export type StateLegal = {
  code: string;
  name: string;
  /** Days the homeowner may cancel without penalty. */
  rescissionDays: number;
  /** Clause inserted into the residential construction contract. */
  contractClause: string;
  /** Clause inserted into the insurance contingency agreement. */
  contingencyClause: string;
  /** Extra notes shown to reps (permits, licensing display rules, etc.). */
  notes?: string;
};

const GENERIC_RESCISSION = (days: number) =>
  `RIGHT TO CANCEL. You, the buyer, may cancel this transaction at any time prior to midnight of the ${ordinal(
    days,
  )} business day after the date of this transaction. See the attached Notice of Cancellation form for an explanation of this right.`;

function ordinal(n: number) {
  return n === 1 ? "first" : n === 2 ? "second" : n === 3 ? "third" : `${n}th`;
}

export const STATE_LEGAL: Record<string, StateLegal> = {
  FL: {
    code: "FL",
    name: "Florida",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

FLORIDA NOTICE OF INSURANCE CLAIM (Fla. Stat. 489.147). The contractor may not offer to pay, waive, rebate or absorb all or part of any insurance deductible. Any agreement to do so is insurance fraud.

CONSTRUCTION LIEN LAW (Fla. Stat. 713.015). ACCORDING TO FLORIDA'S CONSTRUCTION LIEN LAW, THOSE WHO WORK ON YOUR PROPERTY OR PROVIDE MATERIALS AND SERVICES AND ARE NOT PAID IN FULL HAVE A RIGHT TO ENFORCE THEIR CLAIM FOR PAYMENT AGAINST YOUR PROPERTY. THIS CLAIM IS KNOWN AS A CONSTRUCTION LIEN.

RECOVERY FUND. PAYMENT MAY BE AVAILABLE FROM THE FLORIDA HOMEOWNERS' CONSTRUCTION RECOVERY FUND IF YOU LOSE MONEY ON A PROJECT PERFORMED UNDER CONTRACT.`,
    contingencyClause: `FLORIDA INSURANCE CONTINGENCY (Fla. Stat. 489.147). This agreement is contingent upon the property insurer approving the claim. The homeowner may cancel this agreement without penalty within 10 days after execution, or within 3 business days after the homeowner receives written notice that the insurer has denied the claim in whole or in part. The contractor may not represent the homeowner in negotiations with the insurer unless licensed as a public adjuster.`,
    notes: "Contractor license number and Certificate of Authority must appear on every page.",
  },
  IL: {
    code: "IL",
    name: "Illinois",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

ILLINOIS HOME REPAIR AND REMODELING ACT (815 ILCS 513). The consumer has been provided with the pamphlet "Home Repair: Know Your Consumer Rights" prior to execution of this contract. This contract states the total cost, including parts and materials listed with reasonable particularity, and the contractor carries the insurance coverages disclosed herein.

ROOFING INDUSTRY LICENSING ACT (225 ILCS 335). Roofing work is performed under the contractor's Illinois roofing contractor license listed on this contract.`,
    contingencyClause: `ILLINOIS INSURANCE CONTINGENCY (815 ILCS 513/15.1). This agreement is contingent upon the homeowner's insurer approving the claim. The homeowner may cancel this agreement within 5 business days after being notified that the insurer has denied the claim in whole or in part, and any deposit shall be returned. The contractor shall not advertise or promise to pay, rebate or absorb the homeowner's insurance deductible.`,
  },
  TX: {
    code: "TX",
    name: "Texas",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

TEXAS INSURANCE CODE 707. A contractor may not act as a public insurance adjuster or advertise to adjust the homeowner's claim. This contractor will not negotiate or settle the claim on the homeowner's behalf.

TEXAS INSURANCE CODE 707.003. The contractor may not pay, waive, rebate or absorb the homeowner's insurance deductible in whole or in part.`,
    contingencyClause: `TEXAS INSURANCE CONTINGENCY (Tex. Bus. & Com. Code 27.02). This agreement is contingent upon the insurer's approval of the claim. The homeowner may rescind this agreement not later than the fifth business day after receiving written notice that the insurer has denied all or part of the claim, without penalty or obligation, and any payment made shall be returned within 10 business days.`,
  },
  CO: {
    code: "CO",
    name: "Colorado",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

COLORADO REVISED STATUTES 6-22-101 et seq. The contractor holds general liability insurance as disclosed in this contract and shall provide the homeowner a copy upon request. The contractor may not pay, waive, rebate or otherwise absorb any portion of the homeowner's insurance deductible.`,
    contingencyClause: `COLORADO INSURANCE CONTINGENCY (C.R.S. 6-22-103). The homeowner may rescind this agreement within 72 hours after receiving written notice from the insurer that all or part of the claim is not a covered loss. The contractor shall promptly return any deposit, payment or evidence of indebtedness.`,
  },
  GA: {
    code: "GA",
    name: "Georgia",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

GEORGIA O.C.G.A. 33-24-59.17. The contractor may not pay, waive, rebate or absorb the homeowner's insurance deductible. Georgia residential contractor licensing information is disclosed on this contract.`,
    contingencyClause: `GEORGIA INSURANCE CONTINGENCY. This agreement is contingent on insurer approval of the claim. If the insurer denies coverage in whole or in part, the homeowner may cancel within 5 business days of written notice and any deposit will be refunded.`,
  },
  OK: {
    code: "OK",
    name: "Oklahoma",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

OKLAHOMA ROOFING CONTRACTOR REGISTRATION ACT (59 O.S. 1151.1). The contractor's Oklahoma roofing registration number is disclosed on this contract. The contractor may not pay or rebate the homeowner's insurance deductible.`,
    contingencyClause: `OKLAHOMA INSURANCE CONTINGENCY (59 O.S. 1151.16). The homeowner may cancel this agreement within 72 hours after being notified that the insurer has denied all or part of the claim. Any payment received shall be returned within 10 business days.`,
  },
  MN: {
    code: "MN",
    name: "Minnesota",
    rescissionDays: 3,
    contractClause: `${GENERIC_RESCISSION(3)}

MINNESOTA STATUTES 326B. The contractor is licensed as a residential building contractor or roofer as disclosed on this contract and participates in the Minnesota Contractor Recovery Fund.`,
    contingencyClause: `MINNESOTA INSURANCE CONTINGENCY (Minn. Stat. 325E.66). The homeowner may cancel this agreement within 72 hours after receiving notice that the insurer has denied all or part of the claim. The contractor may not pay, waive, rebate or absorb any portion of the insurance deductible and may not negotiate or adjust the claim on the homeowner's behalf.`,
  },
};

export const DEFAULT_LEGAL: StateLegal = {
  code: "",
  name: "General",
  rescissionDays: 3,
  contractClause: `${GENERIC_RESCISSION(3)}

The contractor holds the licenses and insurance disclosed on this contract and will perform all work in compliance with applicable state and local building codes.`,
  contingencyClause: `INSURANCE CONTINGENCY. This agreement is contingent upon the property insurer approving the claim. If the insurer denies the claim in whole or in part, the homeowner may cancel this agreement within 3 business days of written notice and any deposit shall be refunded. The contractor may not pay, waive, rebate or absorb any portion of the homeowner's insurance deductible.`,
};

export function legalForState(state?: string | null): StateLegal {
  if (!state) return DEFAULT_LEGAL;
  const key = state.trim().toUpperCase().slice(0, 2);
  return STATE_LEGAL[key] ?? { ...DEFAULT_LEGAL, code: key, name: state };
}

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
] as const;

export type ContractProfile = {
  state?: string;
  license_numbers?: string;
  contract_clause?: string;
  contingency_clause?: string;
  warranty_blurb?: string;
  payment_terms?: string;
};

/** Merge saved overrides with the state defaults. */
export function resolveContractProfile(
  profile: ContractProfile | null | undefined,
  state?: string | null,
): Required<Pick<ContractProfile, "contract_clause" | "contingency_clause">> & ContractProfile {
  const legal = legalForState(profile?.state || state);
  return {
    ...profile,
    state: profile?.state || state || "",
    contract_clause: profile?.contract_clause?.trim() || legal.contractClause,
    contingency_clause: profile?.contingency_clause?.trim() || legal.contingencyClause,
  };
}
