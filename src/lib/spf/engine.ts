// SPF cost engine — verbatim port of calc() and buildScope() from the source HTML.
import {
  PRODUCTS, METHODS, SCOPES, STACKS,
  type Layer, type Detail, type SpfFields, type MethodKey, type ScopeKey,
  ACCESS_LABELS, DECK_LABELS, SURF_LABELS, PREP_LABELS, RUST_LABELS,
  FABRIC_LABELS, ENG_LABELS, WAR_LABELS,
} from "./data";

export const heightFactor = (h: number) =>
  h < 20 ? 1 : h < 40 ? 1.06 : h < 70 ? 1.13 : h < 100 ? 1.22 : 1.33;
export const hoseFactor = (f: number) =>
  f <= 200 ? 1 : f <= 300 ? 1.04 : f <= 450 ? 1.09 : 1.16;
export const accessFactor = (m: number) =>
  [1, 1.04, 1.08, 1.14, 1.18, 1.10][m] ?? 1;

export function defWaste(method: MethodKey, scope: ScopeKey, foamTex: number): number {
  const base = method === "spray" ? foamTex : 0;
  return Math.round(base + METHODS[method][2] + (scope === "seams" || scope === "details" ? 10 : 0));
}

export function newLayer(pi: number, scope?: ScopeKey, amt?: number, method?: MethodKey, mils?: number): Layer {
  const p = PRODUCTS[pi];
  return [
    1, pi, p[0], scope ?? "field",
    amt == null ? 100 : amt,
    method ?? p[4],
    mils ?? p[3],
    p[1], p[2], null,
  ];
}

export function stackFromPreset(key: keyof typeof STACKS): Layer[] {
  return STACKS[key].map((r) => {
    const l = newLayer(r[1], r[3], r[4], r[5], r[6]);
    l[0] = r[0];
    return l;
  });
}

export function detailArea(details: Detail[]): number {
  let lf = 0, ea = 0;
  details.forEach((d) => {
    if (d[1] === "lf") lf += d[2];
    if (d[1] === "ea") ea += d[2];
  });
  return lf * 1.5 + ea * 9;
}

export function detailTotal(details: Detail[]): number {
  return details.reduce((s, d) => s + d[2] * d[3], 0);
}

const num = (v: number | string | null | undefined) => {
  const n = typeof v === "number" ? v : parseFloat(v as string);
  return isFinite(n) ? n : 0;
};

export type LayerRow = [string, string, string, number, number, number, number];
// [name, scopeLabel, methodLabel, mils, gal, cost, area]

export type CalcResult = {
  sqft: number; sq: number;
  bf: number; sets: number; foamMat: number; foamOn: number;
  seamArea: number; fabMat: number; fabDays: number;
  coatMat: number; coatDays: number; gal: number;
  layerRows: LayerRow[]; layerBreakdown: { area: number; gal: number; cost: number; on: number }[];
  tearSq: number; tearCost: number; deckRep: number; prep: number;
  rustArea: number; rust: number; mildew: number; fastener: number; removal: number;
  dFoam: number; dPrep: number; dRust: number; dTear: number; daysRaw: number; days: number;
  laborBase: number; labor: number; superv: number; diem: number; lodge: number; mob: number; fieldLabor: number;
  perDay: number; equipDaily: number; lift: number; crane: number; dumps: number; miscEq: number; equipment: number;
  details: number;
  eng: number; softFixed: number; warranty: number; soft: number;
  matRaw: number; tax: number; materials: number;
  gl: number; cont: number; oh: number;
  permit: number; commission: number; finance: number; bondC: number;
  sell: number; totalCost: number; gp: number;
  totMils: number;
  groups: { label: string; value: number; color: string }[];
  flags: { level: "ok" | "warn" | "err"; text: string }[];
};

