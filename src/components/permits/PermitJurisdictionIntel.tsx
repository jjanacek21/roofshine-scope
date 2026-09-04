import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, FileText, Hammer, Loader2, ScrollText } from "lucide-react";
import {
  fasteningSchedule,
  refFormTemplates,
  refInspectionSequence,
  rulesForJob,
  type FasteningSchedule,
  type RefDepartmentRule,
  type RefFastenerPattern,
  type RefFormTemplate,
  type RefInspectionStep,
} from "@/lib/permits/reference";

/**
 * What this jurisdiction expects, read straight off the shared library.
 *
 * Nothing here is editable — it is reference, not job data. It sits on the
 * permit tab because the person assembling a packet is the person who needs
 * to know that this county rejects anything without a notarised affidavit.
 */

const card = { borderColor: "var(--border)", background: "var(--bg-card)" };

const EMPTY: FasteningSchedule = { corner: [], perimeter: [], field: [], general: [] };

function ruleJurisdictionLabel(rule: RefDepartmentRule): string | null {
  if (rule.city) return rule.city;
  if (rule.county) return `${rule.county} County`;
  return null;
}

function dedupeInspections(rows: RefInspectionStep[]): RefInspectionStep[] {
  const groups = new Map<string, RefInspectionStep[]>();
  for (const row of rows) {
    const key = row.inspection_type.toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const picked = Array.from(groups.values()).map((group) =>
    group.reduce((best, current) => {
      const score = (r: RefInspectionStep) =>
        (r.description ? 2 : 0) + (r.inspection_code ? 1 : 0);
      const bestScore = score(best);
      const currentScore = score(current);
      if (currentScore > bestScore) return current;
      if (currentScore === bestScore && (current.order_in_sequence ?? Infinity) < (best.order_in_sequence ?? Infinity)) {
        return current;
      }
      return best;
    }),
  );

  return picked.sort((a, b) => (a.order_in_sequence ?? Infinity) - (b.order_in_sequence ?? Infinity));
}

export function PermitJurisdictionIntel({
  department,
  roofMaterial,
  hvhz,
}: {
  department: { id?: string | null; county?: string | null; city?: string | null } | null;
  roofMaterial?: string | null;
  hvhz?: boolean;
}) {
  const deptId = department?.id ?? null;
  const county = department?.county ?? null;
  const city = department?.city ?? null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<RefDepartmentRule[]>([]);
  const [forms, setForms] = useState<RefFormTemplate[]>([]);
  const [fasteners, setFasteners] = useState<FasteningSchedule>(EMPTY);
  const [inspections, setInspections] = useState<RefInspectionStep[]>([]);

  useEffect(() => {
    if (!deptId && !county) return;
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      rulesForJob({ id: deptId, county, city }),
      refFormTemplates(
        deptId ? { building_dept_id: deptId } : { county: county ?? undefined },
      ),
      fasteningSchedule({ county, city, roofMaterial, hvhz }),
      refInspectionSequence({ category: "roofing" }),
    ])
      .then(([r, f, fs, insp]) => {
        if (!alive) return;

        const filteredRules = (r as RefDepartmentRule[]).filter(
          (rule) => rule.county !== "Pending Detection",
        );
        const sortedRules = [...filteredRules].sort((a, b) => {
          const aLocal =
            a.city && city && a.city.toLowerCase() === city.toLowerCase() ? 1 : 0;
          const bLocal =
            b.city && city && b.city.toLowerCase() === city.toLowerCase() ? 1 : 0;
          if (aLocal !== bLocal) return bLocal - aLocal;
          return (a.priority ?? Infinity) - (b.priority ?? Infinity);
        });

        const filteredFasteners: FasteningSchedule = {
          corner: fs.corner.filter(
            (p) => p.jurisdiction_county !== "Pending Detection",
          ),
          perimeter: fs.perimeter.filter(
            (p) => p.jurisdiction_county !== "Pending Detection",
          ),
          field: fs.field.filter(
            (p) => p.jurisdiction_county !== "Pending Detection",
          ),
          general: fs.general.filter(
            (p) => p.jurisdiction_county !== "Pending Detection",
          ),
        };

        setRules(sortedRules);
        setForms(f);
        setFasteners(filteredFasteners);
        setInspections(insp);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not read the permit library");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [deptId, county, city, roofMaterial, hvhz]);

  if (!deptId && !county) return null;

  if (loading) {
    return (
      <section className="rounded-xl border p-4" style={card}>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading what this jurisdiction requires…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border p-4" style={card}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              Jurisdiction rules unavailable
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  const fillable = forms.filter((f) => f.is_fillable);
  const unmapped = forms.filter((f) => !f.is_fillable);
  const zones: { label: string; rows: RefFastenerPattern[] }[] = [
    { label: "Corner", rows: fasteners.corner },
    { label: "Perimeter", rows: fasteners.perimeter },
    { label: "Field", rows: fasteners.field },
    { label: "General", rows: fasteners.general },
  ].filter((z) => z.rows.length > 0);

  if (!rules.length && !forms.length && !zones.length && !inspections.length) return null;

  return (
    <section className="rounded-xl border p-4" style={card}>
      <h3 className="mb-3 text-[13px] font-semibold text-foreground">
        What this jurisdiction requires
      </h3>

      <div className="space-y-5">
        {rules.length > 0 && (
          <div>
            <Heading icon={<ScrollText className="h-3.5 w-3.5" />}>
              Rules that get packets rejected
            </Heading>
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="border-l-2 pl-3"
                  style={{ borderColor: "var(--brand)" }}
                >
                  <p className="text-[12px] text-foreground">{r.rule_description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[
                      ruleJurisdictionLabel(r),
                      r.rule_type?.replace(/_/g, " "),
                      r.rule_action,
                      r.document_required ? `needs ${r.document_required}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {forms.length > 0 && (
          <div>
            <Heading icon={<FileText className="h-3.5 w-3.5" />}>
              Forms this department publishes
            </Heading>
            <div className="space-y-2">
              {fillable.map((f) => (
                <FormRow key={f.id} f={f} />
              ))}
            </div>
            {unmapped.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">
                  {unmapped.length} more on file, not yet mapped for auto-fill
                </summary>
                <div className="mt-2 space-y-2">
                  {unmapped.map((f) => (
                    <FormRow key={f.id} f={f} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {zones.length > 0 && (
          <div>
            <Heading icon={<Hammer className="h-3.5 w-3.5" />}>Fastening schedule</Heading>
            <div className="grid gap-2 sm:grid-cols-2">
              {zones.map((z) => (
                <div
                  key={z.label}
                  className="rounded-lg border p-2.5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <p className="mb-1 text-[12px] font-medium text-foreground">{z.label}</p>
                  <div className="space-y-1.5">
                    {z.rows.map((p) => (
                      <div key={p.id}>
                        <p className="text-[12px] text-foreground">
                          {p.spacing_description ??
                            (p.spacing_inches != null ? `${p.spacing_inches}" o.c.` : "—")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            p.fastener_for,
                            p.nail_type,
                            p.nail_length,
                            p.nail_gauge ? `${p.nail_gauge} ga` : null,
                            p.deck_type ? `${p.deck_type} deck` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {p.source_document && (
                          <p className="text-[11px] text-muted-foreground">
                            {p.source_document}
                            {p.source_page != null ? `, p.${p.source_page}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Corners and perimeters fasten tighter than the field. Always confirm against the
              approval on the packet — the NOA governs, not this summary.
            </p>
          </div>
        )}

        {inspections.length > 0 && (
          <div>
            <Heading icon={<ClipboardList className="h-3.5 w-3.5" />}>Inspection order</Heading>
            <ol className="space-y-1.5">
              {inspections.map((i, idx) => (
                <li key={i.id} className="flex gap-2">
                  <span className="shrink-0 text-[11px] text-muted-foreground">{idx + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-[12px] text-foreground">
                      {i.inspection_type}
                      {i.inspection_code && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          {i.inspection_code}
                        </span>
                      )}
                    </p>
                    {i.description && (
                      <p className="text-[11px] text-muted-foreground">{i.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function Heading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
      <span style={{ color: "var(--brand)" }}>{icon}</span>
      {children}
    </div>
  );
}

function FormRow({ f }: { f: RefFormTemplate }) {
  const warn = f.common_errors?.[0];
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] text-foreground">{f.form_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {[
            f.form_type,
            f.field_count != null ? `${f.field_count} fields` : null,
            f.requires_notary ? "notarised" : f.requires_signature ? "signed" : null,
            f.page_count != null ? `${f.page_count} pp` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {warn && <p className="text-[11px] text-amber-700">Watch: {warn}</p>}
      </div>
      {f.form_url && (
        <a
          href={f.form_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px]"
          style={{ color: "var(--brand)" }}
        >
          Blank ↗
        </a>
      )}
    </div>
  );
}
