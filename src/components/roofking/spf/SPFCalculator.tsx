import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Printer, Copy, Download, Upload, Loader2 } from "lucide-react";
import {
  PRODUCTS, METHODS, SCOPES, DETAILS_SEED, FIELD_DEFAULTS,
  type Layer, type Detail, type SpfFields, type MethodKey, type ScopeKey,
} from "@/lib/spf/data";
import { calc, buildScope, newLayer, stackFromPreset, defWaste } from "@/lib/spf/engine";
import { PRESETS, type PresetKey } from "@/lib/spf/presets";
import { useHydratedSpfCatalog } from "@/lib/spf/catalog";

const money = (n: number) => "$" + Math.round(n).toLocaleString();

type CalcMode = "quick" | "advanced";

export function SPFCalculator() {
  const { ready, catalog, isLoading, error } = useHydratedSpfCatalog();
  if (error) {
    return (
      <div className="rk-card p-6 text-sm" style={{ color: "var(--rk-red)" }}>
        Failed to load SPF catalog: {(error as Error).message}
      </div>
    );
  }
  if (!ready || isLoading || !catalog) {
    return (
      <div className="rk-card flex items-center gap-3 p-6 text-sm" style={{ color: "var(--rk-ink-faint)" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading SPF catalog…
      </div>
    );
  }
  return <SPFCalculatorInner catalog={catalog} />;
}

function SPFCalculatorInner({ catalog }: { catalog: NonNullable<ReturnType<typeof useHydratedSpfCatalog>["catalog"]> }) {


  const [mode, setMode] = useState<CalcMode>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("spf-mode");
      if (saved === "quick" || saved === "advanced") return saved;
    }
    return "quick";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("spf-mode", mode);
  }, [mode]);


  const [fields, setFields] = useState<SpfFields>({ ...FIELD_DEFAULTS });
  const [layers, setLayers] = useState<Layer[]>(() => stackFromPreset("sil2"));
  const [details, setDetails] = useState<Detail[]>(() => DETAILS_SEED.map((d) => [...d] as Detail));
  const importRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => calc(fields, layers, details), [fields, layers, details]);
  const scopeText = useMemo(() => buildScope(result, fields, details), [result, fields, details]);

  const setF = <K extends keyof SpfFields>(k: K, v: SpfFields[K]) => setFields((p) => ({ ...p, [k]: v }));
  const setNum = (k: keyof SpfFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(k, (parseFloat(e.target.value) || 0) as SpfFields[typeof k]);
  const setStr = (k: keyof SpfFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(k, e.target.value as SpfFields[typeof k]);

  const updateLayer = (i: number, patch: Partial<{ on: number; pi: number; scope: ScopeKey; amt: number; method: MethodKey; mils: number; solids: number; cost: number; waste: number | null }>) => {
    setLayers((prev) => {
      const next = prev.map((L) => [...L] as Layer);
      const L = next[i];
      if (patch.on != null) L[0] = patch.on;
      if (patch.pi != null) {
        L[1] = patch.pi;
        const p = PRODUCTS[patch.pi];
        L[2] = p[0]; L[6] = p[3]; L[7] = p[1]; L[8] = p[2]; L[5] = p[4]; L[9] = null;
      }
      if (patch.scope != null) { L[3] = patch.scope; if (patch.scope === "seams") L[4] = 0; L[9] = null; }
      if (patch.amt != null) L[4] = patch.amt;
      if (patch.method != null) { L[5] = patch.method; L[9] = null; }
      if (patch.mils != null) L[6] = patch.mils;
      if (patch.solids != null) L[7] = patch.solids;
      if (patch.cost != null) L[8] = patch.cost;
      if ("waste" in patch) L[9] = patch.waste ?? null;
      return next;
    });
  };
  const addLayer = () => setLayers((p) => [...p, newLayer(6)]);
  const delLayer = (i: number) => setLayers((p) => p.filter((_, j) => j !== i));

  const updateDetail = (i: number, patch: Partial<{ label: string; qty: number; cost: number }>) => {
    setDetails((prev) => {
      const next = prev.map((d) => [...d] as Detail);
      if (patch.label != null) next[i][0] = patch.label;
      if (patch.qty != null) next[i][2] = patch.qty;
      if (patch.cost != null) next[i][3] = patch.cost;
      return next;
    });
  };
  const addDetail = () => setDetails((p) => [...p, ["Custom line", "ls", 1, 0]]);

  const loadPreset = (k: PresetKey) => {
    const P = PRESETS[k];
    setFields((prev) => ({ ...prev, ...(P.fields as SpfFields) }));
    setLayers(stackFromPreset(P.stack));
    toast.success(`Loaded preset: ${P.label}`);
  };

  const exportJSON = () => {
    const payload = { fields, layers, details };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (fields.p_name || "spf-estimate").replace(/\W+/g, "-").toLowerCase() + ".json";
    a.click();
  };
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(String(r.result));
        if (o.fields) setFields({ ...FIELD_DEFAULTS, ...o.fields });
        if (o.layers) setLayers(o.layers);
        if (o.details) setDetails(o.details);
        toast.success("Estimate imported");
      } catch {
        toast.error("That file is not a valid estimate export.");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };
  const copyScope = async () => {
    await navigator.clipboard.writeText(scopeText);
    toast.success("Scope copied");
  };

  return (
    <div className="spf-root grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-3">
        {/* Header bar with presets */}
        <div className="rk-card flex flex-wrap items-center gap-2 p-3">
          <div className="mr-auto flex flex-col">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
              Foam · Coating stack · Detail · Soft cost
            </span>
            <span className="rk-display text-lg" style={{ color: "var(--rk-gold)" }}>SPF Scope & Cost Engine</span>
          </div>
          <div className="mr-2 inline-flex overflow-hidden rounded border" style={{ borderColor: "var(--rk-line)" }}>
            {(["quick", "advanced"] as CalcMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{
                  background: mode === m ? "var(--rk-gold)" : "transparent",
                  color: mode === m ? "#111" : "var(--rk-ink-muted)",
                }}
              >
                {m}
              </button>
            ))}
          </div>
          {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
            <button key={k} onClick={() => loadPreset(k)} className="rk-btn rk-btn-ghost">{PRESETS[k].label}</button>
          ))}
          <button onClick={exportJSON} className="rk-btn rk-btn-ghost"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={() => importRef.current?.click()} className="rk-btn rk-btn-ghost"><Upload className="h-3.5 w-3.5" /> Import</button>
          <input ref={importRef} type="file" accept=".json" hidden onChange={onImportFile} />
          <button onClick={() => window.print()} className="rk-btn rk-btn-gold"><Printer className="h-3.5 w-3.5" /> Print scope</button>
        </div>

        {mode === "quick" ? (
        <>
          <div className="rk-card p-3 text-[12px]" style={{ color: "var(--rk-ink-muted)" }}>
            Quick estimate — just the essentials. Everything hidden uses your standard defaults. Switch to Advanced to fine-tune.
          </div>

          <Section title="1 · Project" defaultOpen>
            <Grid>
              <F wide label="Project name"><input className="rk-input" value={fields.p_name} onChange={(e) => setF("p_name", e.target.value)} /></F>
              <F label="Roof area (sq ft)"><input type="number" className="rk-input" value={fields.p_sqft} onChange={setNum("p_sqft")} /></F>
              <F label="Roof geometry">
                <Sel value={fields.p_geo} onChange={setStr("p_geo")} opts={[
                  ["1.00", "Simple — open field, few breaks"],
                  ["1.10", "Moderate — some curbs/offsets"],
                  ["1.25", "Complex — heavy equipment, many levels"],
                  ["1.45", "Extreme — congested, cut-up, low clearance"],
                ]} />
              </F>
              <F label="Slope">
                <Sel value={fields.p_slope} onChange={setStr("p_slope")} opts={[
                  ["1.00", "Low slope (<2:12)"],
                  ["1.08", "2:12 – 4:12"],
                  ["1.20", ">4:12 (fall protection heavy)"],
                ]} />
              </F>
            </Grid>
          </Section>

          <Section title="2 · Existing" defaultOpen>
            <Grid>
              <F label="Existing surface">
                <Sel value={fields.e_surf} onChange={setStr("e_surf")} opts={[
                  ["bur", "BUR — gravel"], ["burs", "BUR / mod bit — smooth"],
                  ["single", "Single ply (TPO/EPDM/PVC)"], ["spf", "Existing SPF + coating"],
                  ["metal", "Bare / rusted metal panel"], ["none", "Bare deck / new construction"],
                ]} />
              </F>
              <F label="Tear-off scope">
                <Sel value={fields.e_tear} onChange={setStr("e_tear")} opts={[
                  ["0", "None — recover in place"], ["0.15", "Partial — 15% wet area"],
                  ["0.30", "Partial — 30% wet area"], ["1", "Full tear-off to deck"],
                ]} />
              </F>
            </Grid>
          </Section>

          <Section title="3 · Access" defaultOpen>
            <Grid>
              <F label="Roof height (ft)"><input type="number" className="rk-input" value={fields.a_ht} onChange={setNum("a_ht")} /></F>
              <F label="Access method">
                <Sel value={fields.a_method} onChange={setStr("a_method")} opts={[
                  ["0", "Interior stair / existing hoist"], ["1", "Ladder + material conveyor"],
                  ["2", "Scissor lift"], ["3", "Boom lift / telehandler"],
                  ["4", "Crane pick"], ["5", "Rooftop rig placement (crane set)"],
                ]} />
              </F>
            </Grid>
          </Section>

          <Section title="4 · Foam" defaultOpen>
            <Grid>
              <F label="Foam in scope">
                <Sel value={fields.f_on} onChange={setStr("f_on")} opts={[["1", "Yes — SPF applied"], ["0", "No — coating restoration only"]]} />
              </F>
              <F label="Average thickness (in)"><input type="number" step="0.1" className="rk-input" value={fields.f_thick} onChange={setNum("f_thick")} /></F>
            </Grid>
          </Section>

          <Section title="5 · Coating stack" defaultOpen>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-xs">
                <thead>
                  <tr className="text-left" style={{ color: "var(--rk-ink-faint)" }}>
                    <th className="w-8"></th>
                    <th className="py-2">Product</th><th>Applied to</th><th>Amount</th><th>Method</th>
                    <th>Mils</th><th>Solids %</th><th>$/gal</th><th>Waste %</th>
                    <th className="text-right">Area</th><th className="text-right">Gal</th><th className="text-right">Cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {layers.map((L, i) => {
                    const b = result.layerBreakdown[i];
                    const wasteVal = L[9] == null ? defWaste(L[5], L[3], parseFloat(fields.f_tex)) : L[9];
                    const amtDis = L[3] === "field" || L[3] === "details";
                    return (
                      <tr key={i} className={"border-t " + (L[0] ? "" : "opacity-40")} style={{ borderColor: "var(--rk-line)" }}>
                        <td className="py-1"><input type="checkbox" checked={!!L[0]} onChange={(e) => updateLayer(i, { on: e.target.checked ? 1 : 0 })} /></td>
                        <td><Sel value={String(L[1])} onChange={(e) => updateLayer(i, { pi: parseInt(e.target.value) })} opts={PRODUCTS.map((p, j) => [String(j), p[0]])} /></td>
                        <td><Sel value={L[3]} onChange={(e) => updateLayer(i, { scope: e.target.value as ScopeKey })} opts={(Object.keys(SCOPES) as ScopeKey[]).map((k) => [k, SCOPES[k]])} /></td>
                        <td><input type="number" disabled={amtDis} className="rk-input" value={L[4]} onChange={(e) => updateLayer(i, { amt: parseFloat(e.target.value) || 0 })} /></td>
                        <td><Sel value={L[5]} onChange={(e) => updateLayer(i, { method: e.target.value as MethodKey })} opts={(Object.keys(METHODS) as MethodKey[]).map((k) => [k, METHODS[k][0]])} /></td>
                        <td><input type="number" className="rk-input" value={L[6]} onChange={(e) => updateLayer(i, { mils: parseFloat(e.target.value) || 0 })} /></td>
                        <td><input type="number" className="rk-input" value={L[7] ?? ""} onChange={(e) => updateLayer(i, { solids: parseFloat(e.target.value) || 0 })} /></td>
                        <td><input type="number" className="rk-input" value={L[8] ?? ""} onChange={(e) => updateLayer(i, { cost: parseFloat(e.target.value) || 0 })} /></td>
                        <td><input type="number" className="rk-input" value={wasteVal} onChange={(e) => updateLayer(i, { waste: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{Math.round(b.area).toLocaleString()}</td>
                        <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{L[0] ? Math.ceil(b.gal).toLocaleString() : "—"}</td>
                        <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{L[0] ? money(b.cost) : "—"}</td>
                        <td><button onClick={() => delLayer(i)} className="rk-btn rk-btn-ghost px-1.5 py-1"><Trash2 className="h-3 w-3" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={addLayer} className="rk-btn rk-btn-ghost"><Plus className="h-3.5 w-3.5" /> Add layer</button>
              <button onClick={() => setLayers(stackFromPreset("sil2"))} className="rk-btn rk-btn-ghost">Silicone base + top</button>
              <button onClick={() => setLayers(stackFromPreset("acr2"))} className="rk-btn rk-btn-ghost">Acrylic base + HS top</button>
              <button onClick={() => setLayers(stackFromPreset("rust"))} className="rk-btn rk-btn-ghost">Rust primer + acrylic</button>
              <button onClick={() => setLayers(stackFromPreset("sil1"))} className="rk-btn rk-btn-ghost">Single-coat silicone</button>
              <button onClick={() => setLayers(stackFromPreset("pu"))} className="rk-btn rk-btn-ghost">Polyurethane base + aliphatic</button>
            </div>
          </Section>

          <Section title="10 · Markup" defaultOpen>
            <Grid>
              <F label="Target gross margin % (of sell)"><input type="number" step="0.1" className="rk-input" value={fields.m_margin} onChange={setNum("m_margin")} /></F>
            </Grid>
          </Section>
        </>
        ) : (
        <>



        {/* 1 PROJECT */}
        <Section title="1 · Project" sub="Identity & area" defaultOpen>
          <Grid>
            <F wide label="Project name"><input className="rk-input" value={fields.p_name} onChange={(e) => setF("p_name", e.target.value)} /></F>
            <F wide label="Address"><input className="rk-input" value={fields.p_addr} onChange={(e) => setF("p_addr", e.target.value)} /></F>
            <F label="Roof area (sq ft)"><input type="number" className="rk-input" value={fields.p_sqft} onChange={setNum("p_sqft")} /></F>
            <F label="Field waste / overspray %"><input type="number" className="rk-input" value={fields.p_areawaste} onChange={setNum("p_areawaste")} /></F>
            <F label="Roof geometry">
              <Sel value={fields.p_geo} onChange={setStr("p_geo")} opts={[
                ["1.00", "Simple — open field, few breaks"],
                ["1.10", "Moderate — some curbs/offsets"],
                ["1.25", "Complex — heavy equipment, many levels"],
                ["1.45", "Extreme — congested, cut-up, low clearance"],
              ]} />
            </F>
            <F label="Slope">
              <Sel value={fields.p_slope} onChange={setStr("p_slope")} opts={[
                ["1.00", "Low slope (<2:12)"],
                ["1.08", "2:12 – 4:12"],
                ["1.20", ">4:12 (fall protection heavy)"],
              ]} />
            </F>
          </Grid>
        </Section>

        {/* 2 EXISTING */}
        <Section title="2 · Existing assembly, tear-off & prep" sub="What's up there now">
          <Grid>
            <F label="Deck type">
              <Sel value={fields.e_deck} onChange={setStr("e_deck")} opts={[
                ["concrete", "Structural concrete"], ["lwic", "Lightweight insulating concrete"],
                ["steel", "Steel deck"], ["metalpanel", "Metal panel (R-panel / SSR)"],
                ["wood", "Wood / plywood"], ["gypsum", "Gypsum / Tectum"],
              ]} />
            </F>
            <F label="Existing surface">
              <Sel value={fields.e_surf} onChange={setStr("e_surf")} opts={[
                ["bur", "BUR — gravel"], ["burs", "BUR / mod bit — smooth"],
                ["single", "Single ply (TPO/EPDM/PVC)"], ["spf", "Existing SPF + coating"],
                ["metal", "Bare / rusted metal panel"], ["none", "Bare deck / new construction"],
              ]} />
            </F>
            <F label="Existing layers (count)"><input type="number" className="rk-input" value={fields.e_layers} onChange={setNum("e_layers")} /></F>
            <F label="Tear-off scope">
              <Sel value={fields.e_tear} onChange={setStr("e_tear")} opts={[
                ["0", "None — recover in place"], ["0.15", "Partial — 15% wet area"],
                ["0.30", "Partial — 30% wet area"], ["1", "Full tear-off to deck"],
              ]} />
            </F>
            <F label="Tear-off $/square/layer"><input type="number" className="rk-input" value={fields.e_tearcost} onChange={setNum("e_tearcost")} /></F>
            <F label="Disposal $/square/layer"><input type="number" className="rk-input" value={fields.e_disp} onChange={setNum("e_disp")} /></F>
            <F label="Deck / panel repair (sq ft)"><input type="number" className="rk-input" value={fields.e_deckrep} onChange={setNum("e_deckrep")} /></F>
            <F label="Repair $/sq ft"><input type="number" className="rk-input" value={fields.e_deckrepc} onChange={setNum("e_deckrepc")} /></F>
          </Grid>
          <h3 className="mt-4 mb-2 text-sm" style={{ color: "var(--rk-accent)" }}>Clean & prep</h3>
          <Grid>
            <F label="Wash method">
              <Sel value={fields.e_prep} onChange={setStr("e_prep")} opts={[
                ["0.06", "Blow / broom clean only"], ["0.22", "Power wash + detergent"],
                ["0.38", "Hot wash + degreaser (grease/kitchen)"], ["0.55", "Grind / scarify + wash"],
              ]} />
            </F>
            <F label="Rust removal — % of field"><input type="number" className="rk-input" value={fields.e_rustpct} onChange={setNum("e_rustpct")} /></F>
            <F label="Rust removal method">
              <Sel value={fields.e_rustm} onChange={setStr("e_rustm")} opts={[
                ["0.35", "Wire wheel / hand tool (SSPC-SP3)"],
                ["0.85", "Power tool to bare metal (SP11)"],
                ["1.40", "Abrasive blast (SP6 commercial)"],
              ]} />
            </F>
            <F label="Mildewcide / bleach $/sq ft"><input type="number" className="rk-input" value={fields.e_mildew} onChange={setNum("e_mildew")} /></F>
            <F label="Fastener re-secure $/sq ft"><input type="number" className="rk-input" value={fields.e_fast} onChange={setNum("e_fast")} /></F>
            <F label="Dry-out / cure days"><input type="number" className="rk-input" value={fields.e_dry} onChange={setNum("e_dry")} /></F>
          </Grid>
          <Note>Wet-area % drives tear-off quantity — that number should come off an IR scan, not a guess. Rust removal is priced separately from the wash because it's a different crew hour entirely.</Note>
        </Section>

        {/* 3 ACCESS */}
        <Section title="3 · Access, height & heavy equipment" sub="Getting material to the deck">
          <Grid>
            <F label="Roof height (ft)"><input type="number" className="rk-input" value={fields.a_ht} onChange={setNum("a_ht")} /></F>
            <F label="Hose run from rig (ft)"><input type="number" className="rk-input" value={fields.a_hose} onChange={setNum("a_hose")} /></F>
            <F label="Access method">
              <Sel value={fields.a_method} onChange={setStr("a_method")} opts={[
                ["0", "Interior stair / existing hoist"], ["1", "Ladder + material conveyor"],
                ["2", "Scissor lift"], ["3", "Boom lift / telehandler"],
                ["4", "Crane pick"], ["5", "Rooftop rig placement (crane set)"],
              ]} />
            </F>
            <F label="Lift $/day · days">
              <div className="flex gap-2">
                <input type="number" className="rk-input" value={fields.a_liftrate} onChange={setNum("a_liftrate")} />
                <input type="number" className="rk-input" value={fields.a_liftdays} onChange={setNum("a_liftdays")} />
              </div>
            </F>
            <F label="Lift delivery + pickup ($)"><input type="number" className="rk-input" value={fields.a_liftdel} onChange={setNum("a_liftdel")} /></F>
            <F label="Crane $/hr · hours">
              <div className="flex gap-2">
                <input type="number" className="rk-input" value={fields.a_cranerate} onChange={setNum("a_cranerate")} />
                <input type="number" className="rk-input" value={fields.a_cranehrs} onChange={setNum("a_cranehrs")} />
              </div>
            </F>
            <F label="Conveyor / hoist ($)"><input type="number" className="rk-input" value={fields.a_hoist} onChange={setNum("a_hoist")} /></F>
            <F label="Occupied / sensitive building">
              <Sel value={fields.a_occ} onChange={setStr("a_occ")} opts={[
                ["1.00", "No — vacant or industrial"],
                ["1.06", "Yes — odor/overspray protocol"],
                ["1.15", "Yes — hospital/school/food, night work"],
              ]} />
            </F>
            <F label="Overspray protection ($)"><input type="number" className="rk-input" value={fields.a_overspray} onChange={setNum("a_overspray")} /></F>
            <F label="Wind screens / masking ($)"><input type="number" className="rk-input" value={fields.a_screens} onChange={setNum("a_screens")} /></F>
            <F label="Shift">
              <Sel value={fields.a_shift} onChange={setStr("a_shift")} opts={[
                ["1.00", "Standard day"], ["1.18", "Nights"], ["1.30", "Weekend / holiday"],
              ]} />
            </F>
          </Grid>
          <Note>Height over 40 ft, hose runs over 300 ft, and lift-dependent access all cut daily production. The engine factors those into labor automatically.</Note>
        </Section>

        {/* 4 FOAM */}
        <Section title="4 · Polyurethane foam" sub="Yield, density, thickness" defaultOpen>
          <Grid>
            <F label="Foam in scope">
              <Sel value={fields.f_on} onChange={setStr("f_on")} opts={[["1", "Yes — SPF applied"], ["0", "No — coating restoration only"]]} />
            </F>
            <F label="Density (lb/ft³)">
              <Sel value={fields.f_dens} onChange={setStr("f_dens")} opts={[["2.8", "2.8 lb roofing"], ["3.0", "3.0 lb roofing"], ["3.5", "3.5 lb high-density"]]} />
            </F>
            <F label="Average thickness (in)"><input type="number" step="0.1" className="rk-input" value={fields.f_thick} onChange={setNum("f_thick")} /></F>
            <F label="Tapered / cricket add (bd ft)"><input type="number" className="rk-input" value={fields.f_taper} onChange={setNum("f_taper")} /></F>
            <F label="Yield per set (bd ft)"><input type="number" className="rk-input" value={fields.f_yield} onChange={setNum("f_yield")} /></F>
            <F label="Foam waste %"><input type="number" className="rk-input" value={fields.f_waste} onChange={setNum("f_waste")} /></F>
            <F label="Cost per set ($)"><input type="number" className="rk-input" value={fields.f_cost} onChange={setNum("f_cost")} /></F>
            <F label="Freight $/set"><input type="number" className="rk-input" value={fields.f_freight} onChange={setNum("f_freight")} /></F>
            <F label="Ambient conditions">
              <Sel value={fields.f_amb} onChange={setStr("f_amb")} opts={[
                ["1.00", "Ideal (60–90°F, low wind)"],
                ["1.05", "Cool substrate / early season"],
                ["1.12", "Windy — 10–15 mph sustained"],
              ]} />
            </F>
            <F label="Foam surface texture">
              <Sel value={fields.f_tex} onChange={(e) => { setLayers((p) => p.map((L) => { const N = [...L] as Layer; N[9] = null; return N; })); setF("f_tex", e.target.value); }} opts={[
                ["10", "Smooth / orange peel"], ["18", "Coarse orange peel"],
                ["28", "Verge of popcorn"], ["40", "Popcorn / tree bark (rework)"],
              ]} />
            </F>
          </Grid>
          <Note>Board feet = sq ft × inches. Texture set here drives coating loss on every sprayed layer above — rough foam eats coating.</Note>
        </Section>

        {/* 5 COATING STACK */}
        <Section title="5 · Coating stack" sub="Layer by layer, top to bottom of the can" defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-xs">
              <thead>
                <tr className="text-left" style={{ color: "var(--rk-ink-faint)" }}>
                  <th className="w-8"></th>
                  <th className="py-2">Product</th><th>Applied to</th><th>Amount</th><th>Method</th>
                  <th>Mils</th><th>Solids %</th><th>$/gal</th><th>Waste %</th>
                  <th className="text-right">Area</th><th className="text-right">Gal</th><th className="text-right">Cost</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {layers.map((L, i) => {
                  const b = result.layerBreakdown[i];
                  const wasteVal = L[9] == null ? defWaste(L[5], L[3], parseFloat(fields.f_tex)) : L[9];
                  const amtDis = L[3] === "field" || L[3] === "details";
                  return (
                    <tr key={i} className={"border-t " + (L[0] ? "" : "opacity-40")} style={{ borderColor: "var(--rk-line)" }}>
                      <td className="py-1"><input type="checkbox" checked={!!L[0]} onChange={(e) => updateLayer(i, { on: e.target.checked ? 1 : 0 })} /></td>
                      <td><Sel value={String(L[1])} onChange={(e) => updateLayer(i, { pi: parseInt(e.target.value) })} opts={PRODUCTS.map((p, j) => [String(j), p[0]])} /></td>
                      <td><Sel value={L[3]} onChange={(e) => updateLayer(i, { scope: e.target.value as ScopeKey })} opts={(Object.keys(SCOPES) as ScopeKey[]).map((k) => [k, SCOPES[k]])} /></td>
                      <td><input type="number" disabled={amtDis} className="rk-input" value={L[4]} onChange={(e) => updateLayer(i, { amt: parseFloat(e.target.value) || 0 })} /></td>
                      <td><Sel value={L[5]} onChange={(e) => updateLayer(i, { method: e.target.value as MethodKey })} opts={(Object.keys(METHODS) as MethodKey[]).map((k) => [k, METHODS[k][0]])} /></td>
                      <td><input type="number" className="rk-input" value={L[6]} onChange={(e) => updateLayer(i, { mils: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" className="rk-input" value={L[7] ?? ""} onChange={(e) => updateLayer(i, { solids: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" className="rk-input" value={L[8] ?? ""} onChange={(e) => updateLayer(i, { cost: parseFloat(e.target.value) || 0 })} /></td>
                      <td><input type="number" className="rk-input" value={wasteVal} onChange={(e) => updateLayer(i, { waste: parseFloat(e.target.value) || 0 })} /></td>
                      <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{Math.round(b.area).toLocaleString()}</td>
                      <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{L[0] ? Math.ceil(b.gal).toLocaleString() : "—"}</td>
                      <td className="text-right font-mono text-[11px]" style={{ color: "var(--rk-accent)" }}>{L[0] ? money(b.cost) : "—"}</td>
                      <td><button onClick={() => delLayer(i)} className="rk-btn rk-btn-ghost px-1.5 py-1"><Trash2 className="h-3 w-3" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={addLayer} className="rk-btn rk-btn-ghost"><Plus className="h-3.5 w-3.5" /> Add layer</button>
            <button onClick={() => setLayers(stackFromPreset("sil2"))} className="rk-btn rk-btn-ghost">Silicone base + top</button>
            <button onClick={() => setLayers(stackFromPreset("acr2"))} className="rk-btn rk-btn-ghost">Acrylic base + HS top</button>
            <button onClick={() => setLayers(stackFromPreset("rust"))} className="rk-btn rk-btn-ghost">Rust primer + acrylic</button>
            <button onClick={() => setLayers(stackFromPreset("sil1"))} className="rk-btn rk-btn-ghost">Single-coat silicone</button>
            <button onClick={() => setLayers(stackFromPreset("pu"))} className="rk-btn rk-btn-ghost">Polyurethane base + aliphatic</button>
          </div>
          <h3 className="mt-5 mb-2 text-sm" style={{ color: "var(--rk-accent)" }}>Reinforcement & seams</h3>
          <Grid>
            <F label="Seam / joint length (LF)"><input type="number" className="rk-input" value={fields.r_lf} onChange={setNum("r_lf")} /></F>
            <F label="Fabric width (in)"><input type="number" className="rk-input" value={fields.r_w} onChange={setNum("r_w")} /></F>
            <F label="Fabric type">
              <Sel value={fields.r_type} onChange={setStr("r_type")} opts={[
                ["0.42", "Polyester fabric"], ["0.55", "Fiberglass mat"], ["0.95", "Butyl / seam tape"],
              ]} />
            </F>
            <F label="Fabric $/LF (override)"><input type="number" className="rk-input" value={fields.r_c} onChange={setNum("r_c")} /></F>
            <F label="Install LF / day"><input type="number" className="rk-input" value={fields.r_rate} onChange={setNum("r_rate")} /></F>
            <F label="Full-field fabric %"><input type="number" className="rk-input" value={fields.r_fieldpct} onChange={setNum("r_fieldpct")} /></F>
            <F label="Full-field fabric $/sq ft"><input type="number" step="0.01" className="rk-input" value={fields.r_fieldc} onChange={setNum("r_fieldc")} /></F>
          </Grid>
          <Note>Set <b>Applied to</b> = <i>Seams (LF)</i> on a layer and its area is computed as seam LF × fabric width — that's how you price the saturant that embeds the mat without charging the whole field for it. Brush and roll layers run at a fraction of spray production, and the schedule reflects it.</Note>
        </Section>

        {/* 6 DETAILS */}
        <Section title="6 · Details, hardware & penetrations" sub="Where the labor hides">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: "var(--rk-ink-faint)" }}>
                <th className="w-1/2 py-2">Item</th><th>Qty</th><th>Unit cost</th><th className="text-right">Extended</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--rk-line)" }}>
                  <td className="py-1">
                    {i >= DETAILS_SEED.length
                      ? <input className="rk-input" value={d[0]} onChange={(e) => updateDetail(i, { label: e.target.value })} />
                      : <span>{d[0]} <span className="ml-1 rounded px-1.5 py-0.5 text-[9px] uppercase" style={{ background: "var(--rk-panel-2)", color: "var(--rk-ink-faint)" }}>{d[1]}</span></span>}
                  </td>
                  <td><input type="number" className="rk-input" value={d[2]} onChange={(e) => updateDetail(i, { qty: parseFloat(e.target.value) || 0 })} /></td>
                  <td><input type="number" className="rk-input" value={d[3]} onChange={(e) => updateDetail(i, { cost: parseFloat(e.target.value) || 0 })} /></td>
                  <td className="text-right font-mono" style={{ color: "var(--rk-accent)" }}>{money(d[2] * d[3])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2"><button onClick={addDetail} className="rk-btn rk-btn-ghost"><Plus className="h-3.5 w-3.5" /> Add custom detail line</button></div>
        </Section>

        {/* 7 LABOR */}
        <Section title="7 · Labor & production" sub="Crew, rates, days">
          <Grid>
            <F label="Foam production bd ft / day"><input type="number" className="rk-input" value={fields.l_foamrate} onChange={setNum("l_foamrate")} /></F>
            <F label="Prep sq ft / day"><input type="number" className="rk-input" value={fields.l_preprate} onChange={setNum("l_preprate")} /></F>
            <F label="Rust removal sq ft / day"><input type="number" className="rk-input" value={fields.l_rustrate} onChange={setNum("l_rustrate")} /></F>
            <F label="Tear-off squares / day"><input type="number" className="rk-input" value={fields.l_tearrate} onChange={setNum("l_tearrate")} /></F>
            <F label="Crew size"><input type="number" className="rk-input" value={fields.l_crew} onChange={setNum("l_crew")} /></F>
            <F label="Avg wage $/hr"><input type="number" className="rk-input" value={fields.l_wage} onChange={setNum("l_wage")} /></F>
            <F label="Hours / day"><input type="number" className="rk-input" value={fields.l_hrs} onChange={setNum("l_hrs")} /></F>
            <F label="Labor burden %"><input type="number" className="rk-input" value={fields.l_burden} onChange={setNum("l_burden")} /></F>
            <F label="Mobilizations (count)"><input type="number" className="rk-input" value={fields.l_mobs} onChange={setNum("l_mobs")} /></F>
            <F label="Mobilization $ each"><input type="number" className="rk-input" value={fields.l_mobc} onChange={setNum("l_mobc")} /></F>
            <F label="Per diem $/man/day"><input type="number" className="rk-input" value={fields.l_diem} onChange={setNum("l_diem")} /></F>
            <F label="Lodging $/night (crew total)"><input type="number" className="rk-input" value={fields.l_lodge} onChange={setNum("l_lodge")} /></F>
            <F label="Weather / standby days"><input type="number" className="rk-input" value={fields.l_wx} onChange={setNum("l_wx")} /></F>
            <F label="Supervision $/day"><input type="number" className="rk-input" value={fields.l_super} onChange={setNum("l_super")} /></F>
          </Grid>
          <Note>Coating days come from each layer's own production rate in section 5 — spray, roll and brush are not the same day's work. Burden is payroll tax + comp + GL on labor; in FL roofing comp class it's rarely under 30%.</Note>
        </Section>

        {/* 8 EQUIPMENT */}
        <Section title="8 · Equipment & consumables" sub="Rig, fuel, disposables">
          <Grid>
            <F label="Spray rig $/day"><input type="number" className="rk-input" value={fields.q_rig} onChange={setNum("q_rig")} /></F>
            <F label="Generator / fuel $/day"><input type="number" className="rk-input" value={fields.q_fuel} onChange={setNum("q_fuel")} /></F>
            <F label="Airless pump $/day"><input type="number" className="rk-input" value={fields.q_pump} onChange={setNum("q_pump")} /></F>
            <F label="Pressure washer $/day"><input type="number" className="rk-input" value={fields.q_wash} onChange={setNum("q_wash")} /></F>
            <F label="Consumables $/day"><input type="number" className="rk-input" value={fields.q_cons} onChange={setNum("q_cons")} /></F>
            <F label="Rollers / brushes ($)"><input type="number" className="rk-input" value={fields.q_hand} onChange={setNum("q_hand")} /></F>
            <F label="Dumpsters (count)"><input type="number" className="rk-input" value={fields.q_dump} onChange={setNum("q_dump")} /></F>
            <F label="Dumpster $ each"><input type="number" className="rk-input" value={fields.q_dumpc} onChange={setNum("q_dumpc")} /></F>
            <F label="Job trailer / storage ($)"><input type="number" className="rk-input" value={fields.q_trailer} onChange={setNum("q_trailer")} /></F>
            <F label="Vehicle / fuel $/day"><input type="number" className="rk-input" value={fields.q_veh} onChange={setNum("q_veh")} /></F>
          </Grid>
        </Section>

        {/* 9 SOFT */}
        <Section title="9 · Engineering, permits & warranty" sub="Soft costs">
          <Grid>
            <F label="Engineering scope">
              <Sel value={fields.s_eng} onChange={setStr("s_eng")} opts={[
                ["0", "None"], ["2500", "Wind uplift letter / FBC calcs"],
                ["4800", "Calcs + structural review"], ["9500", "Full sealed drawings + structural"],
              ]} />
            </F>
            <F label="Engineering override ($)"><input type="number" className="rk-input" value={fields.s_engov} onChange={setNum("s_engov")} /></F>
            <F label="Permit basis">
              <Sel value={fields.s_pbasis} onChange={setStr("s_pbasis")} opts={[["pct", "% of job valuation"], ["flat", "Flat fee"]]} />
            </F>
            <F label="Permit % of valuation"><input type="number" step="0.1" className="rk-input" value={fields.s_ppct} onChange={setNum("s_ppct")} /></F>
            <F label="Permit flat / minimum ($)"><input type="number" className="rk-input" value={fields.s_pflat} onChange={setNum("s_pflat")} /></F>
            <F label="Plan review + NOC ($)"><input type="number" className="rk-input" value={fields.s_plan} onChange={setNum("s_plan")} /></F>
            <F label="Inspections (count × $)">
              <div className="flex gap-2">
                <input type="number" className="rk-input" value={fields.s_insp} onChange={setNum("s_insp")} />
                <input type="number" className="rk-input" value={fields.s_inspc} onChange={setNum("s_inspc")} />
              </div>
            </F>
            <F label="Product approval / NOA ($)"><input type="number" className="rk-input" value={fields.s_noa} onChange={setNum("s_noa")} /></F>
            <F label="IR moisture scan ($)"><input type="number" className="rk-input" value={fields.s_ir} onChange={setNum("s_ir")} /></F>
            <F label="Core cuts / pull tests ($)"><input type="number" className="rk-input" value={fields.s_core} onChange={setNum("s_core")} /></F>
            <F label="Mockup / test section ($)"><input type="number" className="rk-input" value={fields.s_mock} onChange={setNum("s_mock")} /></F>
            <F label="Third-party inspection ($)"><input type="number" className="rk-input" value={fields.s_3rd} onChange={setNum("s_3rd")} /></F>
            <F label="Warranty term">
              <Sel value={fields.s_war} onChange={setStr("s_war")} opts={[
                ["0", "Contractor workmanship only"], ["0.12", "10-yr manufacturer NDL"],
                ["0.18", "15-yr NDL"], ["0.26", "20-yr NDL"],
              ]} />
            </F>
            <F label="Warranty inspection fee ($)"><input type="number" className="rk-input" value={fields.s_warfee} onChange={setNum("s_warfee")} /></F>
          </Grid>
          <Note>Permit % is calculated on the marked-up sell price, not on cost — the engine solves it so the fee lands on the real valuation.</Note>
        </Section>

        {/* 10 MARKUPS */}
        <Section title="10 · Risk & markup" sub="What turns cost into price" defaultOpen>
          <Grid>
            <F label="Material sales tax %"><input type="number" step="0.1" className="rk-input" value={fields.m_tax} onChange={setNum("m_tax")} /></F>
            <F label="Contingency %"><input type="number" step="0.1" className="rk-input" value={fields.m_cont} onChange={setNum("m_cont")} /></F>
            <F label="General liability %"><input type="number" step="0.1" className="rk-input" value={fields.m_gl} onChange={setNum("m_gl")} /></F>
            <F label="Payment / performance bond %"><input type="number" step="0.1" className="rk-input" value={fields.m_bond} onChange={setNum("m_bond")} /></F>
            <F label="Overhead %"><input type="number" step="0.1" className="rk-input" value={fields.m_oh} onChange={setNum("m_oh")} /></F>
            <F label="Sales commission % (of sell)"><input type="number" step="0.1" className="rk-input" value={fields.m_comm} onChange={setNum("m_comm")} /></F>
            <F label="Target gross margin % (of sell)"><input type="number" step="0.1" className="rk-input" value={fields.m_margin} onChange={setNum("m_margin")} /></F>
            <F label="Financing / CC fee %"><input type="number" step="0.1" className="rk-input" value={fields.m_fin} onChange={setNum("m_fin")} /></F>
          </Grid>
          <Note>Margin, commission, permit %, bond and financing are all percentages <em>of sell price</em>, so they're solved together instead of stacked on cost. That's the difference between a 28% margin and thinking you have one.</Note>
        </Section>
        </>
        )}
      </div>


      {/* RAIL */}
      <ResultsRail result={result} fields={fields} details={details} scopeText={scopeText} onCopyScope={copyScope} />
    </div>
  );
}

/* ---------- Rail ---------- */

function ResultsRail({ result: r, fields, details, scopeText, onCopyScope }: {
  result: ReturnType<typeof calc>; fields: SpfFields; details: Detail[]; scopeText: string; onCopyScope: () => void;
}) {
  const psf = r.sell / Math.max(fields.p_sqft, 1);
  const psq = r.sell / Math.max(fields.p_sqft / 100, 1);
  return (
    <div className="space-y-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
      <div className="rk-card p-4">
        <div className="text-xs uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>Sell price</div>
        <div className="rk-num text-4xl font-bold leading-tight" style={{ color: "var(--rk-gold)" }}>{money(r.sell)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Kpi label="$ / sq ft" value={"$" + psf.toFixed(2)} />
          <Kpi label="$ / square" value={money(psq)} />
          <Kpi label="Total cost" value={money(r.totalCost)} />
          <Kpi label="Gross profit" value={money(r.gp) + " · " + (r.sell > 0 ? (r.gp / r.sell * 100).toFixed(1) : "0") + "%"} />
          <Kpi label="Crew days" value={String(r.days)} />
          <Kpi label="Board feet" value={Math.round(r.bf).toLocaleString()} />
          <Kpi label="Foam sets" value={String(r.sets)} />
          <Kpi label="Coating gal" value={Math.ceil(r.gal).toLocaleString()} />
        </div>
        <div className="mt-3 flex h-6 overflow-hidden rounded border" style={{ borderColor: "var(--rk-line)" }}>
          {r.groups.map((g) => (
            <div key={g.label} title={`${g.label} ${money(g.value)}`}
              style={{ width: `${Math.max(g.value / Math.max(r.sell, 1) * 100, 0)}%`, background: g.color }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px]" style={{ color: "var(--rk-ink-faint)" }}>
          {r.groups.map((g) => (
            <span key={g.label} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: g.color }} />
              {g.label} {r.sell > 0 ? (g.value / r.sell * 100).toFixed(1) : "0"}%
            </span>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          {r.flags.map((f, i) => (
            <div key={i} className="rounded border-l-[3px] px-2 py-1.5 text-[11.5px]"
              style={{
                borderColor: f.level === "err" ? "var(--rk-red)" : f.level === "warn" ? "var(--rk-gold)" : "var(--rk-green)",
                background: f.level === "err" ? "rgba(240,85,107,0.10)" : f.level === "warn" ? "rgba(240,167,58,0.10)" : "rgba(46,194,126,0.10)",
                color: f.level === "err" ? "#f3c4bb" : f.level === "warn" ? "#f0d5b0" : "#bfe6d2",
              }}>{f.text}</div>
          ))}
        </div>
      </div>

      <div className="rk-card p-4">
        <div className="mb-2 text-xs uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>Cost breakdown</div>
        <BreakdownList r={r} fields={fields} details={details} />
      </div>

      <div className="rk-card p-4 spf-noprint">
        <div className="mb-2 text-xs uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>Scope of work</div>
        <pre className="max-h-[420px] overflow-auto rounded border p-3 text-[11.5px] leading-relaxed"
          style={{ borderColor: "var(--rk-line)", background: "var(--rk-panel-2)", color: "var(--rk-ink)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
          {scopeText}
        </pre>
        <button onClick={onCopyScope} className="rk-btn rk-btn-ghost mt-2"><Copy className="h-3.5 w-3.5" /> Copy scope text</button>
      </div>
    </div>
  );
}

function BreakdownList({ r, fields, details }: { r: ReturnType<typeof calc>; fields: SpfFields; details: Detail[] }) {
  const rows: React.ReactNode[] = [];
  const grp = (label: string, val: number, k: string) => rows.push(
    <li key={k} className="mt-3 flex justify-between border-b pb-1" style={{ borderColor: "var(--rk-line)" }}>
      <span className="rk-display text-sm uppercase tracking-wider" style={{ color: "var(--rk-gold)" }}>{label}</span>
      <b className="font-mono" style={{ color: "var(--rk-gold)" }}>{money(val)}</b>
    </li>
  );
  const item = (label: string, val: number, k: string) => rows.push(
    <li key={k} className="flex justify-between gap-3 pl-2 text-[11.5px]" style={{ color: "var(--rk-ink-muted)" }}>
      <span>{label}</span><b className="font-mono">{money(val)}</b>
    </li>
  );

  grp("Materials", r.materials, "g-mat");
  if (r.foamMat) item(`Foam — ${r.sets} sets @ ${money(fields.f_cost + fields.f_freight)}`, r.foamMat, "i-foam");
  r.layerRows.forEach((row, i) =>
    item(`${row[0]} — ${row[4]} gal · ${row[3]} mil · ${row[2].toLowerCase()} · ${row[1].toLowerCase()}`, row[5], `i-l-${i}`)
  );
  if (r.fabMat) item(`Reinforcing fabric — ${fields.r_lf.toLocaleString()} LF`, r.fabMat, "i-fab");
  item(`Sales tax @ ${fields.m_tax}%`, r.tax, "i-tax");

  grp("Tear-off & prep", r.removal, "g-rem");
  if (r.tearCost) item(`Tear-off — ${r.tearSq.toFixed(1)} sq × ${fields.e_layers} layer(s)`, r.tearCost, "i-tear");
  if (r.deckRep) item("Deck / panel repair", r.deckRep, "i-deck");
  item("Wash & surface prep", r.prep, "i-prep");
  if (r.rust) item(`Rust removal — ${Math.round(r.rustArea).toLocaleString()} sq ft`, r.rust, "i-rust");
  if (r.mildew) item("Mildewcide treatment", r.mildew, "i-mildew");
  if (r.fastener) item("Fastener re-secure", r.fastener, "i-fast");

  grp("Labor", r.fieldLabor + r.gl, "g-lab");
  item(`Crew — ${r.days} days × ${fields.l_crew} men (burdened)`, r.labor, "i-crew");
  item("Supervision", r.superv, "i-sup");
  if (r.diem) item("Per diem", r.diem, "i-diem");
  if (r.lodge) item("Lodging", r.lodge, "i-lodge");
  item("Mobilization", r.mob, "i-mob");
  item(`General liability @ ${fields.m_gl}%`, r.gl, "i-gl");

  grp("Equipment", r.equipment, "g-eq");
  item(`Rig & consumables — ${r.days} days`, r.equipDaily, "i-rig");
  if (r.lift) item("Lift rental + delivery", r.lift, "i-lift");
  if (r.crane) item("Crane", r.crane, "i-crane");
  if (r.dumps) item("Disposal containers", r.dumps, "i-dumps");
  if (r.miscEq) item("Hoist / overspray / screens / hand tools", r.miscEq, "i-misc");

  grp("Details & hardware", r.details, "g-det");
  details.forEach((d, i) => { if (d[2] * d[3]) item(`${d[0]} — ${d[2]} ${d[1]}`, d[2] * d[3], `i-d-${i}`); });

  grp("Soft costs", r.soft + r.permit, "g-soft");
  if (r.eng) item("Engineering", r.eng, "i-eng");
  item("Permit", r.permit, "i-perm");
  if (r.softFixed) item("Plan review, testing, inspections", r.softFixed, "i-soft");
  if (r.warranty) item(`Manufacturer warranty @ $${parseFloat(fields.s_war).toFixed(2)}/sf`, r.warranty, "i-war");

  grp("Overhead, contingency & fees", r.oh + r.cont + r.commission + r.finance + r.bondC, "g-oh");
  item(`Contingency @ ${fields.m_cont}%`, r.cont, "i-cont");
  item(`Overhead @ ${fields.m_oh}%`, r.oh, "i-ohv");
  if (r.commission) item(`Commission @ ${fields.m_comm}%`, r.commission, "i-comm");
  if (r.bondC) item(`Bond @ ${fields.m_bond}%`, r.bondC, "i-bond");
  if (r.finance) item(`Financing @ ${fields.m_fin}%`, r.finance, "i-fin");

  rows.push(
    <li key="tot" className="mt-3 flex justify-between border-t-2 pt-2 text-[15px]" style={{ borderColor: "var(--rk-line)" }}>
      <span className="rk-display uppercase" style={{ fontSize: 16 }}>Total cost</span>
      <b className="font-mono">{money(r.totalCost)}</b>
    </li>
  );
  rows.push(
    <li key="sell" className="flex justify-between text-[15px]">
      <span className="rk-display uppercase" style={{ fontSize: 16, color: "var(--rk-gold)" }}>Sell price</span>
      <b className="font-mono" style={{ color: "var(--rk-gold)" }}>{money(r.sell)}</b>
    </li>
  );
  return <ul className="space-y-0.5">{rows}</ul>;
}

/* ---------- Small helpers ---------- */

function Section({ title, sub, defaultOpen, children }: { title: string; sub?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="rk-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5" style={{ background: "var(--rk-panel-2)" }}>
        <span className="inline-block h-4 w-[3px] rounded-sm" style={{ background: "var(--rk-gold)" }} />
        <span className="rk-display text-[15px] uppercase tracking-wider">{title}</span>
        {sub && <span className="ml-auto text-[11px]" style={{ color: "var(--rk-ink-faint)" }}>{sub}</span>}
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))" }}>{children}</div>;
}
function F({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={"flex flex-col gap-1 " + (wide ? "[grid-column:1/-1]" : "")}>
      <label className="rk-label">{label}</label>
      {children}
    </div>
  );
}
function Sel({ value, onChange, opts }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; opts: [string, string][] }) {
  return (
    <select className="rk-input" value={value} onChange={onChange}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--rk-ink-faint)" }}>{children}</p>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-2" style={{ borderColor: "var(--rk-line)", background: "var(--rk-panel-2)" }}>
      <span className="block text-[9.5px] uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>{label}</span>
      <b className="rk-num text-[14px] font-medium">{value}</b>
    </div>
  );
}