export function calc(fields: SpfFields, layers: Layer[], details: Detail[]): CalcResult {
  const sqft = num(fields.p_sqft) * (1 + num(fields.p_areawaste) / 100);
  const sq = sqft / 100;
  const laborFactor =
    parseFloat(fields.p_geo) * parseFloat(fields.p_slope) *
    heightFactor(num(fields.a_ht)) * hoseFactor(num(fields.a_hose)) *
    accessFactor(parseInt(fields.a_method)) *
    parseFloat(fields.a_occ) * parseFloat(fields.a_shift);

  // FOAM
  const foamOn = parseFloat(fields.f_on);
  const bf = foamOn ? sqft * num(fields.f_thick) + num(fields.f_taper) : 0;
  const sets = foamOn
    ? Math.ceil(bf * (1 + num(fields.f_waste) / 100) * parseFloat(fields.f_amb) / Math.max(num(fields.f_yield), 1))
    : 0;
  const foamMat = sets * (num(fields.f_cost) + num(fields.f_freight));

  // REINFORCEMENT
  const seamArea = num(fields.r_lf) * (num(fields.r_w) / 12);
  const fabC = num(fields.r_c) > 0 ? num(fields.r_c) : parseFloat(fields.r_type);
  const fabMat = num(fields.r_lf) * fabC + sqft * (num(fields.r_fieldpct) / 100) * num(fields.r_fieldc);
  const fabDays =
    num(fields.r_lf) / Math.max(num(fields.r_rate), 1) +
    (num(fields.r_fieldpct) > 0 ? sqft * (num(fields.r_fieldpct) / 100) / 4000 : 0);

  // COATING STACK
  let coatMat = 0, coatDays = 0, gal = 0;
  const layerRows: LayerRow[] = [];
  const layerBreakdown: { area: number; gal: number; cost: number; on: number }[] = [];
  const foamTex = num(fields.f_tex);
  layers.forEach((L) => {
    const [on, pi, name, scope, amt, method, mils, solids, cost, waste] = L;
    let area = 0;
    if (scope === "field") area = sqft;
    else if (scope === "pct") area = sqft * (num(amt) / 100);
    else if (scope === "seams") area = seamArea;
    else if (scope === "details") area = detailArea(details);
    else if (scope === "custom") area = num(amt);
    const solidsN = num(solids);
    const wasteN = waste == null ? defWaste(method, scope, foamTex) : num(waste);
    const g = solidsN > 0 ? (area * num(mils)) / (1604 * (solidsN / 100)) * (1 + wasteN / 100) : 0;
    const c = g * num(cost);
    const d = area / Math.max(METHODS[method][1], 1);
    layerBreakdown.push({ area, gal: g, cost: c, on });
    if (on) {
      coatMat += c;
      coatDays += d;
      gal += g;
      layerRows.push([
        name || PRODUCTS[pi][0],
        SCOPES[scope],
        METHODS[method][0],
        num(mils),
        Math.ceil(g),
        c,
        area,
      ]);
    }
  });

  // TEAR OFF / PREP
  const tearPct = parseFloat(fields.e_tear);
  const eLayers = Math.max(num(fields.e_layers), 0);
  const tearSq = sq * tearPct;
  const tearCost = tearSq * eLayers * (num(fields.e_tearcost) + num(fields.e_disp));
  const deckRep = num(fields.e_deckrep) * num(fields.e_deckrepc);
  const prep = sqft * parseFloat(fields.e_prep);
  const rustArea = sqft * (num(fields.e_rustpct) / 100);
  const rust = rustArea * parseFloat(fields.e_rustm);
  const mildew = sqft * num(fields.e_mildew);
  const fastener = sqft * num(fields.e_fast);
  const removal = tearCost + deckRep + prep + rust + mildew + fastener;

  // DAYS
  const dFoam = bf / Math.max(num(fields.l_foamrate), 1);
  const dPrep = sqft / Math.max(num(fields.l_preprate), 1);
  const dRust = rustArea / Math.max(num(fields.l_rustrate), 1);
  const dTear = (tearSq * eLayers) / Math.max(num(fields.l_tearrate), 1);
  const daysRaw = dFoam + dPrep + dRust + dTear + coatDays + fabDays;
  const days = Math.ceil(daysRaw * laborFactor) + num(fields.l_wx) + num(fields.e_dry);
  const laborBase = days * num(fields.l_crew) * num(fields.l_hrs) * num(fields.l_wage);
  const labor = laborBase * (1 + num(fields.l_burden) / 100);
  const superv = days * num(fields.l_super);
  const diem = days * num(fields.l_crew) * num(fields.l_diem);
  const lodge = days * num(fields.l_lodge);
  const mob = num(fields.l_mobs) * num(fields.l_mobc);
  const fieldLabor = labor + superv + diem + lodge + mob;

  // EQUIPMENT
  const perDay = num(fields.q_rig) + num(fields.q_fuel) + num(fields.q_pump) +
    num(fields.q_wash) + num(fields.q_cons) + num(fields.q_veh);
  const equipDaily = perDay * days;
  const lift = num(fields.a_liftrate) * num(fields.a_liftdays) + num(fields.a_liftdel);
  const crane = num(fields.a_cranerate) * num(fields.a_cranehrs);
  const dumps = num(fields.q_dump) * num(fields.q_dumpc);
  const miscEq = num(fields.a_hoist) + num(fields.a_overspray) + num(fields.a_screens) +
    num(fields.q_trailer) + num(fields.q_hand);
  const equipment = equipDaily + lift + crane + dumps + miscEq;
  const detailsTotal = detailTotal(details);

  // SOFT
  const eng = num(fields.s_engov) > 0 ? num(fields.s_engov) : parseFloat(fields.s_eng);
  const softFixed = num(fields.s_plan) + num(fields.s_insp) * num(fields.s_inspc) +
    num(fields.s_noa) + num(fields.s_ir) + num(fields.s_core) +
    num(fields.s_mock) + num(fields.s_3rd) + num(fields.s_warfee);
  const warranty = parseFloat(fields.s_war) * sqft;
  const soft = eng + softFixed + warranty;

  // ROLLUP
  const matRaw = foamMat + coatMat + fabMat;
  const tax = matRaw * num(fields.m_tax) / 100;
  const materials = matRaw + tax;
  let cost = materials + removal + fieldLabor + equipment + detailsTotal + soft;
  const gl = fieldLabor * num(fields.m_gl) / 100; cost += gl;
  const cont = cost * num(fields.m_cont) / 100; cost += cont;
  const oh = cost * num(fields.m_oh) / 100; cost += oh;

  // SOLVE SELL
  const mgn = num(fields.m_margin) / 100;
  const comm = num(fields.m_comm) / 100;
  const fin = num(fields.m_fin) / 100;
  const bond = num(fields.m_bond) / 100;
  const permitPct = fields.s_pbasis === "pct" ? num(fields.s_ppct) / 100 : 0;
  const permitFlatOnly = fields.s_pbasis === "flat" ? num(fields.s_pflat) : 0;
  const k = 1 - (mgn + comm + fin + bond + permitPct);
  let sell = k > 0.05 ? (cost + permitFlatOnly) / k : (cost + permitFlatOnly) * 20;
  let permit = fields.s_pbasis === "pct" ? Math.max(sell * permitPct, num(fields.s_pflat)) : permitFlatOnly;
  if (fields.s_pbasis === "pct" && permit > sell * permitPct) {
    sell = (cost + permit) / (1 - (mgn + comm + fin + bond));
    permit = Math.max(sell * permitPct, num(fields.s_pflat));
  }
  const commission = sell * comm;
  const finance = sell * fin;
  const bondC = sell * bond;
  const totalCost = cost + permit + commission + finance + bondC;
  const gp = sell - totalCost;

  // GROUPS for stacked bar
  const groups = [
    { label: "Materials", value: materials, color: "var(--rk-gold)" },
    { label: "Tear-off & prep", value: removal, color: "var(--rk-red)" },
    { label: "Labor", value: fieldLabor + gl, color: "var(--rk-accent)" },
    { label: "Equipment", value: equipment, color: "var(--rk-purple)" },
    { label: "Details", value: detailsTotal, color: "#c98fb0" },
    { label: "Soft costs", value: soft + permit, color: "#7fbfcf" },
    { label: "OH / contingency", value: oh + cont, color: "#6d7f92" },
    { label: "Commission / fees", value: commission + finance + bondC, color: "#8a7f5f" },
    { label: "Gross profit", value: gp, color: "var(--rk-green)" },
  ];

  // FLAGS
  const on = layers.filter((l) => l[0]);
  const totMils = on.filter((l) => l[3] === "field" || l[3] === "pct").reduce((a, b) => a + num(b[6]), 0);
  const hasPrimer = on.some((l) => PRODUCTS[l[1]][5] === "primer");
  const hasTop = on.some((l) => PRODUCTS[l[1]][5] === "top");
  const silTot = on
    .filter((l) => PRODUCTS[l[1]][0].toLowerCase().includes("silicone"))
    .reduce((a, b) => a + num(b[6]), 0);
  const flags: CalcResult["flags"] = [];
  if (!on.length) flags.push({ level: "err", text: "No coating layers active. The foam is unprotected." });
  if (foamOn && num(fields.f_thick) < 1)
    flags.push({ level: "err", text: 'Foam under 1" — most manufacturers will not warrant it and you lose slope correction.' });
  if (silTot > 0 && silTot < 20)
    flags.push({ level: "err", text: `Silicone totals ${silTot} mils DFT across the stack — under 20 mils rarely qualifies for an NDL warranty.` });
  if (totMils > 0 && totMils < 18)
    flags.push({ level: "warn", text: `Only ${totMils} mils total field DFT. Verify against the manufacturer's minimum.` });
  if (fields.e_surf === "metal" && !hasPrimer)
    flags.push({ level: "err", text: "Metal substrate with no primer in the stack. Rust will bleed through and void the warranty." });
  if (fields.e_surf === "metal" && num(fields.e_rustpct) === 0)
    flags.push({ level: "warn", text: "Metal roof scoped with 0% rust removal. Verify panel condition." });
  if (num(fields.r_lf) > 0 && !on.some((l) => l[3] === "seams"))
    flags.push({ level: "warn", text: "Seam footage entered but no layer is applied to seams — nothing is embedding that fabric." });
  if (on.some((l) => l[3] === "seams") && num(fields.r_lf) === 0)
    flags.push({ level: "warn", text: "A layer is scoped to seams but seam LF is zero, so it prices at nothing." });
  if (on.length > 1 && !hasTop)
    flags.push({ level: "warn", text: "Multi-layer stack with no topcoat-role product. Confirm the last layer is UV-stable." });
  if (on.some((l) => l[5] === "brush" && l[3] === "field"))
    flags.push({ level: "warn", text: "A full-field brush layer is scoped — that is ~900 sq ft/day. Verify the schedule." });
  if (tearPct > 0 && num(fields.q_dump) === 0)
    flags.push({ level: "warn", text: "Tear-off scoped with zero dumpsters. Add disposal containers." });
  if (parseInt(fields.a_method) >= 3 && num(fields.a_liftdays) === 0 && num(fields.a_cranehrs) === 0)
    flags.push({ level: "err", text: "Lift or crane access selected but no equipment days/hours entered." });
  if (num(fields.s_ir) === 0 && tearPct > 0 && tearPct < 1)
    flags.push({ level: "warn", text: "Partial tear-off priced without an IR scan. That wet-area % is an assumption you own." });
  if (foamTex >= 28 && foamOn)
    flags.push({ level: "warn", text: `Rough foam texture — every sprayed layer is carrying ${foamTex}% loss.` });
  if (sell > 0 && gp / sell < 0.15)
    flags.push({ level: "err", text: "Gross margin under 15% — no room for a rework day." });
  if (foamOn && num(fields.f_yield) > 4200)
    flags.push({ level: "warn", text: "Yield above 4,200 bd ft/set is optimistic for field conditions." });
  if (!flags.length)
    flags.push({ level: "ok", text: "No spec conflicts detected. Verify quantities against the field measure before issuing." });

  return {
    sqft, sq, bf, sets, foamMat, foamOn,
    seamArea, fabMat, fabDays,
    coatMat, coatDays, gal, layerRows, layerBreakdown,
    tearSq, tearCost, deckRep, prep, rustArea, rust, mildew, fastener, removal,
    dFoam, dPrep, dRust, dTear, daysRaw, days,
    laborBase, labor, superv, diem, lodge, mob, fieldLabor,
    perDay, equipDaily, lift, crane, dumps, miscEq, equipment,
    details: detailsTotal,
    eng, softFixed, warranty, soft,
    matRaw, tax, materials,
    gl, cont, oh,
    permit, commission, finance, bondC,
    sell, totalCost, gp,
    totMils,
    groups, flags,
  };
}

