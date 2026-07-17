import type { SpfFields } from "./data";

export type PresetKey = "recover" | "tearoff" | "metal" | "restore";

export const PRESETS: Record<PresetKey, { fields: Partial<SpfFields>; stack: string; label: string }> = {
  recover: {
    label: "Recover",
    fields: { f_on: "1", e_tear: "0", e_surf: "burs", e_prep: "0.22", e_rustpct: 0, f_thick: 1.5, q_dump: 0, l_mobs: 1, r_lf: 0 },
    stack: "sil2",
  },
  tearoff: {
    label: "Tear-off",
    fields: { f_on: "1", e_tear: "1", e_surf: "bur", e_layers: 2, e_prep: "0.06", q_dump: 8, f_thick: 2, m_cont: 6, r_lf: 0 },
    stack: "sil2",
  },
  metal: {
    label: "Metal / rust",
    fields: {
      f_on: "1", e_deck: "metalpanel", e_surf: "metal", e_tear: "0", e_prep: "0.22",
      e_rustpct: 25, e_rustm: "0.85", e_fast: 0.18, f_thick: 1, f_tex: "10",
      p_geo: "1.25", r_lf: 2400, r_w: 6, r_rate: 600,
    },
    stack: "rust",
  },
  restore: {
    label: "Coating restore",
    fields: { f_on: "0", e_surf: "spf", e_tear: "0", e_prep: "0.22", s_eng: "0", r_lf: 0, q_dump: 0 },
    stack: "sil2",
  },
};
