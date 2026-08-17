/**
 * Claim Buddy roof takeoff sheet.
 * Everything lives in cb_takeoffs.data.sheet as structured JSON so the
 * report writer never has to guess at shapes.
 */

export const CB_ROOF_TYPES = [
  "3-tab asphalt",
  "Architectural asphalt",
  "Luxury / designer asphalt",
  "Impact-resistant",
  "Wood shake",
  "Wood shingle",
  "Slate",
  "Synthetic slate",
  "Clay tile",
  "Concrete tile",
  "Standing seam metal",
  "Corrugated metal",
  "Stone-coated steel",
  "TPO",
  "EPDM",
  "PVC",
  "Modified bitumen",
  "BUR / tar and gravel",
  "Rolled roofing",
  "Other",
] as const;

export const CB_DECKING_TYPES = [
  "Plywood",
  "OSB",
  "Wood plank / skip sheathing",
  "Tongue and groove",
  "Concrete",
  "Lightweight concrete",
  "Steel / metal deck",
  "Gypsum deck",
  "Tectum",
  "Other",
];
export const CB_DECKING_CONDITION = ["Sound", "Deteriorated", "Rotted", "Unknown"];
export const CB_UNDERLAYMENT_TYPES = [
  "15# felt",
  "30# felt",
  "Synthetic",
  "Self-adhered / peel and stick",
  "Ice and water shield",
];
export const CB_CHIMNEY_MATERIALS = ["Brick", "Block", "Stucco", "Siding", "Metal chase"];
export const CB_CHIMNEY_CONDITION = ["Sound", "Cracked", "Spalling", "Missing"];
export const CB_CHIMNEY_ACTION = ["Reflash", "Rebuild"];
export const CB_MEMBRANE_TYPES = [
  "TPO",
  "PVC",
  "EPDM",
  "Modified bitumen APP",
  "Modified bitumen SBS",
  "Torch-down",
  "Self-adhered mod bit",
  "BUR / tar and gravel",
  "Hot mop",
  "Rolled roofing",
  "SPF spray foam",
  "Acrylic coating",
  "Silicone coating",
  "Urethane coating",
  "Ballasted",
  "Other",
];
export const CB_MEMBRANE_ATTACHMENT = [
  "Mechanically fastened",
  "Fully adhered",
  "Ballasted",
  "Induction welded",
  "Torched",
  "Hot asphalt",
];
export const CB_INSULATION_TYPES = [
  "Polyiso",
  "EPS",
  "XPS",
  "Mineral wool",
  "Wood fiberboard",
  "Perlite",
  "Tapered system",
  "Recover board",
  "Gypsum cover board (DensDeck)",
  "HD polyiso cover board",
  "Other",
];
export const CB_EDGE_METAL_MATERIALS = ["Aluminum", "Galvanized", "Copper", "Steel", "Painted steel"];
export const CB_FLASH_MATERIALS = ["Aluminum", "Galvanized", "Copper"];
export const CB_GUTTER_SIZES = ["5 inch", "6 inch", "Custom"];
export const CB_GUTTER_MATERIALS = ["Aluminum", "Steel", "Copper", "Vinyl"];
export const CB_SKYLIGHT_TYPES = ["Fixed", "Vented", "Tubular"];

export const CB_SIDING_TYPES = [
  "Vinyl",
  "Aluminum",
  "Wood",
  "Hardie / fiber cement",
  "Stucco",
  "Brick",
  "Stone",
  "Other",
];
export const CB_FLOORING_TYPES = [
  "Carpet",
  "Laminate",
  "Vinyl plank",
  "Hardwood",
  "Tile",
  "Concrete",
  "Other",
];

export interface CbExteriorArea {
  siding_type?: string;
  siding_sqft?: number;
  windows_qty?: number;
  screens_qty?: number;
  doors_qty?: number;
  fascia_lf?: number;
  soffit_lf?: number;
  gutter_lf?: number;
  downspout_qty?: number;
  shutters_qty?: number;
  light_fixtures_qty?: number;
  ac_fin_qty?: number;
  fence_lf?: number;
  wrap_qty?: number;
  detached_qty?: number;
  notes?: string;
}

export interface CbInteriorArea {
  ceiling_sqft?: number;
  wall_sqft?: number;
  flooring_type?: string;
  flooring_sqft?: number;
  baseboard_lf?: number;
  drywall_sqft?: number;
  insulation_sqft?: number;
  paint_sqft?: number;
  contents_note?: string;
}

