/**
 * Editable review of the generated report body. Everything the model wrote —
 * summary paragraphs, every scope row, every photo caption and the
 * information-still-needed list — is editable here before the PDF is rendered.
 */
import { Plus, Trash2 } from "lucide-react";
import { CbCard, CbButton } from "@/components/cb/primitives";
import type { CbAiReport, CbAiScopeRow } from "@/lib/cbReportAi";
import type { CbReportPhoto } from "@/lib/cbReport";

function Field({
  label,
  value,
  rows = 3,
  onChange,
}: {
  label?: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
          {label}
        </span>
      ) : null}
      <textarea
        className="cb-input w-full"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 14, lineHeight: 1.55, resize: "vertical" }}
      />
    </label>
  );
}

function ScopeEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: CbAiScopeRow[];
  onChange: (rows: CbAiScopeRow[]) => void;
}) {
  const set = (i: number, patch: Partial<CbAiScopeRow>) =>
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <CbCard elevation="raised" className="mt-3" style={{ padding: 18 }}>
      <div className="flex items-center justify-between">
        <h3 className="cb-display" style={{ fontSize: 16, margin: 0 }}>
          {title}
        </h3>
        <CbButton
          size="md"
          variant="ghost"
          onClick={() => onChange([...rows, { component: "", condition: "", action: "" }])}
        >
          <Plus size={15} /> Add row
        </CbButton>
      </div>
      <div className="mt-3 grid gap-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-xl p-3" style={{ border: "1px solid var(--cb-border)" }}>
            <div className="flex items-start gap-2">
              <input
                className="cb-input w-full"
                value={r.component}
                placeholder="Component / trade"
                onChange={(e) => set(i, { component: e.target.value })}
                style={{ fontSize: 14, fontWeight: 600 }}
              />
              <CbButton size="md" variant="ghost" onClick={() => onChange(rows.filter((_, k) => k !== i))}>
                <Trash2 size={15} />
              </CbButton>
            </div>
            <Field label="Observed condition" rows={2} value={r.condition} onChange={(v) => set(i, { condition: v })} />
            <Field label="Recommended action" rows={2} value={r.action} onChange={(v) => set(i, { action: v })} />
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            No rows — the section prints as “Not inspected”.
          </p>
        ) : null}
      </div>
    </CbCard>
  );
}

export function CbReportReview({
  ai,
  photos,
  onChange,
}: {
  ai: CbAiReport;
  photos: CbReportPhoto[];
  onChange: (next: CbAiReport) => void;
}) {
  const patch = (p: Partial<CbAiReport>) => onChange({ ...ai, ...p });
  const captionFor = (id: string) => ai.photo_captions.find((c) => c.photo_id === id);
  const setCaption = (id: string, field: "title" | "description", v: string) => {
    const exists = captionFor(id);
    patch({
      photo_captions: exists
        ? ai.photo_captions.map((c) => (c.photo_id === id ? { ...c, [field]: v } : c))
        : [...ai.photo_captions, { photo_id: id, title: "", description: "", [field]: v } as never],
    });
  };

  return (
    <div className="grid gap-3">
      <CbCard elevation="raised" style={{ padding: 18 }}>
        <h3 className="cb-display" style={{ fontSize: 16, margin: 0 }}>
          Summary of findings
        </h3>
        <div className="mt-3 grid gap-3">
          {(ai.summary.length ? ai.summary : [""]).map((p, i) => (
            <Field
              key={i}
              label={`Paragraph ${i + 1}`}
              rows={4}
              value={p}
              onChange={(v) => patch({ summary: (ai.summary.length ? ai.summary : [""]).map((x, k) => (k === i ? v : x)) })}
            />
          ))}
          <CbButton size="md" variant="ghost" onClick={() => patch({ summary: [...ai.summary, ""] })}>
            <Plus size={15} /> Add paragraph
          </CbButton>
        </div>
        <div className="mt-4 grid gap-3">
          <Field label="Cover photo caption" rows={2} value={ai.cover_caption} onChange={(v) => patch({ cover_caption: v })} />
          <Field label="Interior note" rows={2} value={ai.interior_note} onChange={(v) => patch({ interior_note: v })} />
          <Field label="Storm event & claim context" rows={4} value={ai.storm_context} onChange={(v) => patch({ storm_context: v })} />
        </div>
      </CbCard>

      <ScopeEditor title="Scope of loss — roof system" rows={ai.roof_scope} onChange={(rows) => patch({ roof_scope: rows })} />
      <ScopeEditor
        title="Scope of loss — exterior components"
        rows={ai.exterior_scope}
        onChange={(rows) => patch({ exterior_scope: rows })}
      />

      <CbCard elevation="raised" style={{ padding: 18 }}>
        <h3 className="cb-display" style={{ fontSize: 16, margin: 0 }}>
          Photo captions
        </h3>
        <div className="mt-3 grid gap-3">
          {photos.map((p) => (
            <div key={p.id} className="grid gap-2 rounded-xl p-3" style={{ border: "1px solid var(--cb-border)" }}>
              <input
                className="cb-input w-full"
                value={captionFor(p.id)?.title ?? ""}
                placeholder="Photo title"
                onChange={(e) => setCaption(p.id, "title", e.target.value)}
                style={{ fontSize: 14, fontWeight: 600 }}
              />
              <Field
                rows={2}
                value={captionFor(p.id)?.description ?? ""}
                onChange={(v) => setCaption(p.id, "description", v)}
              />
            </div>
          ))}
          {photos.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              No photos on this inspection.
            </p>
          ) : null}
        </div>
      </CbCard>

      <CbCard elevation="raised" style={{ padding: 18 }}>
        <div className="flex items-center justify-between">
          <h3 className="cb-display" style={{ fontSize: 16, margin: 0 }}>
            Information still needed
          </h3>
          <CbButton size="md" variant="ghost" onClick={() => patch({ missing: [...ai.missing, ""] })}>
            <Plus size={15} /> Add
          </CbButton>
        </div>
        <div className="mt-3 grid gap-2">
          {ai.missing.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="cb-input w-full"
                value={m}
                onChange={(e) => patch({ missing: ai.missing.map((x, k) => (k === i ? e.target.value : x)) })}
                style={{ fontSize: 14 }}
              />
              <CbButton size="md" variant="ghost" onClick={() => patch({ missing: ai.missing.filter((_, k) => k !== i) })}>
                <Trash2 size={15} />
              </CbButton>
            </div>
          ))}
        </div>
      </CbCard>
    </div>
  );
}
