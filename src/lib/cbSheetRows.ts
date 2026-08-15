/**
 * One list per elevation / slope / room.
 *
 * The damage checklist (cb_item_catalog) and the takeoff sheet
 * (cb_takeoffs.data.sheet) used to be two separate screens asking about the
 * same wall. These builders merge them into a single row list. Rows that mean
 * the same thing collapse into one row that writes BOTH storage targets, so
 * `cbEstimate.ts` keeps reading exactly what it read before.
 */

import type { CbCatalogGroup } from "@/lib/cbCatalog";
import type { CbItemEntry } from "@/lib/cbTakeoff";
import {
  CB_EXTERIOR_FIELDS,
  CB_INTERIOR_FIELDS,
  type CbExteriorArea,
  type CbInteriorArea,
  type CbSheet,
} from "@/lib/cbSheet";

export interface CbRow {
  /** react key + handler identity */
  id: string;
  label: string;
  unit?: string | null;
  group: string;
  /** damage catalog target: elevations[elev].items / roomItems / roofItems */
  catalogKey?: string;
  /** exterior / interior area field */
  fieldKey?: string;
  /** roof sheet target */
  sheetSection?: keyof CbSheet;
  sheetKey?: string;
  /** photo linkage */
  photoKey: string;
  photoCategory: string;
  cameraMode: "pair" | "single";
  /** current state */
  selected: boolean;
  qty?: number | null;
  note?: string;
  photos: number;
  hint?: string;
}

export interface CbRowGroup {
  group_name: string;
  rows: CbRow[];
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(lf|sf|ea|sq|qty|damage|damaged)\b/g, " ")
    .replace(/[^a-z]/g, "");
}

function entryPhotos(entry: CbItemEntry | undefined) {
  return (entry?.medium ?? 0) + (entry?.close ?? 0);
}

function pushGroup(groups: CbRowGroup[], name: string, row: CbRow) {
  let g = groups.find((x) => x.group_name === name);
  if (!g) {
    g = { group_name: name, rows: [] };
    groups.push(g);
  }
  g.rows.push(row);
}

/* ---------------- exterior, per elevation ---------------- */

export function buildExteriorRows(args: {
  catalog: CbCatalogGroup[] | undefined;
  entries: Record<string, CbItemEntry>;
  area: CbExteriorArea;
  photoCounts: Record<string, number>;
  elevationKey: string;
}): CbRowGroup[] {
  const { catalog, entries, area, photoCounts, elevationKey } = args;
  const groups: CbRowGroup[] = [];
  const used = new Set<string>();

  for (const g of catalog ?? []) {
    for (const item of g.items) {
      const field = CB_EXTERIOR_FIELDS.find((f) => norm(f.label) === norm(item.label));
      if (field) used.add(field.key as string);
      const entry = entries[item.item_key];
      const fieldKey = field ? (field.key as string) : undefined;
      const takeoffPhotoKey = fieldKey ? `ext_${elevationKey}_${fieldKey}` : "";
      pushGroup(groups, g.group_name, {
        id: item.item_key,
        label: item.label,
        unit: item.unit ?? field?.unit ?? null,
        group: g.group_name,
        catalogKey: item.item_key,
        fieldKey,
        photoKey: item.item_key,
        photoCategory: "exterior",
        cameraMode: "pair",
        selected: !!entry,
        qty:
          entry?.qty ??
          (fieldKey ? ((area as Record<string, unknown>)[fieldKey] as number | undefined) ?? null : null),
        note: entry?.note,
        photos: entryPhotos(entry) + (takeoffPhotoKey ? photoCounts[takeoffPhotoKey] ?? 0 : 0),
      });
    }
  }

  for (const f of CB_EXTERIOR_FIELDS) {
    const key = f.key as string;
    if (used.has(key)) continue;
    const photoKey = `ext_${elevationKey}_${key}`;
    const value = (area as Record<string, unknown>)[key] as number | undefined;
    pushGroup(groups, "Elevation takeoff", {
      id: `field:${key}`,
      label: f.label,
      unit: f.unit,
      group: "Elevation takeoff",
      fieldKey: key,
      photoKey,
      photoCategory: "takeoff",
      cameraMode: "single",
      selected: value !== undefined && value !== null,
      qty: value ?? null,
      photos: photoCounts[photoKey] ?? 0,
    });
  }

  return groups;
}

/* ---------------- interior, per room ---------------- */

