import type { ReactNode } from "react";
import { Camera } from "lucide-react";
import { CbCard, CbBadge } from "@/components/cb/primitives";
import { CbField, CbTextarea } from "@/components/cb/forms";
import { CbReveal, cbHaptic } from "@/components/cb/motion";
import {
  CB_DECKING_CONDITION,
  CB_DECKING_TYPES,
  CB_FLASH_MATERIALS,
  CB_FLOORING_TYPES,
  CB_GUTTER_MATERIALS,
  CB_GUTTER_SIZES,
  CB_ROOF_TYPES,
  CB_SIDING_TYPES,
  CB_EXTERIOR_FIELDS,
  CB_INTERIOR_FIELDS,
  type CbExteriorArea,
  type CbInteriorArea,
  type CbSheet,
} from "@/lib/cbSheet";

/* ---------------- shared building blocks ---------------- */

export function CbSection({
  title,
  hint,
  pct,
  children,
}: {
  title: string;
  hint?: string;
  pct?: number;
  children: ReactNode;
}) {
  return (
    <CbReveal>
      <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
              {title}
            </h2>
            {hint ? (
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {hint}
              </p>
            ) : null}
          </div>
          {typeof pct === "number" ? (
            <CbBadge tone={pct >= 100 ? "success" : pct > 0 ? "accent" : "neutral"}>{pct}%</CbBadge>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">{children}</div>
      </CbCard>
    </CbReveal>
  );
}

export function CbPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="cb-microlabel">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => {
              cbHaptic();
              onChange(o);
            }}
            className={`cb-seg-card ${value === o ? "is-selected" : ""}`}
            style={{ padding: "10px 14px", minHeight: 44 }}
          >
            <span className="cb-seg-title" style={{ fontSize: 13.5 }}>
              {o}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A quantity line with a camera icon that links the photo to this exact item. */
export function CbQtyLine({
  label,
  suffix,
  value,
  onChange,
  itemKey,
  onCamera,
  photos = 0,
}: {
  label: string;
  suffix?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  itemKey: string;
  onCamera: (itemKey: string, label: string) => void;
  photos?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 min-w-0 text-[15px]" style={{ color: "var(--cb-text)" }}>
        <span className="block truncate">{label}</span>
        {suffix ? <span className="cb-microlabel">{suffix}</span> : null}
      </label>
      <input
        className="cb-input cb-num"
        inputMode="decimal"
        style={{ width: 96, height: 48, textAlign: "right", padding: "0 10px" }}
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === "" ? undefined : Number(v));
        }}
      />
      <button
        type="button"
        className={`cb-icon-btn ${photos > 0 ? "is-active" : ""}`}
        aria-label={`Photograph ${label}`}
        onClick={() => {
          cbHaptic();
          onCamera(itemKey, label);
        }}
        style={{
          height: 48,
          width: 48,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--cb-border)",
          background: photos > 0 ? "var(--cb-accent-soft, transparent)" : "transparent",
          color: photos > 0 ? "var(--cb-accent)" : "var(--cb-text-muted)",
          flexShrink: 0,
        }}
      >
        <Camera size={18} strokeWidth={1.7} />
      </button>
    </div>
  );
}

type CameraFn = (itemKey: string, label: string) => void;
type PhotoCounts = Record<string, number>;

/* ---------------- roof takeoff, rendered inside the walk ---------------- */

