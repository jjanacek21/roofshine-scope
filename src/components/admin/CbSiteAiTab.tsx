import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, Undo2, MessageSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cbSiteAiApply,
  cbSiteAiHistory,
  cbSiteAiPropose,
  cbSiteAiRevert,
  type CbSiteAiProposal,
} from "@/lib/cb-site-ai.functions";

const TABLE_LABEL: Record<string, string> = {
  cb_site_blocks: "Content block",
  cb_site_faq: "FAQ",
  cb_site_videos: "Video",
  cb_site_media: "Photo",
};

export function CbSiteAiTab() {
  const propose = useServerFn(cbSiteAiPropose);
  const apply = useServerFn(cbSiteAiApply);
  const revert = useServerFn(cbSiteAiRevert);
  const history = useServerFn(cbSiteAiHistory);
  const qc = useQueryClient();

  const [instruction, setInstruction] = useState("");
  const [sentInstruction, setSentInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<CbSiteAiProposal | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const edits = useQuery({
    queryKey: ["cb-site-edits"],
    queryFn: () => history({ data: undefined as never }),
  });

  async function send() {
    if (!instruction.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await propose({ data: { instruction: instruction.trim() } });
      setResult(res);
      setSentInstruction(instruction.trim());
      setPicked(Object.fromEntries(res.changes.map((_, i) => [i, true])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applySelected() {
    if (!result) return;
    const changes = result.changes.filter((_, i) => picked[i]);
    if (!changes.length) return;
    setApplying(true);
    try {
      const res = await apply({ data: { instruction: sentInstruction, changes } });
      if (res.errors.length) toast.error(res.errors.join(" · "));
      toast.success(`${res.applied} change${res.applied === 1 ? "" : "s"} applied.`);
      setResult(null);
      void qc.invalidateQueries({ queryKey: ["cb-site-edits"] });
      void qc.invalidateQueries({ queryKey: ["cb-site"] });
      void edits.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function doRevert(id: string) {
    try {
      await revert({ data: { id } });
      toast.success("Reverted.");
      void edits.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          Type a plain English change or a question. Only the marketing content tables can be
          touched — nothing is written until you press Apply selected.
        </p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          placeholder='e.g. "make the hero headline shorter and mention Florida"'
          className="w-full rounded-lg border border-border bg-background p-3 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button onClick={() => void send()} disabled={busy || !instruction.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
          {result ? (
            <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "Hide" : "Show"} model JSON
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      ) : null}

      {result?.answer ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="whitespace-pre-wrap">{result.answer}</span>
        </div>
      ) : null}

      {result?.questions?.length ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="mb-1 font-medium">Needs your answer before it can be written:</p>
          <ul className="list-disc pl-5">
            {result.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result?.dropped?.length ? (
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Blocked by the whitelist: {result.dropped.join("; ")}
        </div>
      ) : null}

      {showRaw && result ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-xs">
          {result.raw}
        </pre>
      ) : null}

      {result && result.changes.length > 0 ? (
        <div className="space-y-3">
          {result.changes.map((c, i) => (
            <label
              key={i}
              className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-4"
            >
              <input
                type="checkbox"
                checked={!!picked[i]}
                onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.checked }))}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{TABLE_LABEL[c.table] ?? c.table}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{c.label ?? c.path}</span>
                  {c.insert ? <Badge>new entry</Badge> : null}
                </div>
                {c.old ? (
                  <p className="text-sm text-muted-foreground line-through">{c.old}</p>
                ) : null}
                <p className="text-sm font-medium">{c.new}</p>
                {c.why ? <p className="mt-1 text-xs text-muted-foreground">{c.why}</p> : null}
              </div>
            </label>
          ))}
          <Button onClick={() => void applySelected()} disabled={applying}>
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply selected
          </Button>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Edit history</h3>
        {edits.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !edits.data?.length ? (
          <p className="text-sm text-muted-foreground">No AI edits yet.</p>
        ) : (
          <div className="space-y-2">
            {edits.data.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{TABLE_LABEL[e.table_name] ?? e.table_name}</Badge>
                    <span className="font-mono">
                      {e.row_key} · {e.path}
                    </span>
                    <span>{new Date(e.applied_at).toLocaleString()}</span>
                    {e.reverted_at ? <Badge variant="outline">reverted</Badge> : null}
                  </div>
                  {e.old_value ? (
                    <p className="text-muted-foreground line-through">{e.old_value}</p>
                  ) : null}
                  <p>{e.new_value}</p>
                </div>
                {!e.reverted_at ? (
                  <Button size="sm" variant="outline" onClick={() => void doRevert(e.id)}>
                    <Undo2 className="mr-1 h-3 w-3" />
                    Revert
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CbSiteAiTab;
