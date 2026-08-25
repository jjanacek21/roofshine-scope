/**
 * Claim Buddy damage report model.
 *
 * The report is a snapshot: line items, narrative and ventilation math are
 * computed once at generation time and written into cb_reports, so editing the
 * takeoff later never rewrites a report that has already gone to a carrier.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CbAiReport } from "@/lib/cbReportAi";
import { computeVentilation, readSheet, type CbSheet, type CbVentResult } from "@/lib/cbSheet";
import {
  CB_ELEVATIONS,
  CB_ELEVATION_LABEL,
  type CbElevation,
  type CbElevationState,
  type CbItemEntry,
  type CbRoom,
} from "@/lib/cbTakeoff";

export interface CbReportPhoto {
  id: string;
  category: string;
  elevation: string | null;
  shot_type: string | null;
  item_key: string | null;
  caption: string | null;
  storage_path: string;
  thumb_path: string | null;
  sort_order: number;
  taken_at: string | null;
}

/** Pick the best saved image available for the report cover. */
export function resolveReportCover<
  T extends { category: string | null; shot_type: string | null; storage_path: string | null },
>(
  photos: T[],
  coverPath?: string | null,
): T | null {
  return (
    photos.find((photo) => !!coverPath && photo.storage_path === coverPath) ??
    photos.find((photo) => photo.category === "cover") ??
    photos.find((photo) => photo.shot_type === "overview" || photo.shot_type === "wide") ??
    photos[0] ??
    null
  );
}

/**
 * The report hero is the front-elevation wide shot only. With no such photo the
 * hero is omitted entirely rather than falling back to an arbitrary image.
 */
export function resolveFrontElevation<
  T extends { category: string | null; elevation?: string | null; shot_type: string | null; storage_path: string | null },
>(photos: T[], coverPath?: string | null): T | null {
  return (
    photos.find((p) => !!coverPath && p.storage_path === coverPath) ??
    photos.find((p) => p.elevation === "front" && (p.shot_type === "wide" || p.shot_type === "overview")) ??
    photos.find((p) => p.category === "cover") ??
    null
  );
}

export interface CbLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  note?: string;
  photo_ids: string[];
  /** where the line came from: measurement math or a checked takeoff item */
  source: "measurement" | "takeoff" | "ventilation" | "manual";
}

export interface CbNarrative {
  summary: string;
  /** AI-written, rep-edited report body used by the print template. */
  ai?: CbAiReport;
  profile_note?: string;
  roof_note?: string;
  exterior_note?: string;
  interior_note?: string;
  scope_note?: string;
  statement: string;
}

export const CB_STATEMENT =
  "This report documents conditions observed at the property on the inspection date listed above. " +
  "It is a record of observation and a recommended scope of repair — it is not a determination of insurance coverage. " +
  "The carrier makes the coverage decision. The contractor preparing this report is a licensed contractor, not a public adjuster, " +
  "and does not negotiate, adjust or settle claims on the policyholder's behalf.";

/* ------------------------------------------------------------------ */
/* narrative                                                           */
/* ------------------------------------------------------------------ */