const money = (n: number) => "$" + Math.round(n).toLocaleString();

export function buildScope(r: CalcResult, fields: SpfFields, details: Detail[]): string {
  const t: string[] = [];
  t.push((fields.p_name || "").toUpperCase());
  if (fields.p_addr) t.push(fields.p_addr);
  t.push("SCOPE OF WORK — " + (r.foamOn ? "SPRAYED POLYURETHANE FOAM ROOF SYSTEM" : "FLUID-APPLIED COATING RESTORATION"));
  t.push("Date: " + new Date().toLocaleDateString());
  t.push("");
  t.push("1. EXISTING CONDITIONS");
  t.push(`   Approx. ${num(fields.p_sqft).toLocaleString()} sq ft (${(num(fields.p_sqft) / 100).toFixed(1)} squares) of ${SURF_LABELS[fields.e_surf]} over ${DECK_LABELS[fields.e_deck]} deck, ${num(fields.e_layers)} existing layer(s). Roof height approx. ${num(fields.a_ht)} ft.`);
  t.push("");
  t.push("2. REMOVAL, CLEANING & PREPARATION");
  const tearPct = parseFloat(fields.e_tear);
  const eLayers = num(fields.e_layers);
  if (tearPct === 1) t.push(`   Remove all ${eLayers} existing roof layer(s) to the deck and dispose of legally.`);
  else if (tearPct > 0) t.push(`   Remove and replace saturated roofing in approx. ${(tearPct * 100)}% of the field (${(num(fields.p_sqft) / 100 * tearPct).toFixed(1)} squares), ${eLayers} layer(s), verified by moisture survey.`);
  else t.push("   Recover/restore in place. No tear-off included. Wet material found beyond the areas noted is extra work.");
  if (num(fields.e_deckrep)) t.push(`   Repair/replace ${num(fields.e_deckrep).toLocaleString()} sq ft of deteriorated deck or panel.`);
  t.push(`   ${PREP_LABELS[fields.e_prep] ?? "Surface prep"} of the entire surface; allow to dry to manufacturer moisture limits before application.`);
  if (r.rustArea) t.push(`   Remove rust and scale from approx. ${Math.round(r.rustArea).toLocaleString()} sq ft — ${RUST_LABELS[fields.e_rustm] ?? "as specified"}. Prime all cleaned metal the same day.`);
  if (num(fields.e_mildew)) t.push("   Treat the full surface with mildewcide/biocide and rinse.");
  if (num(fields.e_fast)) t.push("   Re-secure or replace loose and backed-out fasteners throughout.");
  if (num(fields.e_dry)) t.push(`   Allow ${num(fields.e_dry)} day(s) dry/cure time before proceeding.`);
  t.push("");
  let s = 3;
  if (r.foamOn) {
    t.push(s + ". FOAM APPLICATION");
    t.push(`   Spray-apply ${fields.f_dens} lb/ft³ closed-cell polyurethane roofing foam at ${num(fields.f_thick)}" average thickness (${Math.round(r.bf).toLocaleString()} board feet, approx. ${r.sets} sets), sloped to drain at all low points and terminations.`);
    if (num(fields.f_taper)) t.push("   Includes tapered foam crickets/saddles for positive drainage.");
    t.push("   Foam to be sprayed to a smooth to coarse orange-peel texture. Popcorn or tree-bark surface will not be accepted for coating.");
    t.push(""); s++;
  }
  t.push(s + ". COATING SYSTEM — APPLIED IN THIS ORDER");
  r.layerRows.forEach((row, i) => {
    t.push(`   ${i + 1}) ${row[0]} — ${row[3]} mils DFT, ${row[2].toLowerCase()}-applied to ${row[1].toLowerCase()} (approx. ${Math.round(row[6]).toLocaleString()} sq ft, ${row[4]} gal).`);
  });
  if (r.totMils) t.push(`   Total field dry film thickness: ${r.totMils} mils.`);
  t.push("   Each coat to be fully cured and inspected before the next is applied. Wet mils checked continuously; DFT verified at completion.");
  if (num(fields.r_lf)) t.push(`   Embed ${num(fields.r_lf).toLocaleString()} LF of ${(FABRIC_LABELS[fields.r_type] ?? "reinforcing fabric").toLowerCase()}, ${num(fields.r_w)}" wide, in coating at all seams, laps and joints.`);
  if (num(fields.r_fieldpct)) t.push(`   Full-field reinforcing fabric over ${num(fields.r_fieldpct)}% of the roof area.`);
  t.push(""); s++;
  t.push(s + ". DETAILS & HARDWARE");
  const dl = details.filter((x) => x[2] > 0);
  if (dl.length) dl.forEach((x) => t.push(`   • ${x[0]} — ${x[2]} ${x[1]}`));
  else t.push("   • Standard terminations, penetrations and flashings per manufacturer requirements.");
  t.push(""); s++;
  t.push(s + ". ACCESS & LOGISTICS");
  t.push(`   ${ACCESS_LABELS[parseInt(fields.a_method)]}; approx. ${num(fields.a_hose)} ft hose run from rig staging.`);
  if (num(fields.a_cranehrs)) t.push(`   Crane: ${num(fields.a_cranehrs)} hours included.`);
  if (num(fields.a_liftdays)) t.push(`   Lift: ${num(fields.a_liftdays)} days included.`);
  if (num(fields.a_overspray)) t.push("   Overspray containment: vehicles, adjacent surfaces and equipment masked; wind monitored and work stopped above safe limits.");
  t.push(`   Estimated ${r.days} working days on site (includes ${num(fields.l_wx)} weather/standby day(s)), ${num(fields.l_mobs)} mobilization(s).`);
  t.push(""); s++;
  t.push(s + ". ENGINEERING, PERMITTING & CLOSEOUT");
  if (r.eng) t.push(`   ${ENG_LABELS[fields.s_eng] ?? "Engineering"} included.`);
  t.push(`   Building permit included (${fields.s_pbasis === "pct" ? num(fields.s_ppct) + "% of valuation, approx. " + money(r.permit) : money(r.permit) + " flat"}), plan review, notice of commencement and required inspections.`);
  if (num(fields.s_noa)) t.push("   Product approval / NOA documentation package included.");
  if (num(fields.s_ir)) t.push("   Infrared moisture survey included.");
  if (num(fields.s_core)) t.push("   Core cuts and adhesion pull tests performed prior to full application.");
  if (r.warranty) t.push(`   ${WAR_LABELS[fields.s_war] ?? "Manufacturer warranty"} plus contractor workmanship warranty.`);
  else t.push("   Contractor workmanship warranty only.");
  t.push(""); s++;
  t.push(s + ". EXCLUSIONS");
  t.push("   Structural work; asbestos or hazardous material abatement; interior finishes; electrical or mechanical disconnects; lightning protection unless listed above; unforeseen conditions concealed by the existing roof; work stopped by weather beyond the standby days carried.");
  t.push("");
  t.push("CONTRACT PRICE: " + money(r.sell));
  t.push(`($${(r.sell / Math.max(num(fields.p_sqft), 1)).toFixed(2)}/sq ft · ${money(r.sell / Math.max(num(fields.p_sqft) / 100, 1))}/square)`);
  return t.join("\n");
}
