/**
 * The only takeoff fields voice mode is allowed to write.
 *
 * A whitelist, not a convenience. The model is told to fill this schema and
 * nothing else, and the server drops anything outside it before it reaches the
 * sheet — so a mis-heard sentence can produce a wrong number, but it can never
 * invent a field, and it can never reach the parts of the sheet a rep filled by
 * hand for a reason.
 *
 * `unit` is what the rep is expected to say out loud, and it is what the review
 * list shows back to them. `label` is the wording on the takeoff screen, so the
 * review list and the sheet cannot drift apart.
 */
export type CbVoiceKind = "number" | "boolean" | "text";

export interface CbVoiceField {
  /** Group on CbSheet, e.g. "ventilation". */
  group: string;
  /** Key within that group, e.g. "ridge_vent_lf". */
  field: string;
  label: string;
  kind: CbVoiceKind;
  unit?: string;
  /** Words a rep actually uses, to steer the match. */
  says?: string;
}

export const CB_VOICE_FIELDS: CbVoiceField[] = [
  /* roof system */
  {
    group: "roof_system",
    field: "stories",
    label: "Stories",
    kind: "number",
    says: "one story, two-story, split level",
  },
  {
    group: "roof_system",
    field: "pitch",
    label: "Pitch",
    kind: "text",
    says: "six twelve, 8/12, steep, walkable",
  },
  {
    group: "roof_system",
    field: "layers",
    label: "Layers",
    kind: "number",
    says: "one layer, two layers, double layer",
  },
  {
    group: "roof_system",
    field: "roof_type",
    label: "Roof type",
    kind: "text",
    says: "three tab, architectural, tile, metal",
  },

  /* decking */
  {
    group: "decking",
    field: "condition",
    label: "Decking condition",
    kind: "text",
    says: "soft spots, rotted, solid",
  },
  { group: "decking", field: "renail", label: "Deck needs re-nail", kind: "boolean" },
  {
    group: "decking",
    field: "sheets_to_replace",
    label: "Decking sheets to replace",
    kind: "number",
    unit: "sheets",
  },

  /* ventilation */
  { group: "ventilation", field: "ridge_vent_lf", label: "Ridge vent", kind: "number", unit: "LF" },
  { group: "ventilation", field: "box_vent_qty", label: "Box vents", kind: "number", unit: "EA" },
  { group: "ventilation", field: "turbine_qty", label: "Turbines", kind: "number", unit: "EA" },
  {
    group: "ventilation",
    field: "power_vent_qty",
    label: "Power vents",
    kind: "number",
    unit: "EA",
  },
  {
    group: "ventilation",
    field: "soffit_vent_lf",
    label: "Soffit vent",
    kind: "number",
    unit: "LF",
  },
  {
    group: "ventilation",
    field: "gable_vent_qty",
    label: "Gable vents",
    kind: "number",
    unit: "EA",
  },

  /* penetrations */
  {
    group: "penetrations",
    field: "pipe_1_5",
    label: 'Pipe jacks 1.5"',
    kind: "number",
    unit: "EA",
  },
  { group: "penetrations", field: "pipe_2", label: 'Pipe jacks 2"', kind: "number", unit: "EA" },
  {
    group: "penetrations",
    field: "pipe_3",
    label: 'Pipe jacks 3"',
    kind: "number",
    unit: "EA",
    says: "pipe jacks, plumbing stacks, boots",
  },
  { group: "penetrations", field: "pipe_4", label: 'Pipe jacks 4"', kind: "number", unit: "EA" },
  { group: "penetrations", field: "lead_boots", label: "Lead boots", kind: "number", unit: "EA" },
  { group: "penetrations", field: "bath_vents", label: "Bath vents", kind: "number", unit: "EA" },
  {
    group: "penetrations",
    field: "kitchen_vents",
    label: "Kitchen vents",
    kind: "number",
    unit: "EA",
  },
  {
    group: "penetrations",
    field: "exhaust_vents",
    label: "Exhaust vents",
    kind: "number",
    unit: "EA",
  },

  /* edge metal */
  { group: "edge_metal", field: "drip_edge_lf", label: "Drip edge", kind: "number", unit: "LF" },
  { group: "edge_metal", field: "rake_edge_lf", label: "Rake edge", kind: "number", unit: "LF" },
  {
    group: "edge_metal",
    field: "valley_metal_lf",
    label: "Valley metal",
    kind: "number",
    unit: "LF",
  },
  { group: "edge_metal", field: "ridge_cap_lf", label: "Ridge cap", kind: "number", unit: "LF" },
  { group: "edge_metal", field: "starter_lf", label: "Starter course", kind: "number", unit: "LF" },
  {
    group: "edge_metal",
    field: "fascia_metal_lf",
    label: "Fascia metal",
    kind: "number",
    unit: "LF",
  },

  /* flashing */
  {
    group: "flashing",
    field: "roof_to_wall_lf",
    label: "Roof-to-wall flashing",
    kind: "number",
    unit: "LF",
  },
  {
    group: "flashing",
    field: "step_flashing_lf",
    label: "Step flashing",
    kind: "number",
    unit: "LF",
  },
  {
    group: "flashing",
    field: "counterflashing_lf",
    label: "Counterflashing",
    kind: "number",
    unit: "LF",
  },

  /* chimney */
  { group: "chimney", field: "count", label: "Chimneys", kind: "number", unit: "EA" },
  { group: "chimney", field: "cricket", label: "Chimney cricket", kind: "boolean" },

  /* underlayment */
  {
    group: "underlayment",
    field: "ice_water_lf",
    label: "Ice & water",
    kind: "number",
    unit: "LF",
  },
  {
    group: "underlayment",
    field: "secondary_water_barrier",
    label: "Secondary water barrier",
    kind: "boolean",
  },

  /* gutters */
  { group: "gutters", field: "lf", label: "Gutters", kind: "number", unit: "LF" },
  { group: "gutters", field: "downspout_qty", label: "Downspouts", kind: "number", unit: "EA" },
  {
    group: "gutters",
    field: "size",
    label: "Gutter size",
    kind: "text",
    says: "five inch, six inch, K style, half round",
  },

  /* solar + accessories */
  { group: "solar", field: "panel_count", label: "Solar panels", kind: "number", unit: "EA" },
  { group: "solar", field: "detach_reset", label: "Solar detach & reset", kind: "boolean" },
  {
    group: "accessories",
    field: "satellite_dish",
    label: "Satellite dish",
    kind: "number",
    unit: "EA",
  },
  { group: "accessories", field: "dormers", label: "Dormers", kind: "number", unit: "EA" },
  {
    group: "accessories",
    field: "walkway_pads",
    label: "Walkway pads",
    kind: "number",
    unit: "EA",
  },
];

/** Fast lookup used by the server to drop anything off-schema. */
export const CB_VOICE_INDEX = new Map(CB_VOICE_FIELDS.map((f) => [`${f.group}.${f.field}`, f]));

/** One line per field, for the model prompt. */
export function cbVoiceSchemaLines(): string {
  return CB_VOICE_FIELDS.map((f) => {
    const bits = [`${f.group}.${f.field}`, f.label, f.kind];
    if (f.unit) bits.push(f.unit);
    if (f.says) bits.push(`heard as: ${f.says}`);
    return `- ${bits.join(" · ")}`;
  }).join("\n");
}