type NumKeys<T> = { [K in keyof T]-?: number extends T[K] ? K : never }[keyof T];

export interface CbTakeoffFieldSpec<T> {
  key: NumKeys<T>;
  label: string;
  unit: string;
  /** words the estimate matcher looks for in the price book */
  match: string[];
}

export const CB_EXTERIOR_FIELDS: CbTakeoffFieldSpec<CbExteriorArea>[] = [
  { key: "siding_sqft", label: "Siding", unit: "SF", match: ["siding"] },
  { key: "windows_qty", label: "Windows", unit: "EA", match: ["window"] },
  { key: "screens_qty", label: "Window screens", unit: "EA", match: ["screen"] },
  { key: "doors_qty", label: "Doors", unit: "EA", match: ["door"] },
  { key: "fascia_lf", label: "Fascia", unit: "LF", match: ["fascia"] },
  { key: "soffit_lf", label: "Soffit", unit: "LF", match: ["soffit"] },
  { key: "gutter_lf", label: "Gutter", unit: "LF", match: ["gutter"] },
  { key: "downspout_qty", label: "Downspouts", unit: "EA", match: ["downspout"] },
  { key: "shutters_qty", label: "Shutters", unit: "EA", match: ["shutter"] },
  { key: "light_fixtures_qty", label: "Light fixtures", unit: "EA", match: ["light"] },
  { key: "ac_fin_qty", label: "A/C condenser fins", unit: "EA", match: ["condenser"] },
  { key: "fence_lf", label: "Fence", unit: "LF", match: ["fence"] },
  { key: "wrap_qty", label: "Wraps / trim", unit: "EA", match: ["wrap"] },
  { key: "detached_qty", label: "Detached structures", unit: "EA", match: ["detached"] },
];

export const CB_INTERIOR_FIELDS: CbTakeoffFieldSpec<CbInteriorArea>[] = [
  { key: "ceiling_sqft", label: "Ceiling", unit: "SF", match: ["ceiling"] },
  { key: "wall_sqft", label: "Walls", unit: "SF", match: ["wall"] },
  { key: "flooring_sqft", label: "Flooring", unit: "SF", match: ["floor"] },
  { key: "baseboard_lf", label: "Baseboard", unit: "LF", match: ["baseboard"] },
  { key: "drywall_sqft", label: "Drywall damage", unit: "SF", match: ["drywall"] },
  { key: "insulation_sqft", label: "Insulation", unit: "SF", match: ["insulation"] },
  { key: "paint_sqft", label: "Paint", unit: "SF", match: ["paint"] },
];

export interface CbSkylightRow {
  id: string;
  qty: number;
  size: string;
  type: string;
  condition: string;
  flashing_kit: boolean;
}


