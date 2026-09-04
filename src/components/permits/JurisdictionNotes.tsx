import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { departmentRules, type DepartmentRule } from "@/lib/permits/db";

/**
 * What this counter will hand the packet back for.
 *
 * None of this is on a form. It is what somebody found out by ringing the
 * building department, or by having a packet rejected once: Weston wants uplift
 * testing on every re-roof, Miramar wants an HOA affidavit even when the
 * property is not in an HOA, Pembroke Pines wants the contractor registered in
 * person, and Riviera Beach will not let a roofing licence install new straps
 * at all — that is a CGC, CBC or CRC and needs its own subpermit.
 *
 * A contractor who has worked one county for ten years knows their own. This is
 * for the other counties, which is the whole reason the packet feature exists.
 *
 * Ordered so the ones that change what you have to do come before the ones that
 * only change what to expect.
 */

const card = { borderColor: "var(--border)", background: "var(--bg-card)" };

export function JurisdictionNotes({
  county,
  city,
}: {
  county: string | null | undefined;
  city: string | null | undefined;
}) {
  const [rules, setRules] = useState<DepartmentRule[] | null>(null);

  useEffect(() => {
    let live = true;
    if (!county) {
      setRules([]);
      return;
    }
    (async () => {
      try {
        /* County-wide rules apply everywhere in the county; a city's own rules
           apply on top. Asking for both in one round trip and filtering here is
           cheaper than two queries and keeps the ordering in one place. */
        const { data } = await departmentRules()
          .select(
            "id, county, city, rule_type, permit_types, rule_description, rule_action, document_required, priority",
          )
          .eq("county", county);
        if (!live) return;
        const all = (data ?? []).filter(
          (r) => !r.city || (city && r.city.toLowerCase() === city.toLowerCase()),
        );
        const applies = all.filter(
          (r) =>
            !r.permit_types?.length ||
            r.permit_types.some((t) => t === "roofing" || t === "all" || t === "*"),
        );
        setRules(dedupe(applies));
      } catch {
        /* Reference data that will not load should not take the tab down. */
        if (live) setRules([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [county, city]);

  if (!rules?.length) return null;

  return (
    <section className="rounded-xl border p-4" style={card}>
      <h3 className="mb-1 text-[13px] font-semibold text-foreground">
        What this counter is fussy about
      </h3>
      <p className="mb-3 text-[12px] text-muted-foreground">
        {[city, county].filter(Boolean).join(", ")} — things that are not on any form.
      </p>
      <ul className="space-y-2">
        {rules.map((r) => {
          const acts = r.rule_type !== "gotcha";
          return (
            <li key={r.id} className="flex items-start gap-2.5">
              {acts ? (
                <AlertTriangle
                  className="mt-[3px] h-3.5 w-3.5 shrink-0"
                  style={{ color: "#b45309" }}
                />
              ) : (
                <Info
                  className="mt-[3px] h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                />
              )}
              <div className="min-w-0">
                <p className="text-[12.5px] text-foreground">{r.rule_description}</p>
                {r.document_required && (
                  <p className="text-[11px] text-muted-foreground">Wants: {r.document_required}</p>
                )}
                {r.city && <p className="text-[11px] text-muted-foreground">{r.city} only</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The same rule often arrives twice — once from the county page and once from a
 * city's own, worded slightly differently. Compare on the words that carry
 * meaning so "Notice of Commencement must be recorded and posted on job site
 * before first inspection." and the same sentence with "the" in it collapse.
 */
function dedupe(rules: DepartmentRule[]): DepartmentRule[] {
  const seen = new Set<string>();
  const out: DepartmentRule[] = [];
  for (const r of [...rules].sort(
    (a, b) => b.priority - a.priority || (a.city ? -1 : 1) - (b.city ? -1 : 1),
  )) {
    const key = r.rule_description
      .toLowerCase()
      .replace(/\b(the|a|an|on|in|of|is|be|must|shall|will)\b/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  /* Things you have to do, then things to expect. */
  return out.sort(
    (a, b) =>
      Number(b.rule_type !== "gotcha") - Number(a.rule_type !== "gotcha") ||
      b.priority - a.priority,
  );
}