export function buildSummary(args: {
  job: { address?: string | null; carrier?: string | null; date_of_loss?: string | null } | null;
  sheet: CbSheet;
  squares: number;
  elevations: Partial<Record<CbElevation, CbElevationState>>;
  rooms: CbRoom[];
  vent: CbVentResult;
}): string {
  const { job, sheet, squares, elevations, rooms, vent } = args;
  const roofType = sheet.roof_system.roof_type ?? "existing roof covering";
  const pitch = sheet.roof_system.pitch ? ` on a ${sheet.roof_system.pitch} pitch` : "";
  const layers = sheet.roof_system.layers ? `${sheet.roof_system.layers}` : "1";

  const damaged = CB_ELEVATIONS.filter((e) => Object.keys(elevations[e]?.items ?? {}).length > 0);
  const cleared = CB_ELEVATIONS.filter(
    (e) => (elevations[e]?.done || elevations[e]?.wide) && Object.keys(elevations[e]?.items ?? {}).length === 0,
  );
  const hits = CB_ELEVATIONS.reduce(
    (n, e) => n + (elevations[e]?.testSquares ?? []).reduce((a, t) => a + (t.hits ?? 0), 0),
    0,
  );

  const s: string[] = [];
  s.push(
    `An inspection of the property at ${job?.address ?? "the subject address"} was performed to document storm-related damage` +
      `${job?.date_of_loss ? ` reported to have occurred on ${job.date_of_loss}` : ""}.`,
  );
  s.push(
    `The structure is covered with ${String(roofType).toLowerCase()}${pitch}, ${layers} layer${layers === "1" ? "" : "s"}, ` +
      `with approximately ${squares.toFixed(1)} squares of roof area measured.`,
  );
  if (hits > 0) {
    s.push(
      `Chalked test squares were performed on the accessible slopes and returned ${hits} identified impact${hits === 1 ? "" : "s"}, ` +
        `consistent with hail of a size capable of functional damage to the roof covering.`,
    );
  } else {
    s.push("Accessible slopes were walked and documented with wide, medium and close-up photography.");
  }
  if (damaged.length > 0) {
    s.push(
      `Damage was observed on the ${damaged.map((e) => CB_ELEVATION_LABEL[e].toLowerCase()).join(", ")} ` +
        `elevation${damaged.length === 1 ? "" : "s"}${cleared.length > 0 ? `; the ${cleared.map((e) => CB_ELEVATION_LABEL[e].toLowerCase()).join(", ")} elevation${cleared.length === 1 ? " was" : "s were"} inspected with no damage observed` : ""}.`,
    );
  }
  if (rooms.length > 0) {
    s.push(
      `Interior documentation was captured in ${rooms.length} room${rooms.length === 1 ? "" : "s"}, including moisture readings where water intrusion was suspected.`,
    );
  }
  if (vent.under) {
    s.push(
      "Existing ventilation is below the code-required net free area for this attic area and is addressed in the recommended scope.",
    );
  }
  s.push(
    `The recommended scope of work below reflects a full replacement of the damaged components as documented${job?.carrier ? ` and is submitted for ${job.carrier}'s review` : ""}.`,
  );
  return s.slice(0, 6).join(" ");
}

/* ------------------------------------------------------------------ */
/* scope of work                                                       */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10);

function photosFor(photos: CbReportPhoto[], match: (p: CbReportPhoto) => boolean): string[] {
  return photos.filter(match).map((p) => p.id);
}