export interface CbSheet {
  roof_system: {
    roof_type?: string;
    roof_type_other?: string;
    stories?: number;
    pitch?: string;
    layers?: number;
    /** @deprecated moved to `decking` — kept so old sheets still read. */
    decking_type?: string;
    /** @deprecated moved to `decking` */
    decking_condition?: string;
  };
  decking: {
    type?: string;
    thickness?: string;
    condition?: string;
    renail?: boolean;
    sheets_to_replace?: number;
  };
  underlayment: {
    type?: string;
    layers?: number;
    ice_water_lf?: number;
    secondary_water_barrier?: boolean;
  };
  flashing: {
    roof_to_wall_lf?: number;
    step_flashing_lf?: number;
    counterflashing_lf?: number;
    material?: string;
    /** @deprecated moved to `chimney` */
    chimney_count?: number;
    /** @deprecated moved to `chimney` */
    chimney_size?: string;
    /** @deprecated moved to `chimney` */
    cricket?: boolean;
  };
  chimney: {
    count?: number;
    size?: string;
    material?: string;
    chase_cover?: boolean;
    crown_condition?: string;
    cap_present?: boolean;
    cricket?: boolean;
    flashing_type?: string;
    action?: string;
  };
  ventilation: {
    ridge_vent_lf?: number;
    box_vent_qty?: number;
    turbine_qty?: number;
    power_vent_qty?: number;
    solar_fan_qty?: number;
    soffit_vent_lf?: number;
    gable_vent_qty?: number;
  };
  penetrations: {
    pipe_1_5?: number;
    pipe_2?: number;
    pipe_3?: number;
    pipe_4?: number;
    pipe_6?: number;
    pipe_8?: number;
    lead_boots?: number;
    split_boots?: number;
    furnace_caps?: number;
    storm_collars?: number;
    exhaust_vents?: number;
    kitchen_vents?: number;
    bath_vents?: number;
    lineset_covers?: number;
  };
  skylights: CbSkylightRow[];
  flat_roof: {
    present?: boolean;
    area_sf?: number;
    membrane?: string;
    thickness_mil?: string;
    attachment?: string;
    drains?: number;
    scuppers?: number;
    curbs?: number;
    pitch_pans?: number;
  };
  insulation: {
    none?: boolean;
    type?: string;
    thickness_in?: string;
    r_value?: string;
    layers?: number;
    tapered?: boolean;
  };
  edge_metal: {
    drip_edge_lf?: number;
    rake_edge_lf?: number;
    gravel_stop_lf?: number;
    fascia_metal_lf?: number;
    valley_metal_lf?: number;
    ridge_cap_lf?: number;
    starter_lf?: number;
    material?: string;
    color?: string;
  };
  solar: {
    panel_count?: number;
    detach_reset?: boolean;
    mounting?: string;
  };
  gutters: {
    size?: string;
    material?: string;
    lf?: number;
    downspout_qty?: number;
    downspout_size?: string;
    guards?: boolean;
  };
  accessories: {
    walkway_pads?: number;
    snow_guards?: number;
    anchors?: number;
    lightning_protection?: number;
    roof_hatch?: number;
    cupola?: number;
    dormers?: number;
    satellite_dish?: number;
    antenna?: number;
    condensers?: number;
    exhaust_fans?: number;
    ductwork_lf?: number;
    solar_water_heater?: number;
    sun_tunnels?: number;
    heat_cable_lf?: number;
    lights?: number;
    cameras?: number;
    other?: string;
  };
  /** @deprecated retired into `accessories` — kept so old sheets still read. */
  hardware: {
    satellite_dish?: number;
    antenna?: number;
    snow_guards?: number;
    heat_cable_lf?: number;
    anchors?: number;
    lights?: number;
    cameras?: number;
    other?: string;
  };
  /** Per-elevation exterior takeoff, keyed by elevation ("front" | "right" | ...). */
  exterior?: Record<string, CbExteriorArea>;
  /** Per-room interior takeoff, keyed by room id. */
  interior?: Record<string, CbInteriorArea>;
  notes?: string;
}

export const CB_EMPTY_SHEET: CbSheet = {
  roof_system: {},
  decking: {},
  underlayment: {},
  flashing: {},
  chimney: {},
  ventilation: {},
  penetrations: {},
  skylights: [],
  flat_roof: {},
  insulation: {},
  edge_metal: {},
  solar: {},
  gutters: {},
  accessories: {},
  hardware: {},
  exterior: {},
  interior: {},
  notes: "",
};

/** Take the first defined value — used to carry legacy fields into their new section. */
function firstOf<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && (v as unknown) !== "") return v;
  return undefined;
}

export function readSheet(data: Record<string, unknown> | undefined | null): CbSheet {
  const raw = ((data ?? {}) as Record<string, unknown>).sheet as Partial<CbSheet> | undefined;
  const rs = { ...(raw?.roof_system ?? {}) };
  const fl = { ...(raw?.flashing ?? {}) };
  const hw = { ...(raw?.hardware ?? {}) };
  const decking = { ...(raw?.decking ?? {}) };
  const chimney = { ...(raw?.chimney ?? {}) };
  const accessories = { ...(raw?.accessories ?? {}) };

  return {
    ...CB_EMPTY_SHEET,
    ...(raw ?? {}),
    roof_system: rs,
    /* legacy: decking used to live on roof_system */
    decking: {
      ...decking,
      type: firstOf(decking.type, rs.decking_type),
      condition: firstOf(decking.condition, rs.decking_condition),
    },
    underlayment: { ...(raw?.underlayment ?? {}) },
    flashing: fl,
    /* legacy: chimney used to live inside flashing */
    chimney: {
      ...chimney,
      count: firstOf(chimney.count, fl.chimney_count),
      size: firstOf(chimney.size, fl.chimney_size),
      cricket: firstOf(chimney.cricket, fl.cricket),
    },
    ventilation: { ...(raw?.ventilation ?? {}) },
    penetrations: { ...(raw?.penetrations ?? {}) },
    skylights: Array.isArray(raw?.skylights) ? raw!.skylights! : [],
    flat_roof: { ...(raw?.flat_roof ?? {}) },
    insulation: { ...(raw?.insulation ?? {}) },
    edge_metal: { ...(raw?.edge_metal ?? {}) },
    solar: { ...(raw?.solar ?? {}) },
    gutters: { ...(raw?.gutters ?? {}) },
    /* legacy: the old "Roof hardware" section is now Accessories */
    accessories: {
      ...accessories,
      satellite_dish: firstOf(accessories.satellite_dish, hw.satellite_dish),
      antenna: firstOf(accessories.antenna, hw.antenna),
      snow_guards: firstOf(accessories.snow_guards, hw.snow_guards),
      heat_cable_lf: firstOf(accessories.heat_cable_lf, hw.heat_cable_lf),
      anchors: firstOf(accessories.anchors, hw.anchors),
      lights: firstOf(accessories.lights, hw.lights),
      cameras: firstOf(accessories.cameras, hw.cameras),
      other: firstOf(accessories.other, hw.other),
    },
    hardware: hw,
    exterior: { ...(raw?.exterior ?? {}) },
    interior: { ...(raw?.interior ?? {}) },
    notes: raw?.notes ?? "",
  };
}