export function CbRoofTakeoffFields({
  sheet,
  onPatch,
  onNotes,
  onCamera,
  photoCounts = {},
}: {
  sheet: CbSheet;
  onPatch: <K extends keyof CbSheet>(key: K, part: Partial<CbSheet[K]>) => void;
  onNotes: (v: string) => void;
  onCamera: CameraFn;
  photoCounts?: PhotoCounts;
}) {
  const qty = (
    label: string,
    itemKey: string,
    value: number | undefined,
    write: (v: number | undefined) => void,
  ) => (
    <CbQtyLine
      key={itemKey}
      label={label}
      itemKey={itemKey}
      photos={photoCounts[itemKey] ?? 0}
      onCamera={onCamera}
      value={value}
      onChange={write}
    />
  );

  return (
    <div>
      <CbSection title="Roof system" hint="What's up there today.">
        <CbPicker
          label="Roof type"
          options={CB_ROOF_TYPES}
          value={sheet.roof_system.roof_type}
          onChange={(v) => onPatch("roof_system", { roof_type: v })}
        />
        <CbQtyLine
          label="Layers"
          itemKey="rs_layers"
          photos={photoCounts["rs_layers"] ?? 0}
          onCamera={onCamera}
          value={sheet.roof_system.layers}
          onChange={(v) => onPatch("roof_system", { layers: v })}
        />
        <CbPicker
          label="Decking"
          options={CB_DECKING_TYPES}
          value={sheet.roof_system.decking_type}
          onChange={(v) => onPatch("roof_system", { decking_type: v })}
        />
        <CbPicker
          label="Decking condition"
          options={CB_DECKING_CONDITION}
          value={sheet.roof_system.decking_condition}
          onChange={(v) => onPatch("roof_system", { decking_condition: v })}
        />
      </CbSection>

      <CbSection title="Flashing">
        {qty("Roof to wall", "fl_roof_to_wall_lf", sheet.flashing.roof_to_wall_lf, (v) =>
          onPatch("flashing", { roof_to_wall_lf: v }),
        )}
        {qty("Step flashing (LF)", "fl_step_flashing_lf", sheet.flashing.step_flashing_lf, (v) =>
          onPatch("flashing", { step_flashing_lf: v }),
        )}
        {qty("Counterflashing (LF)", "fl_counterflashing_lf", sheet.flashing.counterflashing_lf, (v) =>
          onPatch("flashing", { counterflashing_lf: v }),
        )}
        {qty("Chimneys", "fl_chimney_count", sheet.flashing.chimney_count, (v) =>
          onPatch("flashing", { chimney_count: v }),
        )}
        <CbPicker
          label="Flashing material"
          options={CB_FLASH_MATERIALS}
          value={sheet.flashing.material}
          onChange={(v) => onPatch("flashing", { material: v })}
        />
      </CbSection>

      <CbSection title="Ventilation">
        {qty("Ridge vent (LF)", "vt_ridge_vent_lf", sheet.ventilation.ridge_vent_lf, (v) =>
          onPatch("ventilation", { ridge_vent_lf: v }),
        )}
        {qty("Box vents", "vt_box_vent_qty", sheet.ventilation.box_vent_qty, (v) =>
          onPatch("ventilation", { box_vent_qty: v }),
        )}
        {qty("Turbines", "vt_turbine_qty", sheet.ventilation.turbine_qty, (v) =>
          onPatch("ventilation", { turbine_qty: v }),
        )}
        {qty("Power vents", "vt_power_vent_qty", sheet.ventilation.power_vent_qty, (v) =>
          onPatch("ventilation", { power_vent_qty: v }),
        )}
        {qty("Solar fans", "vt_solar_fan_qty", sheet.ventilation.solar_fan_qty, (v) =>
          onPatch("ventilation", { solar_fan_qty: v }),
        )}
        {qty("Soffit vent (LF)", "vt_soffit_vent_lf", sheet.ventilation.soffit_vent_lf, (v) =>
          onPatch("ventilation", { soffit_vent_lf: v }),
        )}
        {qty("Gable vents", "vt_gable_vent_qty", sheet.ventilation.gable_vent_qty, (v) =>
          onPatch("ventilation", { gable_vent_qty: v }),
        )}
      </CbSection>

      <CbSection title="Penetrations">
        {(
          [
            ["pipe_1_5", 'Pipe jack 1.5"'],
            ["pipe_2", 'Pipe jack 2"'],
            ["pipe_3", 'Pipe jack 3"'],
            ["pipe_4", 'Pipe jack 4"'],
            ["lead_boots", "Lead boots"],
            ["split_boots", "Split boots"],
            ["furnace_caps", "Furnace caps"],
            ["storm_collars", "Storm collars"],
            ["exhaust_vents", "Exhaust vents"],
            ["kitchen_vents", "Kitchen vents"],
            ["bath_vents", "Bath vents"],
            ["lineset_covers", "Lineset covers"],
          ] as const
        ).map(([key, label]) =>
          qty(label, `pen_${key}`, sheet.penetrations[key], (v) =>
            onPatch("penetrations", { [key]: v } as Partial<CbSheet["penetrations"]>),
          ),
        )}
      </CbSection>

      <CbSection title="Solar &amp; gutters">
        {qty("Solar panels", "sol_panel_count", sheet.solar.panel_count, (v) =>
          onPatch("solar", { panel_count: v }),
        )}
        {qty("Gutter (LF)", "gu_lf", sheet.gutters.lf, (v) => onPatch("gutters", { lf: v }))}
        {qty("Downspouts", "gu_downspout_qty", sheet.gutters.downspout_qty, (v) =>
          onPatch("gutters", { downspout_qty: v }),
        )}
        <CbPicker
          label="Gutter size"
          options={CB_GUTTER_SIZES}
          value={sheet.gutters.size}
          onChange={(v) => onPatch("gutters", { size: v })}
        />
        <CbPicker
          label="Gutter material"
          options={CB_GUTTER_MATERIALS}
          value={sheet.gutters.material}
          onChange={(v) => onPatch("gutters", { material: v })}
        />
      </CbSection>

      <CbSection title="Roof hardware">
        {(
          [
            ["satellite_dish", "Satellite dish"],
            ["antenna", "Antenna"],
            ["snow_guards", "Snow guards"],
            ["heat_cable_lf", "Heat cable (LF)"],
            ["anchors", "Anchors"],
            ["lights", "Lights"],
            ["cameras", "Cameras"],
          ] as const
        ).map(([key, label]) =>
          qty(label, `hw_${key}`, sheet.hardware[key] as number | undefined, (v) =>
            onPatch("hardware", { [key]: v } as Partial<CbSheet["hardware"]>),
          ),
        )}
        <CbField
          label="Anything else on the roof"
          value={sheet.hardware.other ?? ""}
          onChange={(e) => onPatch("hardware", { other: e.target.value })}
        />
      </CbSection>

      <CbSection title="Roof notes">
        <CbTextarea label="Notes" rows={4} value={sheet.notes ?? ""} onChange={(e) => onNotes(e.target.value)} />
      </CbSection>
    </div>
  );
}

