import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { CbCard, CbBadge, CbChip, CbButton } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { CB_ELEVATIONS, CB_ELEVATION_LABEL, type CbElevation, type CbElevationState, type CbRoom } from "@/lib/cbTakeoff";
import type { CbLineItem, CbNarrative, CbReportPhoto } from "@/lib/cbReport";
import { CB_PHOTO_CATEGORY_LABEL } from "@/lib/cbReport";
import type { CbSheet, CbVentResult } from "@/lib/cbSheet";

export interface CbReportViewModel {
  company: {
    name?: string | null;
    legal_name?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    license_numbers?: unknown;
  } | null;
  logoUrl: string | null;
  job: Record<string, string | number | null | undefined> | null;
  repName: string | null;
  coverPhoto: CbReportPhoto | null;
  photos: CbReportPhoto[];
  urls: Record<string, string>;
  sheet: CbSheet;
  rooms: CbRoom[];
  elevations: Partial<Record<CbElevation, CbElevationState>>;
  measurement: Record<string, number | string | null> | null;
  measurementSource: string | null;
  vent: CbVentResult;
  narrative: CbNarrative;
  lineItems: CbLineItem[];
  version: number;
  generatedAt: string;
}

export function licenseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : String((x as { number?: string })?.number ?? ""))).filter(Boolean);
  if (v && typeof v === "object") return Object.values(v as Record<string, string>).filter(Boolean);
  return [];
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <CbReveal>
      <CbCard elevation="raised" className="mt-4 cb-report-section" style={{ padding: 22 }}>
        <div className="flex items-baseline gap-2">
          <span className="cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
            {String(n).padStart(2, "0")}
          </span>
          <h2 className="cb-display" style={{ fontSize: 18, margin: 0 }}>
            {title}
          </h2>
        </div>
        <div className="mt-3">{children}</div>
      </CbCard>
    </CbReveal>
  );
}

function Editable({
  value,
  onChange,
  editable,
  rows = 5,
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  editable: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  if (!editable) {
    return (
      <p className="text-[15px] leading-[1.65]" style={{ color: "var(--cb-text)", whiteSpace: "pre-wrap" }}>
        {value}
      </p>
    );
  }
  return (
    <textarea
      className="cb-input w-full"
      rows={rows}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onChange?.(local)}
      style={{ fontSize: 15, lineHeight: 1.6, resize: "vertical" }}
    />
  );
}