/* ---------------- ventilation math ---------------- */

/** Net free area contributed per unit, in square inches. */
const NFA = {
  ridge_vent_lf: 18,
  box_vent_qty: 50,
  turbine_qty: 118,
  power_vent_qty: 300,
  solar_fan_qty: 250,
  soffit_vent_lf: 9,
  gable_vent_qty: 60,
} as const;

export interface CbVentResult {
  atticSqft: number;
  requiredNfa: number;
  providedNfa: number;
  intakeNfa: number;
  exhaustNfa: number;
  deficit: number;
  under: boolean;
  recommendation: string | null;
}

/**
 * 1/150 rule: 1 sq ft of net free area per 150 sq ft of attic floor.
 * Attic floor is approximated from the roof area divided by the pitch factor.
 */
export function computeVentilation(
  vent: CbSheet["ventilation"],
  squares: number,
  pitch: string | null | undefined,
): CbVentResult {
  const rise = Number(String(pitch ?? "6/12").split("/")[0]) || 6;
  const pitchFactor = Math.sqrt(rise * rise + 144) / 12;
  const atticSqft = Math.round(((squares || 0) * 100) / (pitchFactor || 1));
  const requiredNfa = Math.round((atticSqft / 150) * 144);

  const exhaustNfa =
    (vent.ridge_vent_lf ?? 0) * NFA.ridge_vent_lf +
    (vent.box_vent_qty ?? 0) * NFA.box_vent_qty +
    (vent.turbine_qty ?? 0) * NFA.turbine_qty +
    (vent.power_vent_qty ?? 0) * NFA.power_vent_qty +
    (vent.solar_fan_qty ?? 0) * NFA.solar_fan_qty +
    (vent.gable_vent_qty ?? 0) * NFA.gable_vent_qty;
  const intakeNfa = (vent.soffit_vent_lf ?? 0) * NFA.soffit_vent_lf;
  const providedNfa = Math.round(exhaustNfa + intakeNfa);
  const deficit = Math.max(0, requiredNfa - providedNfa);
  const under = atticSqft > 0 && providedNfa < requiredNfa;

  return {
    atticSqft,
    requiredNfa,
    providedNfa,
    intakeNfa: Math.round(intakeNfa),
    exhaustNfa: Math.round(exhaustNfa),
    deficit,
    under,
    recommendation: under
      ? `Existing ventilation is below code-required NFA for this attic area — ${providedNfa.toLocaleString()} sq in provided against ${requiredNfa.toLocaleString()} sq in required (${deficit.toLocaleString()} sq in short).`
      : null,
  };
}

/* ---------------- completeness ---------------- */

export interface CbSectionScore {
  key: string;
  label: string;
  filled: number;
  total: number;
  pct: number;
}

function count(values: unknown[]): { filled: number; total: number } {
  let filled = 0;
  for (const v of values) {
    if (v === undefined || v === null || v === "" ) continue;
    if (typeof v === "number" && Number.isNaN(v)) continue;
    filled += 1;
  }
  return { filled, total: values.length };
}

