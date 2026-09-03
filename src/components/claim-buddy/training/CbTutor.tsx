import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CbButton, CbCard } from "@/components/cb/primitives";
import { cbTrainingTutor } from "@/lib/cb-training.functions";
import { useTrainingScope } from "@/hooks/useCbTraining";

/** Floating course tutor. Answers only from the course material. */
export function CbTutor({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const { workspaceId } = useTrainingScope();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  async function ask() {
    const q = question.trim();
    if (!q || !workspaceId) return;
    setQuestion("");
    setHistory((h) => [...h, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await cbTrainingTutor({ data: { workspaceId, courseId, question: q, history } });
      if (res.ok) setHistory((h) => [...h, { role: "assistant", content: res.reply }]);
      else toast.error(res.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The tutor is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[60] inline-flex items-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-semibold"
        style={{ background: "var(--cb-accent)", color: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,.22)" }}
      >
        <Sparkles className="h-4 w-4" />
        Ask the tutor
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:right-4 sm:left-auto sm:w-[420px]">
      <CbCard elevation="floating" style={{ padding: 16 }}>
        <div className="flex items-center justify-between">
          <p className="cb-microlabel">Tutor · {courseTitle}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close tutor">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              Ask anything about this course — the tutor answers from the lessons only.
            </p>
          ) : null}
          {history.map((m, i) => (
            <div
              key={i}
              className="rounded-[12px] px-3 py-2 text-[13.5px]"
              style={{
                background: m.role === "user" ? "color-mix(in oklab, var(--cb-accent) 12%, transparent)" : "rgba(0,0,0,.04)",
              }}
            >
              {m.content}
            </div>
          ))}
          {busy ? (
            <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Thinking…
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
            placeholder="Ask a question…"
            className="flex-1 rounded-[12px] px-3 py-2 text-[14px]"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))", background: "transparent" }}
          />
          <CbButton size="md" loading={busy} onClick={ask}>
            Ask
          </CbButton>
        </div>
      </CbCard>
    </div>
  );
}