function Photo({
  photo,
  urls,
  width = 168,
  variant = "full",
  index,
}: {
  photo: CbReportPhoto;
  urls: Record<string, string>;
  width?: number;
  /** "thumb" renders a compact contact-sheet tile with no caption text. */
  variant?: "full" | "thumb";
  index?: number;
}) {
  const url = urls[photo.thumb_path ?? photo.storage_path] ?? urls[photo.storage_path];
  const thumb = variant === "thumb";
  return (
    <figure className="cb-report-photo m-0" style={{ width: thumb ? undefined : width }}>
      <div
        style={{
          width: "100%",
          aspectRatio: thumb ? "1 / 1" : "4 / 3",
          borderRadius: thumb ? 7 : 10,
          overflow: "hidden",
          border: "1px solid var(--cb-border)",
          background: "var(--cb-surface-2, rgba(0,0,0,.04))",
        }}
      >
        {url ? <img src={url} alt={photo.caption ?? ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      </div>
      <figcaption
        className={thumb ? "mt-[3px] text-[10px]" : "mt-1 text-[11.5px]"}
        style={{ color: "var(--cb-text-muted)", ...(thumb ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : null) }}
      >
        {thumb ? String(index ?? "") : photo.caption || [photo.shot_type, photo.item_key].filter(Boolean).join(" · ") || "—"}
      </figcaption>
    </figure>
  );

}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[5px]" style={{ borderBottom: "1px solid var(--cb-border)" }}>
      <span className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
        {label}
      </span>
      <span className="cb-num text-[14px]" style={{ color: "var(--cb-text)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export function CbReportDoc({
  vm,
  editable = false,
  onNarrative,
  onLineItems,
}: {
  vm: CbReportViewModel;
  editable?: boolean;
  onNarrative?: (patch: Partial<CbNarrative>) => void;
  onLineItems?: (items: CbLineItem[]) => void;
}) {
  const { job, company, sheet, elevations, rooms, measurement, vent, narrative, lineItems, urls, photos } = vm;
  const licenses = licenseList(company?.license_numbers);
  const m = (k: string) => Number(measurement?.[k] ?? 0) || 0;

  const byCat = useMemo(() => {
    const map: Record<string, CbReportPhoto[]> = {};
    for (const p of photos) (map[p.category ?? "other"] ??= []).push(p);
    return map;
  }, [photos]);

  const photoById = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p])), [photos]);

  function patchItem(id: string, patch: Partial<CbLineItem>) {
    onLineItems?.(lineItems.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function move(id: string, dir: -1 | 1) {
    const i = lineItems.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lineItems.length) return;
    const next = [...lineItems];
    [next[i], next[j]] = [next[j], next[i]];
    onLineItems?.(next);
  }

  return (
    <div className="cb-report" id="cb-report-doc">
      {/* 1 — COVER */}
      <CbReveal>
        <CbCard elevation="floating" className="cb-report-section" style={{ padding: 24 }}>
          <div className="flex items-start justify-between gap-3">
            {vm.logoUrl ? (
              <img src={vm.logoUrl} alt={`${company?.name ?? "Company"} logo`} style={{ maxHeight: 56, maxWidth: 200, objectFit: "contain" }} />
            ) : (
              <span className="cb-display" style={{ fontSize: 20 }}>
                {company?.name}
              </span>
            )}
            <CbBadge tone="accent">v{vm.version}</CbBadge>
          </div>
          <h1 className="cb-display mt-4" style={{ fontSize: 27, margin: "16px 0 0" }}>
            Property Damage Inspection Report
          </h1>
          {vm.coverPhoto ? (
            <div
              className="mt-4"
              style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 14, overflow: "hidden", border: "1px solid var(--cb-border)" }}
            >
              <img
                src={urls[vm.coverPhoto.storage_path] ?? urls[vm.coverPhoto.thumb_path ?? ""] ?? ""}
                alt="Front of the property"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-x-5">
            <Row label="Property" value={String(job?.address ?? "—")} />
            <Row label="City / state" value={[job?.city, job?.state, job?.zip].filter(Boolean).join(", ") || "—"} />
            <Row label="Homeowner" value={String(job?.customer_name ?? "—")} />
            <Row label="Carrier" value={String(job?.carrier ?? "—")} />
            <Row label="Claim number" value={String(job?.claim_number ?? "—")} />
            <Row label="Date of loss" value={String(job?.date_of_loss ?? "—")} />
            <Row label="Inspection date" value={String(job?.inspection_date ?? "—")} />
            <Row label="Inspecting rep" value={vm.repName ?? "—"} />
            <Row label="Contractor" value={company?.legal_name || company?.name || "—"} />
            <Row label="License" value={licenses.join(", ") || "—"} />
          </div>
        </CbCard>
      </CbReveal>

      {/* 2 — SUMMARY */}
      <Section n={2} title="Summary of findings">
        <Editable value={narrative.summary} editable={editable} onChange={(v) => onNarrative?.({ summary: v })} rows={6} />
      </Section>

      {/* 3 — PROFILE */}
      <Section n={3} title="Property and roof profile">
        <div className="grid gap-x-6 md:grid-cols-2">
          <div>
            <span className="cb-microlabel">Roof system</span>
            <Row label="Roof type" value={sheet.roof_system.roof_type ?? "—"} />
            <Row label="Stories" value={sheet.roof_system.stories ?? "—"} />
            <Row label="Pitch" value={sheet.roof_system.pitch ?? measurement?.pitch ?? "—"} />
            <Row label="Layers" value={sheet.roof_system.layers ?? "—"} />
            <Row label="Decking" value={sheet.roof_system.decking_type ?? "—"} />
            <Row label="Decking condition" value={sheet.roof_system.decking_condition ?? "—"} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="cb-microlabel">Measurements</span>
              {vm.measurementSource ? <CbChip>{vm.measurementSource}</CbChip> : null}
            </div>
            <Row label="Total squares" value={m("total_squares").toFixed(1)} />
            <Row label="Roof area" value={`${m("total_area_sqft").toLocaleString()} SF`} />
            <Row label="Ridge / hip" value={`${m("ridge_lf")} / ${m("hip_lf")} LF`} />
            <Row label="Valley" value={`${m("valley_lf")} LF`} />
            <Row label="Eave / rake" value={`${m("eave_lf")} / ${m("rake_lf")} LF`} />
            <Row label="Facets" value={measurement?.facets ?? "—"} />
          </div>
        </div>
        <div className="mt-3">
          <Editable
            value={narrative.profile_note ?? ""}
            editable={editable}
            rows={3}
            placeholder="Optional note on the property or roof profile…"
            onChange={(v) => onNarrative?.({ profile_note: v })}
          />
        </div>
      </Section>

      {/* 4 — ROOF FINDINGS */}
      <Section n={4} title="Roof findings by elevation">
        {CB_ELEVATIONS.map((e) => {
          const st = elevations[e];
          if (!st || (!st.slopeWide && !st.wide && !st.done && !(st.testSquares ?? []).length)) return null;
          const hits = (st.testSquares ?? []).reduce((a, t) => a + (t.hits ?? 0), 0);
          const damaged = Object.keys(st.roofItems ?? {}).length > 0 || hits > 0;
          const slopePhotos = photos.filter((p) => p.category === "roof" && p.elevation === e);
          return (
            <div key={e} className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="cb-display" style={{ fontSize: 15, margin: 0 }}>
                  {CB_ELEVATION_LABEL[e]} elevation
                </h3>
                {damaged ? (
                  <CbBadge tone="warning">{hits} hit{hits === 1 ? "" : "s"} in test square</CbBadge>
                ) : (
                  <CbBadge tone="neutral">Inspected — no damage observed</CbBadge>
                )}
              </div>
              {Object.entries(st.roofItems ?? {}).length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-[14px]" style={{ color: "var(--cb-text)" }}>
                  {Object.entries(st.roofItems ?? {}).map(([k, v]) => (
                    <li key={k}>
                      {k.replace(/_/g, " ")}
                      {v.qty ? ` — ${v.qty}` : ""}
                      {v.note ? ` — ${v.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {slopePhotos.length ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {slopePhotos.slice(0, 6).map((p) => (
                    <Photo key={p.id} photo={p} urls={urls} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <Editable
          value={narrative.roof_note ?? ""}
          editable={editable}
          rows={3}
          placeholder="Optional roof narrative…"
          onChange={(v) => onNarrative?.({ roof_note: v })}
        />
      </Section>

      {/* 5 — EXTERIOR */}
      <Section n={5} title="Exterior findings by elevation">
        {CB_ELEVATIONS.map((e) => {
          const st = elevations[e];
          const elevPhotos = photos.filter((p) => p.category === "exterior" && p.elevation === e);
          if (!st && elevPhotos.length === 0) return null;
          const items = Object.entries(st?.items ?? {});
          return (
            <div key={e} className="mb-4">
              <div className="flex items-center gap-2">
                <h3 className="cb-display" style={{ fontSize: 15, margin: 0 }}>
                  {CB_ELEVATION_LABEL[e]} elevation
                </h3>
                {items.length === 0 ? <CbBadge tone="neutral">Inspected — no damage observed</CbBadge> : null}
              </div>
              {items.map(([k, v]) => {
                const pair = photos.filter((p) => p.item_key === k && p.elevation === e);
                return (
                  <div key={k} className="mt-2">
                    <p className="text-[14px]" style={{ color: "var(--cb-text)" }}>
                      {k.replace(/_/g, " ")}
                      {v.qty ? ` — qty ${v.qty}` : ""}
                      {v.note ? ` — ${v.note}` : ""}
                    </p>
                    {pair.length ? (
                      <div className="mt-1 flex flex-wrap gap-3">
                        {pair.slice(0, 4).map((p) => (
                          <Photo key={p.id} photo={p} urls={urls} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {items.length === 0 && elevPhotos.length ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {elevPhotos.slice(0, 4).map((p) => (
                    <Photo key={p.id} photo={p} urls={urls} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <Editable
          value={narrative.exterior_note ?? ""}
          editable={editable}
          rows={3}
          placeholder="Optional exterior narrative…"
          onChange={(v) => onNarrative?.({ exterior_note: v })}
        />
      </Section>

      {/* 6 — INTERIOR */}
      {rooms.length > 0 ? (
        <Section n={6} title="Interior findings">
          {rooms.map((r) => (
            <div key={r.id} className="mb-3">
              <div className="flex items-center gap-2">
                <h3 className="cb-display" style={{ fontSize: 15, margin: 0 }}>
                  {r.name}
                </h3>
                {r.moisture != null ? <CbChip>{r.moisture}% moisture</CbChip> : null}
              </div>
              {Object.entries(r.items ?? {}).length ? (
                <ul className="mt-1 list-disc pl-5 text-[14px]" style={{ color: "var(--cb-text)" }}>
                  {Object.entries(r.items ?? {}).map(([k, v]) => (
                    <li key={k}>
                      {k.replace(/_/g, " ")}
                      {v.qty ? ` — ${v.qty}` : ""}
                      {v.note ? ` — ${v.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {r.note ? (
                <p className="text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
                  {r.note}
                </p>
              ) : null}
            </div>
          ))}
          <Editable
            value={narrative.interior_note ?? ""}
            editable={editable}
            rows={3}
            placeholder="Optional interior narrative…"
            onChange={(v) => onNarrative?.({ interior_note: v })}
          />
        </Section>
      ) : null}

      {/* 7 — SCOPE */}
      <Section n={7} title="Recommended scope of work">
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Quantities only — no pricing is included in this report unless a priced estimate is attached to the job.
        </p>
        <div className="grid gap-1">
          {lineItems.map((it, i) => (
            <div
              key={it.id}
              className="grid items-center gap-2"
              style={{
                gridTemplateColumns: editable ? "20px 1fr 80px 60px 66px" : "24px 1fr 90px 56px",
                borderBottom: "1px solid var(--cb-border)",
                padding: "6px 0",
              }}
            >
              <span className="cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                {editable ? <GripVertical size={14} /> : i + 1}
              </span>
              {editable ? (
                <input
                  className="cb-input"
                  defaultValue={it.description}
                  onBlur={(e) => patchItem(it.id, { description: e.target.value })}
                  style={{ fontSize: 14, padding: "6px 8px" }}
                />
              ) : (
                <span className="text-[14px]" style={{ color: "var(--cb-text)" }}>
                  {it.description}
                  {it.note ? (
                    <em className="block text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                      {it.note}
                    </em>
                  ) : null}
                  {it.photo_ids.length ? (
                    <span className="block text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
                      {it.photo_ids.filter((id) => photoById[id]).length} supporting photo(s)
                    </span>
                  ) : null}
                </span>
              )}
              {editable ? (
                <input
                  className="cb-input cb-num"
                  type="number"
                  defaultValue={it.quantity}
                  onBlur={(e) => patchItem(it.id, { quantity: Number(e.target.value) || 0 })}
                  style={{ fontSize: 14, padding: "6px 8px", textAlign: "right" }}
                />
              ) : (
                <span className="cb-num text-right text-[14px]">{it.quantity.toLocaleString()}</span>
              )}
              {editable ? (
                <input
                  className="cb-input"
                  defaultValue={it.unit}
                  onBlur={(e) => patchItem(it.id, { unit: e.target.value })}
                  style={{ fontSize: 14, padding: "6px 8px" }}
                />
              ) : (
                <span className="cb-num text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {it.unit}
                </span>
              )}
              {editable ? (
                <span className="flex gap-1">
                  <button type="button" aria-label="Move up" className="cb-icon-btn" onClick={() => move(it.id, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" className="cb-icon-btn" onClick={() => move(it.id, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Delete line"
                    className="cb-icon-btn"
                    onClick={() => onLineItems?.(lineItems.filter((x) => x.id !== it.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {editable ? (
          <CbButton
            size="md"
            variant="secondary"
            className="mt-3"
            onClick={() =>
              onLineItems?.([
                ...lineItems,
                {
                  id: Math.random().toString(36).slice(2, 10),
                  description: "New line item",
                  quantity: 1,
                  unit: "EA",
                  photo_ids: [],
                  source: "manual",
                },
              ])
            }
          >
            <Plus size={16} /> Add line item
          </CbButton>
        ) : null}
        <div className="mt-3">
          <Editable
            value={narrative.scope_note ?? ""}
            editable={editable}
            rows={3}
            placeholder="Optional scope note…"
            onChange={(v) => onNarrative?.({ scope_note: v })}
          />
        </div>
      </Section>

      {/* 8 — VENTILATION */}
      <Section n={8} title="Ventilation analysis">
        <div className="grid gap-x-6 md:grid-cols-2">
          <div>
            <Row label="Attic area (approx.)" value={`${vent.atticSqft.toLocaleString()} SF`} />
            <Row label="Required NFA (1/150)" value={`${vent.requiredNfa.toLocaleString()} sq in`} />
          </div>
          <div>
            <Row label="Provided NFA" value={`${vent.providedNfa.toLocaleString()} sq in`} />
            <Row label="Intake / exhaust" value={`${vent.intakeNfa} / ${vent.exhaustNfa} sq in`} />
          </div>
        </div>
        {vent.under ? (
          <p className="mt-3 text-[14px]" style={{ color: "var(--cb-warning, #b45309)" }}>
            Existing ventilation is below code-required NFA for this attic area — a deficit of {vent.deficit.toLocaleString()} sq in.
            {vent.recommendation ? ` ${vent.recommendation}` : ""}
          </p>
        ) : (
          <p className="mt-3 text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
            Existing ventilation meets the code-required net free area for this attic area.
          </p>
        )}
      </Section>

      {/* 9 — APPENDIX (contact sheet: thumbnails only, no full-size repeats) */}
      <Section n={9} title="Photo appendix">
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Contact sheet of all {photos.length} photo{photos.length === 1 ? "" : "s"} — full-size images appear once, inline with the findings above.
        </p>
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat} className="mb-4">
            <span className="cb-microlabel">
              {CB_PHOTO_CATEGORY_LABEL[cat] ?? cat} · {list.length}
            </span>
            {CB_ELEVATIONS.some((e) => list.some((p) => p.elevation === e)) ? (
              CB_ELEVATIONS.map((e) => {
                const sub = list.filter((p) => p.elevation === e);
                if (!sub.length) return null;
                return (
                  <div key={e} className="mt-2">
                    <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                      {CB_ELEVATION_LABEL[e]}
                    </p>
                    <div className="mt-1 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {sub.map((p) => (
                        <Photo key={p.id} photo={p} urls={urls} variant="thumb" index={photoIndex[p.id]} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {list.map((p) => (
                  <Photo key={p.id} photo={p} urls={urls} variant="thumb" index={photoIndex[p.id]} />
                ))}
              </div>
            )}
          </div>

        ))}
      </Section>

      {/* 10 — STATEMENT */}
      <Section n={10} title="Statement and signature">
        <Editable value={narrative.statement} editable={editable} rows={5} onChange={(v) => onNarrative?.({ statement: v })} />
        <div className="mt-4 grid gap-x-6 md:grid-cols-2">
          <div>
            <span className="cb-microlabel">Inspecting representative</span>
            <p className="text-[15px]" style={{ color: "var(--cb-text)" }}>
              {vm.repName ?? "—"}
            </p>
            <div className="mt-6" style={{ borderTop: "1px solid var(--cb-text-muted)", width: 220 }} />
            <span className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
              Signature · {new Date(vm.generatedAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="cb-microlabel">Contractor</span>
            <p className="text-[15px]" style={{ color: "var(--cb-text)" }}>
              {company?.legal_name || company?.name}
            </p>
            <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {[company?.phone, company?.email, company?.website].filter(Boolean).join(" · ")}
            </p>
            {licenses.length ? (
              <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                License: {licenses.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </Section>
    </div>
  );
}