export function buildLineItems(args: {
  measurement: Record<string, number | string | null> | null;
  sheet: CbSheet;
  elevations: Partial<Record<CbElevation, CbElevationState>>;
  roofHardware?: Record<string, CbItemEntry>;
  rooms: CbRoom[];
  photos: CbReportPhoto[];
  vent: CbVentResult;
  itemLabels: Record<string, { label: string; unit: string | null }>;
}): CbLineItem[] {
  const { measurement, sheet, elevations, rooms, photos, vent, itemLabels } = args;
  const roofHardware = args.roofHardware ?? {};
  const m = (k: string) => Number(measurement?.[k] ?? 0) || 0;
  const out: CbLineItem[] = [];
  const push = (
    description: string,
    quantity: number,
    unit: string,
    source: CbLineItem["source"],
    photo_ids: string[] = [],
    note?: string,
  ) => {
    if (!(quantity > 0)) return;
    out.push({ id: uid(), description, quantity: Math.round(quantity * 100) / 100, unit, source, photo_ids, note });
  };

  const squares = m("total_squares");
  const layers = sheet.roof_system.layers ?? 1;
  const roofType = sheet.roof_system.roof_type ?? "asphalt shingle";
  const roofPhotos = photosFor(photos, (p) => p.category === "roof");

  /* roof system */
  push(
    `Tear off existing ${String(roofType).toLowerCase()} roofing — ${layers} layer${layers === 1 ? "" : "s"}, haul and dispose`,
    squares * layers,
    "SQ",
    "measurement",
    roofPhotos.slice(0, 4),
  );
  push(`Install new ${String(roofType).toLowerCase()} roofing, including waste`, squares, "SQ", "measurement");
  push("Synthetic underlayment", squares, "SQ", "measurement");
  push("Ice & water shield — eaves and valleys", m("eave_lf") + m("valley_lf"), "LF", "measurement");
  push("Starter course — eaves and rakes", m("eave_lf") + m("rake_lf"), "LF", "measurement");
  push("Hip & ridge cap shingles", m("ridge_cap_lf") || m("ridge_lf") + m("hip_lf"), "LF", "measurement");
  push("Drip edge", m("drip_edge_lf") || m("eave_lf") + m("rake_lf"), "LF", "measurement");
  push("Valley metal / closed valley detail", m("valley_lf"), "LF", "measurement");
  if (sheet.roof_system.decking_condition === "Soft / rotted areas") {
    push("Replace deteriorated roof decking (allowance — verify at tear-off)", 3, "SHT", "takeoff");
  }

  /* flashing */
  push("Roof-to-wall flashing", sheet.flashing.roof_to_wall_lf ?? m("wall_flashing_lf"), "LF", "takeoff");
  push("Step flashing", sheet.flashing.step_flashing_lf ?? m("step_flashing_lf"), "LF", "takeoff");
  push("Counterflashing", sheet.flashing.counterflashing_lf ?? 0, "LF", "takeoff");
  push(
    `Chimney flashing kit${sheet.flashing.chimney_size ? ` — ${sheet.flashing.chimney_size}` : ""}`,
    sheet.flashing.chimney_count ?? 0,
    "EA",
    "takeoff",
    photosFor(photos, (p) => p.item_key === "chimney"),
  );
  if (sheet.flashing.cricket) push("Chimney cricket / saddle", 1, "EA", "takeoff");

  /* penetrations */
  const pens: [string, number | undefined, string][] = [
    ['Pipe jack flashing — 1.5"', sheet.penetrations.pipe_1_5, "EA"],
    ['Pipe jack flashing — 2"', sheet.penetrations.pipe_2, "EA"],
    ['Pipe jack flashing — 3"', sheet.penetrations.pipe_3, "EA"],
    ['Pipe jack flashing — 4"', sheet.penetrations.pipe_4, "EA"],
    ["Lead boot", sheet.penetrations.lead_boots, "EA"],
    ["Split boot", sheet.penetrations.split_boots, "EA"],
    ["Furnace cap", sheet.penetrations.furnace_caps, "EA"],
    ["Storm collar", sheet.penetrations.storm_collars, "EA"],
    ["Exhaust vent", sheet.penetrations.exhaust_vents, "EA"],
    ["Kitchen vent", sheet.penetrations.kitchen_vents, "EA"],
    ["Bath vent", sheet.penetrations.bath_vents, "EA"],
    ["A/C line set cover", sheet.penetrations.lineset_covers, "EA"],
  ];
  for (const [label, qty, unit] of pens) push(label, qty ?? 0, unit, "takeoff");

  /* ventilation — existing and the corrective recommendation */
  push("Ridge vent — detach & reset / replace", sheet.ventilation.ridge_vent_lf ?? 0, "LF", "takeoff");
  push("Box / turtle vent", sheet.ventilation.box_vent_qty ?? 0, "EA", "takeoff");
  push("Turbine vent", sheet.ventilation.turbine_qty ?? 0, "EA", "takeoff");
  push("Power vent", sheet.ventilation.power_vent_qty ?? 0, "EA", "takeoff");
  push("Solar attic fan", sheet.ventilation.solar_fan_qty ?? 0, "EA", "takeoff");
  push("Soffit vent", sheet.ventilation.soffit_vent_lf ?? 0, "LF", "takeoff");
  push("Gable vent", sheet.ventilation.gable_vent_qty ?? 0, "EA", "takeoff");
  if (vent.under && vent.deficit > 0) {
    push(
      "Additional exhaust ventilation to meet code-required net free area",
      Math.ceil(vent.deficit / 18),
      "LF",
      "ventilation",
      [],
      `Existing ventilation is below code-required NFA for this attic area — ${vent.providedNfa} sq in provided against ${vent.requiredNfa} sq in required.`,
    );
  }

  /* skylights, solar, gutters, hardware */
  for (const sk of sheet.skylights ?? []) {
    push(
      `Skylight — ${sk.type || "fixed"}${sk.size ? ` ${sk.size}` : ""}${sk.flashing_kit ? ", with flashing kit" : ""}`,
      sk.qty || 1,
      "EA",
      "takeoff",
      photosFor(photos, (p) => p.item_key === "skylight"),
    );
  }
  if (sheet.solar.detach_reset)
    push("Detach & reset solar panel array", sheet.solar.panel_count ?? 0, "EA", "takeoff");
  push(
    `Gutter — ${sheet.gutters.size ?? "5 inch"} ${sheet.gutters.material ?? "aluminum"}`,
    sheet.gutters.lf ?? m("gutter_lf"),
    "LF",
    "takeoff",
    photosFor(photos, (p) => p.item_key?.includes("gutter") ?? false),
  );
  push("Downspout", sheet.gutters.downspout_qty ?? 0, "EA", "takeoff");
  if (sheet.gutters.guards) push("Gutter guard", sheet.gutters.lf ?? 0, "LF", "takeoff");
  const hw: [string, number | undefined, string][] = [
    ["Detach & reset satellite dish", sheet.hardware.satellite_dish, "EA"],
    ["Detach & reset antenna", sheet.hardware.antenna, "EA"],
    ["Snow guard", sheet.hardware.snow_guards, "EA"],
    ["Heat cable", sheet.hardware.heat_cable_lf, "LF"],
    ["Roof anchor", sheet.hardware.anchors, "EA"],
    ["Detach & reset roof light", sheet.hardware.lights, "EA"],
    ["Detach & reset camera", sheet.hardware.cameras, "EA"],
  ];
  for (const [label, qty, unit] of hw) push(label, qty ?? 0, unit, "takeoff");

  /* exterior damage from the walks */
  for (const e of CB_ELEVATIONS) {
    const items = elevations[e]?.items ?? {};
    for (const [key, entry] of Object.entries(items)) {
      const meta = itemLabels[key];
      push(
        `${meta?.label ?? key} — ${CB_ELEVATION_LABEL[e]} elevation`,
        Number(entry.qty ?? 0) || 1,
        meta?.unit ?? "EA",
        "takeoff",
        photosFor(photos, (p) => p.item_key === key && p.elevation === e),
        entry.note,
      );
    }
    const roofItems = elevations[e]?.roofItems ?? {};
    for (const [key, entry] of Object.entries(roofItems)) {
      const meta = itemLabels[key];
      push(
        `${meta?.label ?? key} — ${CB_ELEVATION_LABEL[e]} elevation`,
        Number(entry.qty ?? 0) || 1,
        meta?.unit ?? "EA",
        "takeoff",
        photosFor(photos, (p) => p.item_key === key && p.elevation === e),
        entry.note,
      );
    }
  }

  /* roof hardware & accessories — one job-level list, not per slope */
  for (const [key, entry] of Object.entries(roofHardware)) {
    const meta = itemLabels[key];
    push(
      `${meta?.label ?? key} — roof`,
      Number(entry.qty ?? 0) || 1,
      meta?.unit ?? "EA",
      "takeoff",
      photosFor(photos, (p) => p.item_key === key),
      entry.note,
    );
  }

  /* interior */
  for (const room of rooms) {
    for (const [key, entry] of Object.entries(room.items ?? {})) {
      const meta = itemLabels[key];
      push(
        `${meta?.label ?? key} — ${room.name}`,
        Number(entry.qty ?? 0) || 1,
        meta?.unit ?? "EA",
        "takeoff",
        photosFor(photos, (p) => p.item_key === key),
        entry.note,
      );
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* assembly                                                            */
/* ------------------------------------------------------------------ */

export interface CbReportBundle {
  job: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  measurement: Record<string, never> | null;
  takeoff: { data: Record<string, unknown>; elevations: Record<string, unknown> } | null;
  photos: CbReportPhoto[];
}

/** Everything the report needs, in one round trip. */
export async function loadReportInputs(jobId: string) {
  const { data: job } = await supabase.from("cb_jobs").select("*").eq("id", jobId).maybeSingle();
  const [{ data: company }, { data: measurement }, { data: takeoff }, { data: photos }, { data: catalog }] =
    await Promise.all([
      job?.company_id
        ? supabase.from("cb_companies").select("*").eq("id", job.company_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("cb_measurements").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("cb_takeoffs").select("data, elevations, completeness").eq("job_id", jobId).maybeSingle(),
      supabase
        .from("cb_photos")
        .select("id, category, elevation, shot_type, item_key, caption, storage_path, thumb_path, sort_order, taken_at")
        .eq("job_id", jobId)
        .order("sort_order", { ascending: true }),
      supabase.from("cb_item_catalog").select("item_key, label, unit"),
    ]);

  const itemLabels: Record<string, { label: string; unit: string | null }> = {};
  for (const row of (catalog ?? []) as { item_key: string; label: string; unit: string | null }[]) {
    itemLabels[row.item_key] = { label: row.label, unit: row.unit };
  }

  return {
    job: job as Record<string, unknown> | null,
    company: company as Record<string, unknown> | null,
    measurement: measurement as Record<string, number | string | null> | null,
    takeoff: takeoff as { data: Record<string, unknown>; elevations: Record<string, unknown> } | null,
    photos: (photos ?? []) as CbReportPhoto[],
    itemLabels,
  };
}

/** Compute the whole report payload from the raw inputs. */
export function composeReport(inputs: Awaited<ReturnType<typeof loadReportInputs>>) {
  const takeoffData = (inputs.takeoff?.data ?? {}) as Record<string, unknown>;
  const sheet = readSheet(takeoffData);
  const rooms = (takeoffData.rooms as CbRoom[]) ?? [];
  const elevations = (inputs.takeoff?.elevations ?? {}) as Partial<Record<CbElevation, CbElevationState>>;
  const squares = Number(inputs.measurement?.total_squares ?? 0) || 0;
  const vent = computeVentilation(sheet.ventilation, squares, sheet.roof_system.pitch ?? String(inputs.measurement?.pitch ?? "6/12"));

  const narrative: CbNarrative = {
    summary: buildSummary({
      job: inputs.job as never,
      sheet,
      squares,
      elevations,
      rooms,
      vent,
    }),
    statement: CB_STATEMENT,
  };

  const line_items = buildLineItems({
    measurement: inputs.measurement,
    sheet,
    elevations,
    roofHardware: (takeoffData.roofHardware ?? {}) as Record<string, CbItemEntry>,
    rooms,
    photos: inputs.photos,
    vent,
    itemLabels: inputs.itemLabels,
  });

  return { sheet, rooms, elevations, squares, vent, narrative, line_items };
}

/** Insert a new version — never overwrite an existing one. */
export async function insertReportVersion(
  jobId: string,
  payload: { narrative: CbNarrative; line_items: CbLineItem[]; ventilation: CbVentResult },
) {
  const { data: last } = await supabase
    .from("cb_reports")
    .select("version")
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cb_reports")
    .insert({
      job_id: jobId,
      version,
      narrative: payload.narrative as never,
      line_items: payload.line_items as never,
      ventilation: payload.ventilation as never,
      generated_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("cb_jobs").update({ status: "report_ready" }).eq("id", jobId);
  return data;
}

export const CB_PHOTO_CATEGORY_LABEL: Record<string, string> = {
  cover: "Cover",
  exterior: "Exterior",
  roof: "Roof",
  interior: "Interior",
  other: "Other",
};
