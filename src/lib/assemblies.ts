// Asset types map detected roof systems / features → assemblies in master_macros.
// Base = full roof system. Add-on = bolts onto a base when AI sees it.

export type AssetType =
  // Bases
  | "comp_shingle"
  | "tile_roof"
  | "metal_roof"
  | "flat_roof"
  // Add-ons (features)
  | "chimney"
  | "skylight"
  | "valley"
  | "ridge_vent"
  | "wall_flashing"
  | "step_flashing"
  | "pipe_boot"
  | "two_story"
  | "steep_pitch"
  | "gutters"
  | "solar";

export const ASSET_TYPES: Array<{
  value: AssetType;
  label: string;
  group: "base" | "addon";
  defaultIsAddon: boolean;
}> = [
  { value: "comp_shingle",   label: "Composition Shingle Roof", group: "base",  defaultIsAddon: false },
  { value: "tile_roof",      label: "Tile Roof",                group: "base",  defaultIsAddon: false },
  { value: "metal_roof",     label: "Metal Roof",               group: "base",  defaultIsAddon: false },
  { value: "flat_roof",      label: "Flat / Low-Slope Roof",    group: "base",  defaultIsAddon: false },
  { value: "chimney",        label: "Chimney",                  group: "addon", defaultIsAddon: true  },
  { value: "skylight",       label: "Skylight",                 group: "addon", defaultIsAddon: true  },
  { value: "valley",         label: "Valley",                   group: "addon", defaultIsAddon: true  },
  { value: "ridge_vent",     label: "Ridge Vent",               group: "addon", defaultIsAddon: true  },
  { value: "wall_flashing",  label: "Wall Flashing",            group: "addon", defaultIsAddon: true  },
  { value: "step_flashing",  label: "Step Flashing",            group: "addon", defaultIsAddon: true  },
  { value: "pipe_boot",      label: "Pipe Boot / Vent Boot",    group: "addon", defaultIsAddon: true  },
  { value: "two_story",      label: "Two-Story",                group: "addon", defaultIsAddon: true  },
  { value: "steep_pitch",    label: "Steep Pitch (8/12+)",      group: "addon", defaultIsAddon: true  },
  { value: "gutters",        label: "Gutters & Downspouts",     group: "addon", defaultIsAddon: true  },
  { value: "solar",          label: "Solar (detach & reset)",   group: "addon", defaultIsAddon: true  },
];

export function assetTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ASSET_TYPES.find((a) => a.value === value)?.label ?? value;
}

export const QTY_MODES = [
  { value: "manual", label: "Manual (blank)", hint: "Pre-filled at 0 — you enter the measurement on the estimate." },
  { value: "count",  label: "Auto-count",     hint: "AI fills in the count from photos (e.g. 2 skylights)." },
  { value: "fixed",  label: "Fixed",          hint: "Always inserted at the configured qty." },
] as const;

export type QtyMode = typeof QTY_MODES[number]["value"];
