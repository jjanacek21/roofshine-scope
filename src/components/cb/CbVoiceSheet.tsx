import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CbButton, CbLoading } from "@/components/cb/primitives";
import { cbHaptic } from "@/components/cb/motion";
import { cbParseVoiceTakeoff, type CbVoiceFinding } from "@/lib/cb-voice.functions";

/**
 * Voice takeoff.
 *
 * A different way to fill the SAME takeoff sheet — not a different takeoff. It
 * lives inside the takeoff screen rather than beside Roof / Exterior / Interior
 * on the picker, so a rep cannot reach it without having come through the
 * measurement first, and so one implementation serves all three sheets.
 *
 * Recognition is the browser's own (SpeechRecognition), which is why the
 * transcript appears as the rep speaks and why nothing is uploaded until they
 * stop. Claude turns the finished transcript into fields; see
 * cb-voice.functions.ts for the gates on the way back.
 */

type Phase = "idle" | "listening" | "thinking" | "review";

/* The vendor-prefixed constructor iOS still ships. */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function makeRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-US";
  r.continuous = true;
  r.interimResults = true;
  return r;
}

export function CbVoiceSheet({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** Called with only the findings the rep kept, plus the report notes. */
  onApply: (findings: CbVoiceFinding[], notes: string[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [findings, setFindings] = useState<CbVoiceFinding[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const textRef = useRef("");

  const stopRecognition = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
  }, []);

  /* Never leave the microphone on because a route changed. */
  useEffect(() => {
    if (!open) {
      stopRecognition();
      setPhase("idle");
      setFinalText("");
      setInterim("");
      setFindings([]);
      setNotes([]);
      setErr(null);
      textRef.current = "";
    }
    return stopRecognition;
  }, [open, stopRecognition]);

  function start() {
    const rec = makeRecognition();
    if (!rec) {
      setErr("This browser can't do voice. Chrome on Android and Safari on iOS both can.");
      return;
    }
    setErr(null);
    setFinalText("");
    setInterim("");
    textRef.current = "";
    cbHaptic();

    rec.onresult = (e) => {
      let add = "";
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) add += t;
        else live += t;
      }
      if (add) {
        textRef.current += add;
        setFinalText(textRef.current);
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      /* "no-speech" fires constantly on a windy roof and means nothing. */
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        setErr(
          e.error === "not-allowed"
            ? "Microphone access was blocked."
            : `Voice stopped: ${e.error}`,
        );
      }
    };
    rec.onend = () => {
      /* Some browsers cut the stream at every pause. Keep going. */
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* the user stopped it */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setPhase("listening");
    } catch {
      setErr("Couldn't start the microphone.");
    }
  }

  async function finish() {
    stopRecognition();
    const transcript = (textRef.current + " " + interim).trim();
    setInterim("");
    if (transcript.length < 4) {
      setPhase("idle");
      toast.message("Didn't catch anything — try again");
      return;
    }
    setPhase("thinking");
    try {
      const res = await cbParseVoiceTakeoff({ data: { transcript } });
      if (!res.ok) throw new Error(res.reason);
      setFindings(res.result.findings);
      setNotes(res.result.notes);
      /* Anything the model was unsure of starts OFF. The rep opts in. */
      setKeep(
        new Set(
          res.result.findings
            .map((f, i) => (f.confidence === "high" ? i : -1))
            .filter((i) => i >= 0),
        ),
      );
      setPhase("review");
      if (res.result.findings.length === 0) toast.message("Nothing matched a takeoff field");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      setErr(
        reason === "claude_not_configured"
          ? "Voice takeoff isn't switched on for this workspace yet."
          : reason.includes("timed_out") || reason.includes("unreachable")
            ? "Couldn't reach the writer — your words are still here, try again."
            : "Couldn't read that back. Your words are still here.",
      );
      setPhase("review");
    }
  }

  if (!open) return null;

  const kept = findings.filter((_, i) => keep.has(i));

  return (
    <div
      className="fixed inset-0 flex items-end"
      style={{ background: "rgba(0,0,0,.45)", zIndex: 70 }}
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{
          background: "var(--cb-surface, #fff)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--cb-hairline, rgba(0,0,0,.1))" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold tracking-[-.2px]">Voice takeoff</p>
            <p className="truncate text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
              {phase === "listening"
                ? "Listening — keep talking"
                : phase === "thinking"
                  ? "Reading it back…"
                  : phase === "review"
                    ? "Check this before it goes on the sheet"
                    : "Say what you see. Nothing saves until you approve it."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close voice takeoff"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-[11px]"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {err ? (
            <div
              className="mb-3 flex gap-2 rounded-[12px] px-3 py-2.5 text-[12.5px]"
              style={{ background: "rgba(180,83,9,.1)", color: "#b45309" }}
            >
              <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
              <span>{err}</span>
            </div>
          ) : null}

          {phase === "idle" ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--cb-text-muted)" }}>
              Walk the roof and talk normally — “ridge vent is bent, about forty feet, four pipe
              jacks all cracked, no drip edge on the north eave.” It fills the sheet you are already
              on.
            </p>
          ) : null}

          {(phase === "listening" || phase === "thinking") && (finalText || interim) ? (
            <p className="text-[14.5px] leading-[1.6]">
              <span>{finalText}</span>
              <span style={{ color: "var(--cb-text-muted)" }}>{interim}</span>
            </p>
          ) : null}

          {phase === "thinking" ? (
            <div className="mt-4">
              <CbLoading label="Matching what you said to takeoff fields…" />
            </div>
          ) : null}

          {phase === "review" ? (
            <div className="space-y-2">
              {findings.map((f, i) => {
                const on = keep.has(i);
                return (
                  <button
                    key={`${f.group}.${f.field}.${i}`}
                    type="button"
                    onClick={() =>
                      setKeep((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="flex w-full gap-3 rounded-[13px] px-3 py-2.5 text-left"
                    style={{
                      border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))",
                      opacity: on ? 1 : 0.5,
                    }}
                  >
                    <span
                      className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
                      style={{
                        background: on ? "var(--cb-accent, #15803d)" : "transparent",
                        border: on ? "none" : "1.5px solid var(--cb-hairline, rgba(0,0,0,.2))",
                      }}
                    >
                      {on ? <Check className="h-3 w-3" style={{ color: "#fff" }} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[13.5px] font-semibold">{f.label}</span>
                        <span className="cb-num text-[13px] font-bold">
                          {typeof f.value === "boolean"
                            ? f.value
                              ? "Yes"
                              : "No"
                            : String(f.value)}
                          {f.unit ? ` ${f.unit}` : ""}
                        </span>
                      </span>
                      <span
                        className="mt-1 block text-[12px] italic leading-snug"
                        style={{ color: "var(--cb-text-muted)" }}
                      >
                        “{f.heard}”
                      </span>
                      {f.needs ? (
                        <span
                          className="mt-1.5 block rounded-[8px] px-2 py-1 text-[11.5px] font-semibold"
                          style={{ background: "rgba(180,83,9,.1)", color: "#b45309" }}
                        >
                          {f.needs}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}

              {notes.length ? (
                <div
                  className="rounded-[13px] px-3 py-2.5"
                  style={{ background: "var(--cb-surface-sunken, rgba(0,0,0,.04))" }}
                >
                  <p className="cb-microlabel">Damage notes for the report</p>
                  <ul className="mt-1.5 space-y-1">
                    {notes.map((n) => (
                      <li
                        key={n}
                        className="text-[12.5px] leading-snug"
                        style={{ color: "var(--cb-text-muted)" }}
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div
          className="space-y-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
          style={{ borderTop: "1px solid var(--cb-hairline, rgba(0,0,0,.1))" }}
        >
          {phase === "idle" ? (
            <CbButton block onClick={start}>
              <span className="inline-flex items-center gap-2">
                <Mic className="h-4 w-4" /> Start talking
              </span>
            </CbButton>
          ) : null}

          {phase === "listening" ? (
            <CbButton block onClick={() => void finish()}>
              Done — read it back
            </CbButton>
          ) : null}

          {phase === "review" ? (
            <>
              <CbButton
                block
                disabled={kept.length === 0 && notes.length === 0}
                onClick={() => {
                  onApply(kept, notes);
                  cbHaptic();
                  toast.success(
                    kept.length
                      ? `${kept.length} field${kept.length === 1 ? "" : "s"} added`
                      : "Notes added",
                  );
                  onClose();
                }}
              >
                {kept.length ? `Add ${kept.length} to the takeoff` : "Add notes only"}
              </CbButton>
              <CbButton block variant="secondary" onClick={start}>
                Record more
              </CbButton>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