export function buildInteriorRows(args: {
  catalog: CbCatalogGroup[] | undefined;
  entries: Record<string, CbItemEntry>;
  area: CbInteriorArea;
  photoCounts: Record<string, number>;
  roomId: string;
}): CbRowGroup[] {
  const { catalog, entries, area, photoCounts, roomId } = args;
  const groups: CbRowGroup[] = [];
  const used = new Set<string>();

  for (const g of catalog ?? []) {
    for (const item of g.items) {
      const field = CB_INTERIOR_FIELDS.find((f) => norm(f.label) === norm(item.label));
      if (field) used.add(field.key as string);
      const entry = entries[item.item_key];
      const fieldKey = field ? (field.key as string) : undefined;
      const takeoffPhotoKey = fieldKey ? `int_${roomId}_${fieldKey}` : "";
      pushGroup(groups, g.group_name, {
        id: item.item_key,
        label: item.label,
        unit: item.unit ?? field?.unit ?? null,
        group: g.group_name,
        catalogKey: item.item_key,
        fieldKey,
        photoKey: item.item_key,
        photoCategory: "interior",
        cameraMode: "pair",
        selected: !!entry,
        qty:
          entry?.qty ??
          (fieldKey ? ((area as Record<string, unknown>)[fieldKey] as number | undefined) ?? null : null),
        note: entry?.note,
        photos: entryPhotos(entry) + (takeoffPhotoKey ? photoCounts[takeoffPhotoKey] ?? 0 : 0),
      });
    }
  }

  for (const f of CB_INTERIOR_FIELDS) {
    const key = f.key as string;
    if (used.has(key)) continue;
    const photoKey = `int_${roomId}_${key}`;
    const value = (area as Record<string, unknown>)[key] as number | undefined;
    pushGroup(groups, "Room takeoff", {
      id: `field:${key}`,
      label: f.label,
      unit: f.unit,
      group: "Room takeoff",
      fieldKey: key,
      photoKey,
      photoCategory: "takeoff",
      cameraMode: "single",
      selected: value !== undefined && value !== null,
      qty: value ?? null,
      photos: photoCounts[photoKey] ?? 0,
    });
  }

  return groups;
}

/* ---------------- roof ---------------- */

export interface CbRoofQtyField {
  section: keyof CbSheet;
  key: string;
  label: string;
  unit: string;
  itemKey: string;
  group: string;
}

export const CB_ROOF_QTY_FIELDS: CbRoofQtyField[] = [
  { section: "roof_system", key: "layers", label: "Layers", unit: "EA", itemKey: "rs_layers", group: "Roof system" },

  { section: "flashing", key: "roof_to_wall_lf", label: "Roof to wall", unit: "LF", itemKey: "fl_roof_to_wall_lf", group: "Flashing" },
  { section: "flashing", key: "step_flashing_lf", label: "Step flashing", unit: "LF", itemKey: "fl_step_flashing_lf", group: "Flashing" },
  { section: "flashing", key: "counterflashing_lf", label: "Counterflashing", unit: "LF", itemKey: "fl_counterflashing_lf", group: "Flashing" },
  { section: "flashing", key: "chimney_count", label: "Chimneys", unit: "EA", itemKey: "fl_chimney_count", group: "Flashing" },

  { section: "ventilation", key: "ridge_vent_lf", label: "Ridge vent", unit: "LF", itemKey: "vt_ridge_vent_lf", group: "Ventilation" },
  { section: "ventilation", key: "box_vent_qty", label: "Box vents", unit: "EA", itemKey: "vt_box_vent_qty", group: "Ventilation" },
  { section: "ventilation", key: "turbine_qty", label: "Turbines", unit: "EA", itemKey: "vt_turbine_qty", group: "Ventilation" },
  { section: "ventilation", key: "power_vent_qty", label: "Power vents", unit: "EA", itemKey: "vt_power_vent_qty", group: "Ventilation" },
  { section: "ventilation", key: "solar_fan_qty", label: "Solar fans", unit: "EA", itemKey: "vt_solar_fan_qty", group: "Ventilation" },
  { section: "ventilation", key: "soffit_vent_lf", label: "Soffit vent", unit: "LF", itemKey: "vt_soffit_vent_lf", group: "Ventilation" },
  { section: "ventilation", key: "gable_vent_qty", label: "Gable vents", unit: "EA", itemKey: "vt_gable_vent_qty", group: "Ventilation" },

  { section: "penetrations", key: "pipe_1_5", label: 'Pipe jack 1.5"', unit: "EA", itemKey: "pen_pipe_1_5", group: "Penetrations" },
  { section: "penetrations", key: "pipe_2", label: 'Pipe jack 2"', unit: "EA", itemKey: "pen_pipe_2", group: "Penetrations" },
  { section: "penetrations", key: "pipe_3", label: 'Pipe jack 3"', unit: "EA", itemKey: "pen_pipe_3", group: "Penetrations" },
  { section: "penetrations", key: "pipe_4", label: 'Pipe jack 4"', unit: "EA", itemKey: "pen_pipe_4", group: "Penetrations" },
  { section: "penetrations", key: "lead_boots", label: "Lead boots", unit: "EA", itemKey: "pen_lead_boots", group: "Penetrations" },
  { section: "penetrations", key: "split_boots", label: "Split boots", unit: "EA", itemKey: "pen_split_boots", group: "Penetrations" },
  { section: "penetrations", key: "furnace_caps", label: "Furnace caps", unit: "EA", itemKey: "pen_furnace_caps", group: "Penetrations" },
  { section: "penetrations", key: "storm_collars", label: "Storm collars", unit: "EA", itemKey: "pen_storm_collars", group: "Penetrations" },
  { section: "penetrations", key: "exhaust_vents", label: "Exhaust vents", unit: "EA", itemKey: "pen_exhaust_vents", group: "Penetrations" },
  { section: "penetrations", key: "kitchen_vents", label: "Kitchen vents", unit: "EA", itemKey: "pen_kitchen_vents", group: "Penetrations" },
  { section: "penetrations", key: "bath_vents", label: "Bath vents", unit: "EA", itemKey: "pen_bath_vents", group: "Penetrations" },
  { section: "penetrations", key: "lineset_covers", label: "Lineset covers", unit: "EA", itemKey: "pen_lineset_covers", group: "Penetrations" },

  { section: "solar", key: "panel_count", label: "Solar panels", unit: "EA", itemKey: "sol_panel_count", group: "Solar & gutters" },
  { section: "gutters", key: "lf", label: "Gutter", unit: "LF", itemKey: "gu_lf", group: "Solar & gutters" },
  { section: "gutters", key: "downspout_qty", label: "Downspouts", unit: "EA", itemKey: "gu_downspout_qty", group: "Solar & gutters" },

  { section: "hardware", key: "satellite_dish", label: "Satellite dish", unit: "EA", itemKey: "hw_satellite_dish", group: "Roof hardware" },
  { section: "hardware", key: "antenna", label: "Antenna", unit: "EA", itemKey: "hw_antenna", group: "Roof hardware" },
  { section: "hardware", key: "snow_guards", label: "Snow guards", unit: "EA", itemKey: "hw_snow_guards", group: "Roof hardware" },
  { section: "hardware", key: "heat_cable_lf", label: "Heat cable", unit: "LF", itemKey: "hw_heat_cable_lf", group: "Roof hardware" },
  { section: "hardware", key: "anchors", label: "Anchors", unit: "EA", itemKey: "hw_anchors", group: "Roof hardware" },
  { section: "hardware", key: "lights", label: "Lights", unit: "EA", itemKey: "hw_lights", group: "Roof hardware" },
  { section: "hardware", key: "cameras", label: "Cameras", unit: "EA", itemKey: "hw_cameras", group: "Roof hardware" },
];