/* ---------------- exterior takeoff, per elevation ---------------- */

export function CbExteriorTakeoffFields({
  elevationKey,
  elevationLabel,
  area,
  onPatch,
  onCamera,
  photoCounts = {},
}: {
  elevationKey: string;
  elevationLabel: string;
  area: CbExteriorArea;
  onPatch: (part: Partial<CbExteriorArea>) => void;
  onCamera: CameraFn;
  photoCounts?: PhotoCounts;
}) {
  return (
    <CbSection title={`${elevationLabel} takeoff`} hint="Quantity or a photo — whichever is faster on the wall.">
      <CbPicker
        label="Siding type"
        options={CB_SIDING_TYPES}
        value={area.siding_type}
        onChange={(v) => onPatch({ siding_type: v })}
      />
      {CB_EXTERIOR_FIELDS.map((f) => {
        const itemKey = `ext_${elevationKey}_${f.key}`;
        return (
          <CbQtyLine
            key={f.key}
            label={f.label}
            suffix={f.unit}
            itemKey={itemKey}
            photos={photoCounts[itemKey] ?? 0}
            onCamera={onCamera}
            value={area[f.key] as number | undefined}
            onChange={(v) => onPatch({ [f.key]: v } as Partial<CbExteriorArea>)}
          />
        );
      })}
      <CbTextarea
        label="Notes"
        rows={3}
        value={area.notes ?? ""}
        onChange={(e) => onPatch({ notes: e.target.value })}
      />
    </CbSection>
  );
}

/* ---------------- interior takeoff, per room ---------------- */

export function CbInteriorTakeoffFields({
  roomId,
  roomName,
  area,
  onPatch,
  onCamera,
  photoCounts = {},
}: {
  roomId: string;
  roomName: string;
  area: CbInteriorArea;
  onPatch: (part: Partial<CbInteriorArea>) => void;
  onCamera: CameraFn;
  photoCounts?: PhotoCounts;
}) {
  return (
    <CbSection title={`${roomName} takeoff`} hint="Measure the room once — the estimate reads these numbers.">
      <CbPicker
        label="Flooring"
        options={CB_FLOORING_TYPES}
        value={area.flooring_type}
        onChange={(v) => onPatch({ flooring_type: v })}
      />
      {CB_INTERIOR_FIELDS.map((f) => {
        const itemKey = `int_${roomId}_${f.key}`;
        return (
          <CbQtyLine
            key={f.key}
            label={f.label}
            suffix={f.unit}
            itemKey={itemKey}
            photos={photoCounts[itemKey] ?? 0}
            onCamera={onCamera}
            value={area[f.key] as number | undefined}
            onChange={(v) => onPatch({ [f.key]: v } as Partial<CbInteriorArea>)}
          />
        );
      })}
      <CbTextarea
        label="Contents note"
        rows={3}
        value={area.contents_note ?? ""}
        onChange={(e) => onPatch({ contents_note: e.target.value })}
      />
    </CbSection>
  );
}
