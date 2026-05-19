export type LaborUom = "sq" | "hr" | "ea" | "lf" | "sf";

export const LABOR_UOMS: LaborUom[] = ["sq", "hr", "ea", "lf", "sf"];

export type CompanyLaborRate = {
  id: string;
  company_id: string;
  task: string;
  uom: LaborUom;
  rate: number;
  sort_order: number;
  notes: string | null;
  active: boolean;
};

export const STARTER_LABOR_RATES: Array<{ task: string; uom: LaborUom; rate: number; sort_order: number }> = [
  { task: "Tear-off existing roof", uom: "sq", rate: 55, sort_order: 1 },
  { task: "Install architectural shingles", uom: "sq", rate: 110, sort_order: 2 },
  { task: "Install synthetic underlayment", uom: "sq", rate: 18, sort_order: 3 },
  { task: "Install ice & water shield", uom: "sq", rate: 28, sort_order: 4 },
  { task: "Drip edge install", uom: "lf", rate: 2.5, sort_order: 5 },
  { task: "Step flashing install", uom: "lf", rate: 6, sort_order: 6 },
  { task: "Ridge cap install", uom: "lf", rate: 4.5, sort_order: 7 },
  { task: "Valley metal install", uom: "lf", rate: 5, sort_order: 8 },
  { task: "Pipe boot replacement", uom: "ea", rate: 45, sort_order: 9 },
  { task: "Roof vent install", uom: "ea", rate: 85, sort_order: 10 },
  { task: "Crew labor (hourly)", uom: "hr", rate: 55, sort_order: 11 },
  { task: "Foreman labor (hourly)", uom: "hr", rate: 75, sort_order: 12 },
];