export function buildRoofRows(args: {
  catalog: CbCatalogGroup[] | undefined;
  entries: Record<string, CbItemEntry>;
  sheet: CbSheet;
  photoCounts: Record<string, number>;
}): CbRowGroup[] {
  const { catalog, entries, sheet, photoCounts } = args;
  const groups: CbRowGroup[] = [];
  const used = new Set<string>();

  const readField = (f: CbRoofQtyField) =>
    ((sheet[f.section] as Record<string, unknown> | undefined)?.[f.key] as number | undefined) ?? null;

  for (const g of catalog ?? []) {
    for (const item of g.items) {
      const field = CB_ROOF_QTY_FIELDS.find((f) => norm(f.label) === norm(item.label));
      if (field) used.add(field.itemKey);
      const entry = entries[item.item_key];
      pushGroup(groups, g.group_name, {
        id: item.item_key,
        label: item.label,
        unit: item.unit ?? field?.unit ?? null,
        group: g.group_name,
        catalogKey: item.item_key,
        sheetSection: field?.section,
        sheetKey: field?.key,
        photoKey: item.item_key,
        photoCategory: "roof",
        cameraMode: "pair",
        selected: !!entry,
        qty: entry?.qty ?? (field ? readField(field) : null),
        note: entry?.note,
        photos: entryPhotos(entry) + (field ? photoCounts[field.itemKey] ?? 0 : 0),
      });
    }
  }

  for (const f of CB_ROOF_QTY_FIELDS) {
    if (used.has(f.itemKey)) continue;
    const value = readField(f);
    pushGroup(groups, f.group, {
      id: `field:${f.itemKey}`,
      label: f.label,
      unit: f.unit,
      group: f.group,
      sheetSection: f.section,
      sheetKey: f.key,
      photoKey: f.itemKey,
      photoCategory: "takeoff",
      cameraMode: "single",
      selected: value !== undefined && value !== null,
      qty: value,
      photos: photoCounts[f.itemKey] ?? 0,
      hint: "Whole roof",
    });
  }

  return groups;
}