export function scoreSheet(sheet: CbSheet, squares: number): CbSectionScore[] {
  const rs = sheet.roof_system;
  const dk = sheet.decking;
  const ul = sheet.underlayment;
  const fl = sheet.flashing;
  const ch = sheet.chimney;
  const vt = sheet.ventilation;
  const pen = sheet.penetrations;
  const fr = sheet.flat_roof;
  const ins = sheet.insulation;
  const em = sheet.edge_metal;
  const gu = sheet.gutters;
  const ac = sheet.accessories;

  const sections: { key: string; label: string; vals: unknown[] }[] = [
    {
      key: "roof_system",
      label: "Roof system",
      vals: [rs.roof_type, rs.stories, rs.pitch, rs.layers],
    },
    { key: "measurements", label: "Measurements", vals: [squares > 0 ? squares : undefined] },
    {
      key: "decking",
      label: "Decking",
      vals: [dk.type, dk.thickness, dk.condition, dk.renail ? 1 : undefined],
    },
    {
      key: "underlayment",
      label: "Underlayment",
      vals: [ul.type, ul.layers, ul.ice_water_lf],
    },
    {
      key: "flashing",
      label: "Flashing",
      vals: [fl.roof_to_wall_lf, fl.step_flashing_lf, fl.counterflashing_lf, fl.material],
    },
    {
      key: "chimney",
      label: "Chimney",
      vals: [ch.count, ch.size ?? ch.material, ch.flashing_type ?? ch.action],
    },
    {
      key: "ventilation",
      label: "Ventilation",
      vals: [
        vt.ridge_vent_lf ?? vt.box_vent_qty ?? vt.turbine_qty ?? vt.power_vent_qty ?? vt.solar_fan_qty,
        vt.soffit_vent_lf,
      ],
    },
    {
      key: "penetrations",
      label: "Penetrations",
      vals: [
        pen.pipe_1_5 ?? pen.pipe_2 ?? pen.pipe_3 ?? pen.pipe_4 ?? pen.pipe_6 ?? pen.pipe_8,
        pen.exhaust_vents ?? pen.kitchen_vents ?? pen.bath_vents,
      ],
    },
    { key: "skylights", label: "Skylights", vals: [sheet.skylights.length > 0 ? 1 : undefined] },
    {
      key: "flat_roof",
      label: "Flat / low-slope roof",
      vals: fr.present
        ? [fr.area_sf, fr.membrane, fr.attachment, fr.drains ?? fr.scuppers]
        : [fr.present === false ? 1 : undefined],
    },
    {
      key: "insulation",
      label: "Insulation",
      vals: ins.none ? [1] : [ins.type, ins.thickness_in, ins.r_value, ins.layers],
    },
    {
      key: "edge_metal",
      label: "Edge metal",
      vals: [em.drip_edge_lf, em.rake_edge_lf, em.valley_metal_lf ?? em.ridge_cap_lf, em.material],
    },
    { key: "solar", label: "Solar", vals: [sheet.solar.panel_count] },
    { key: "gutters", label: "Gutters", vals: [gu.size, gu.material, gu.lf, gu.downspout_qty] },
    {
      key: "accessories",
      label: "Accessories",
      vals: [
        ac.walkway_pads ??
          ac.snow_guards ??
          ac.anchors ??
          ac.satellite_dish ??
          ac.antenna ??
          ac.condensers ??
          ac.sun_tunnels ??
          ac.other,
      ],
    },
    { key: "notes", label: "Roof notes", vals: [sheet.notes] },
  ];


  /* exterior and interior only count once that scope has been walked */
  for (const [elev, area] of Object.entries(sheet.exterior ?? {})) {
    sections.push({
      key: `exterior_${elev}`,
      label: `${elev[0]?.toUpperCase()}${elev.slice(1)} exterior takeoff`,
      vals: [area.siding_type, area.siding_sqft, area.windows_qty, area.fascia_lf ?? area.soffit_lf],
    });
  }
  for (const [roomId, area] of Object.entries(sheet.interior ?? {})) {
    sections.push({
      key: `interior_${roomId}`,
      label: "Room takeoff",
      vals: [area.ceiling_sqft, area.wall_sqft, area.flooring_sqft, area.drywall_sqft],
    });
  }


  return sections.map((s) => {
    const { filled, total } = count(s.vals);
    return { key: s.key, label: s.label, filled, total, pct: total ? Math.round((filled / total) * 100) : 0 };
  });
}

export function overallCompleteness(scores: CbSectionScore[]): number {
  const total = scores.reduce((a, s) => a + s.total, 0);
  const filled = scores.reduce((a, s) => a + s.filled, 0);
  return total ? Math.round((filled / total) * 100) : 0;
}
