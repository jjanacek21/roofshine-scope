import { describe, it, expect } from "vitest";
import { rollup, num, type ReportLineItem } from "./xact-report";

const price = [5519.83, 3200.0, 2400.5, 1800.25, 4100.0, 2500.0, 3000.0, 1500.0, 2000.0, 1934.91];
const tax = [100, 80, 70, 60, 90, 55, 65, 45, 50, 39.55];
const dep = [5519.83, 1000, 500, 300, 400, 200, 300, 150, 200, 173.03];

const included: ReportLineItem[] = price.map((p, i) => ({
  id: `in-${i}`,
  name: `Item ${i + 1}`,
  unit: "EA",
  qty: 1,
  unit_price: p,
  tax_amount: tax[i],
  depreciation_amount: dep[i],
  depreciation_recoverable: true,
  area: "Roof",
}));

const excluded: ReportLineItem[] = [4000, 3000, 2500, 1500].map((p, i) => ({
  id: `out-${i}`,
  name: `Not incurred ${i + 1}`,
  unit: "EA",
  qty: 1,
  unit_price: p,
  tax_amount: 100,
  depreciation_amount: 500,
  not_yet_incurred: true,
  area: "Roof",
}));

describe("carrier estimate rollup", () => {
  const t = rollup([...included, ...excluded], { taxPct: 7, deductible: 2500 });

  it("excludes not-yet-incurred items from every total", () => {
    expect(num(t.lineItemTotal)).toBe("27,955.49");
    expect(num(t.materialSalesTax)).toBe("654.55");
  });

  it("matches the carrier summary figures", () => {
    expect(num(t.replacementCostValue)).toBe("28,610.04");
    expect(num(t.depreciation)).toBe("8,742.86");
    expect(num(t.actualCashValue)).toBe("19,867.18");
    expect(num(t.netClaim)).toBe("17,367.18");
    expect(num(t.recoverableDepreciation)).toBe("8,742.86");
    expect(num(t.netClaimIfDepreciationRecovered)).toBe("26,110.04");
  });

  it("falls back to the estimate tax rate when no override is set", () => {
    const t2 = rollup([{ id: "a", name: "A", unit: "SQ", qty: 2, unit_price: 100 }], {
      taxPct: 7,
      deductible: 0,
    });
    expect(num(t2.materialSalesTax)).toBe("14.00");
    expect(num(t2.replacementCostValue)).toBe("214.00");
    expect(num(t2.actualCashValue)).toBe("214.00");
  });

  it("honors non-recoverable depreciation", () => {
    const t3 = rollup(
      [
        {
          id: "a",
          name: "A",
          unit: "SQ",
          qty: 1,
          unit_price: 1000,
          tax_amount: 0,
          depreciation_pct: 20,
          depreciation_recoverable: false,
        },
      ],
      { taxPct: 0, deductible: 0 },
    );
    expect(num(t3.depreciation)).toBe("200.00");
    expect(num(t3.recoverableDepreciation)).toBe("0.00");
  });
});
