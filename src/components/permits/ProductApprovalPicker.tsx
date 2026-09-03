import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Sparkles, Plus, X, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { approvalLabel, approvalPdfUrl, type ProductApproval } from "@/lib/permits/db";
import {
  searchApprovals,
  suggestApprovalsForJob,
  attachApproval,
  attachMany,
  detachApproval,
  approvalStatus,
  roleLabel,
  PRODUCT_ROLES,
  type ProductRole,
  type ApprovalSuggestion,
} from "@/lib/permits/products";

/**
 * Choosing the product approvals that go in the packet.
 *
 * Two ways in, because the job usually already knows the answer: suggestions
 * read from the materials on the order form, and a search across the approval
 * library for everything the order form did not cover.
 *
 * Nothing is attached without the user saying so. An approval that does not
 * match what actually goes on the roof is a rejected permit at best and a
 * warranty problem later, so this suggests and the user confirms.
 */
export function ProductApprovalPicker({
  permitId,
  jobId,
  hvhz,
  attached,
  onChanged,
}: {
  permitId: string | null;
  jobId: string;
  /** True inside the High Velocity Hurricane Zone, where a Miami-Dade NOA is required. */
  hvhz: boolean;
  attached: (ProductApproval & { role: string })[];
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductApproval[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<ApprovalSuggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [role, setRole] = useState<ProductRole>("roof_covering");

  const attachedIds = useMemo(() => new Set(attached.map((a) => a.id)), [attached]);

  // Debounced, because the library is 2,561 rows and the user is typing.
  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchApprovals({ q, hvhzOnly: hvhz, limit: 25 });
        if (!cancelled) setResults(rows);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not search the approval library.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, hvhz]);

  const loadSuggestions = async () => {
    setBusy("suggest");
    try {
      const s = await suggestApprovalsForJob(jobId, { hvhzOnly: hvhz });
      setSuggestions(s);
      if (!s.length) {
        toast.info("Nothing on the order form matched the approval library — search for the products instead.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the order form.");
    } finally {
      setBusy(null);
    }
  };

  const add = async (a: ProductApproval, r: ProductRole) => {
    if (!permitId) return;
    setBusy(a.id);
    try {
      await attachApproval(permitId, a.id, r, attached.length);
      onChanged();
      toast.success(`${a.manufacturer ?? "Product"} added to the packet`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not attach that approval.");
    } finally {
      setBusy(null);
    }
  };

  const addAll = async () => {
    if (!permitId || !suggestions?.length) return;
    setBusy("all");
    try {
      const picks = suggestions
        .filter((s) => !attachedIds.has(s.approval.id))
        .map((s) => ({ approvalId: s.approval.id, role: s.role }));
      const n = await attachMany(permitId, picks);
      onChanged();
      toast.success(`${n} approval${n === 1 ? "" : "s"} added to the packet`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!permitId) return;
    setBusy(id);
    try {
      await detachApproval(permitId, id);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that approval.");
    } finally {
      setBusy(null);
    }
  };

  const chip = (a: Pick<ProductApproval, "expiration_date">) => {
    const s = approvalStatus(a);
    const tone =
      s.state === "expired" ? "var(--danger, #b91c1c)"
      : s.state === "expiring" ? "var(--warning, #b45309)"
      : "var(--muted-foreground)";
    return <span className="shrink-0 text-[10.5px]" style={{ color: tone }}>{s.text}</span>;
  };

  if (!permitId) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Pick the jurisdiction first — approvals attach to the permit record.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* what is already on the packet */}
      {attached.length > 0 ? (
        <ul className="space-y-1.5">
          {attached.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <div className="truncate text-[12px] text-foreground">{approvalLabel(p)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] text-muted-foreground">{roleLabel(p.role)}</span>
                  {chip(p)}
                  {approvalPdfUrl(p) && (
                    <a href={approvalPdfUrl(p)!} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3 w-3" /> approval
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => void remove(p.id)} disabled={busy === p.id}
                      title="Remove from the packet"
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50">
                {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          Nothing attached yet. {hvhz
            ? "This jurisdiction is inside the High Velocity Hurricane Zone, so the counter wants a Miami-Dade NOA for every product."
            : "Outside the HVHZ a Florida Product Approval number is usually enough."}
        </p>
      )}

      {/* suggestions from the order form */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => void loadSuggestions()} disabled={busy === "suggest"}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}>
          {busy === "suggest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Suggest from the order form
        </button>
        {!!suggestions?.length && (
          <button onClick={() => void addAll()} disabled={busy === "all"}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--brand)" }}>
            {busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add all {suggestions.filter((s) => !attachedIds.has(s.approval.id)).length}
          </button>
        )}
      </div>

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <li className="px-1 text-[10.5px] text-muted-foreground">
            Matched by product name against the approval library — check each one before it goes in the packet.
          </li>
          {suggestions.map((s) => (
            <li key={s.approval.id} className="flex items-start justify-between gap-3 px-1 py-1">
              <div className="min-w-0">
                <div className="truncate text-[12px] text-foreground">{approvalLabel(s.approval)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span>from “{s.material}”</span>
                  <span>· {roleLabel(s.role)}</span>
                  {s.confidence < 0.6 && (
                    <span className="inline-flex items-center gap-1" style={{ color: "var(--warning, #b45309)" }}>
                      <AlertTriangle className="h-3 w-3" /> loose match
                    </span>
                  )}
                  {chip(s.approval)}
                </div>
              </div>
              {attachedIds.has(s.approval.id) ? (
                <span className="shrink-0 text-[10.5px] text-muted-foreground">on the packet</span>
              ) : (
                <button onClick={() => void add(s.approval, s.role)} disabled={busy === s.approval.id}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50">
                  {busy === s.approval.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* free search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={hvhz ? "Search HVHZ-approved products…" : "Search the approval library…"}
            className="w-full rounded-lg border bg-transparent py-1.5 pl-8 pr-2 text-[12px] text-foreground outline-none"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as ProductRole)}
                title="What this product is on the roof"
                className="rounded-lg border bg-transparent px-2 py-1.5 text-[12px] text-foreground"
                style={{ borderColor: "var(--border)" }}>
          {PRODUCT_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
        </select>
      </div>

      {searching && <p className="text-[11px] text-muted-foreground">Searching…</p>}
      {!searching && !!q.trim() && !results.length && (
        <p className="text-[11px] text-muted-foreground">
          Nothing matched{hvhz ? " among HVHZ-approved products" : ""}. Try the manufacturer name or the NOA number.
        </p>
      )}
      {results.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
          {results.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-1 py-1">
              <div className="min-w-0">
                <div className="truncate text-[12px] text-foreground">{approvalLabel(a)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                  {a.product_category && <span>{a.product_category}</span>}
                  {a.hvhz_approved && <span>· HVHZ</span>}
                  {chip(a)}
                </div>
              </div>
              {attachedIds.has(a.id) ? (
                <span className="shrink-0 text-[10.5px] text-muted-foreground">added</span>
              ) : (
                <button onClick={() => void add(a, role)} disabled={busy === a.id}
                        title={`Add as ${roleLabel(role)}`}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50">
                  {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
