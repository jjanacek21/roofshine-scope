import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX, BookOpen, Swords, RotateCcw, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadGuide, contextFor, objectionBuckets, type Guide, type GuideLesson } from "@/lib/training/guide";

/**
 * Talking to the playbook.
 *
 * Two modes, because a rep needs two different things. "Ask" answers questions
 * out of the Survival Guide and says which lesson each answer came from, so a
 * rep can go and read it. "Practice" stops answering and starts playing the
 * homeowner, so the rep can run a door without spending a real one — then
 * scores the attempt against the guide when they are done.
 *
 * Speech is the browser's own: the Web Speech API for listening, speech
 * synthesis for talking back. No vendor, no per-minute cost, and it works on
 * the phone a rep already has in the truck. Where the browser has neither, the
 * mic simply does not appear and typing still works.
 */

type Turn = { role: "user" | "assistant"; content: string; cited?: { module: string; lesson: string }[] };
type Mode = "coach" | "roleplay";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SR: any =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    : null;

export function TrainerChat() {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [mode, setMode] = useState<Mode>("coach");
  const [scenario, setScenario] = useState<GuideLesson | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rec = useRef<any>(null);

  useEffect(() => {
    loadGuide()
      .then(setGuide)
      .catch((e) => toast.error(e instanceof Error ? e.message : "The guide would not load."));
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  // Stop the browser talking when this unmounts, or it keeps going on the next page.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const buckets = guide ? objectionBuckets(guide).slice(0, 12) : [];

  const say = (text: string) => {
    if (!speak || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ""));
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };

  const listen = () => {
    if (!SR) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    let said = "";
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      said = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((x) => x[0].transcript)
        .join("");
      setInput(said);
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      if (said.trim()) void send(said.trim());
    };
    rec.current = r;
    setListening(true);
    r.start();
  };

  const post = async (payload: Record<string, unknown>) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Sign in again to use the trainer.");
    const r = await fetch("/api/training-chat", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const j = (await r.json()) as { reply?: string; cited?: { module: string; lesson: string }[]; error?: string };
    if (!r.ok) throw new Error(j.error ?? "The trainer could not answer.");
    return j;
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy || !guide) return;
    setInput("");
    const next: Turn[] = [...turns, { role: "user", content: msg }];
    setTurns(next);
    setBusy(true);
    try {
      // Retrieval happens here — the guide is a build asset on this side.
      const { text: ctx, cited } = contextFor(guide, mode === "roleplay" ? scenario?.title ?? msg : msg);
      const j = await post({
        mode,
        message: msg,
        context: ctx,
        cited: cited.map((h) => ({ module: h.moduleTitle, lesson: h.lesson.title })),
        history: next.slice(0, -1).map((t) => ({ role: t.role, content: t.content })),
        scenario: scenario?.title,
        difficulty: "normal",
      });
      const reply = j.reply ?? "";
      setTurns((t) => [...t, { role: "assistant", content: reply, cited: mode === "coach" ? j.cited : undefined }]);
      say(reply);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The trainer could not answer.");
      setTurns((t) => t.slice(0, -1));
      setInput(msg);
    } finally {
      setBusy(false);
    }
  };

  const scoreMe = async () => {
    if (!guide || busy || turns.length < 2) return;
    setBusy(true);
    try {
      const { text: ctx } = contextFor(guide, scenario?.title ?? "objection handling close tonality");
      const j = await post({
        mode: "score",
        message: "",
        context: ctx,
        history: turns.map((t) => ({ role: t.role, content: t.content })),
        scenario: scenario?.title,
      });
      setTurns((t) => [...t, { role: "assistant", content: j.reply ?? "" }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not score that run.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    window.speechSynthesis?.cancel();
    setTurns([]);
    setInput("");
  };

  const card = { borderColor: "var(--border)", background: "var(--bg-card)" };
  const startRoleplay = (l: GuideLesson) => {
    setScenario(l);
    setMode("roleplay");
    setTurns([]);
    const opener = l.scripts[0]?.split("\n")[0] ?? "Yeah? Can I help you?";
    setTurns([{ role: "assistant", content: opener }]);
    say(opener);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* mode */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border p-1" style={card}>
          <button
            onClick={() => { setMode("coach"); setScenario(null); reset(); }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold"
            style={mode === "coach" ? { background: "var(--brand)", color: "#fff" } : { color: "var(--muted-foreground)" }}
          >
            <BookOpen className="h-3.5 w-3.5" /> Ask the playbook
          </button>
          <button
            onClick={() => { setMode("roleplay"); reset(); }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold"
            style={mode === "roleplay" ? { background: "var(--brand)", color: "#fff" } : { color: "var(--muted-foreground)" }}
          >
            <Swords className="h-3.5 w-3.5" /> Practice a door
          </button>
        </div>

        <button
          onClick={() => { setSpeak((s) => !s); window.speechSynthesis?.cancel(); }}
          title={speak ? "Stop reading answers out loud" : "Read answers out loud"}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] font-medium"
          style={card}
        >
          {speak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {speak ? "Speaking" : "Silent"}
        </button>

        {turns.length > 0 && (
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px]" style={card}>
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        )}
        {mode === "roleplay" && turns.length >= 3 && (
          <button
            onClick={() => void scoreMe()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--brand)" }}
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Score that run
          </button>
        )}
      </div>

      {/* pick an objection */}
      {mode === "roleplay" && !scenario && (
        <div className="rounded-xl border p-4" style={card}>
          <h3 className="text-[13px] font-semibold text-foreground">Which door are you knocking?</h3>
          <p className="mb-3 mt-1 text-[12.5px] text-muted-foreground">
            Straight out of the Rebuttal Arsenal. The homeowner runs that objection and will not make it easy.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {buckets.map((l) => (
              <button
                key={l.id}
                onClick={() => startRoleplay(l)}
                className="rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)" }}
              >
                {l.title}
              </button>
            ))}
            {!buckets.length && <span className="text-[12.5px] text-muted-foreground">Loading the guide…</span>}
          </div>
        </div>
      )}

      {/* transcript */}
      <div ref={scroller} className="min-h-[280px] flex-1 space-y-3 overflow-y-auto rounded-xl border p-4" style={card}>
        {!turns.length && (
          <div className="text-[13px] text-muted-foreground">
            {mode === "coach" ? (
              <>
                <p className="mb-2">Ask it anything from the playbook — 15 sections, 125 lessons, 118 scripts.</p>
                <ul className="space-y-1">
                  {["What do I say when they tell me they got denied?",
                    "How do I open a door in an over-knocked neighbourhood?",
                    "Explain the premium-to-payment math to me",
                    "What is the three-path close?"].map((q) => (
                    <li key={q}>
                      <button onClick={() => void send(q)} className="underline underline-offset-2" style={{ color: "var(--brand)" }}>
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Pick an objection above and the homeowner opens the door.</p>
            )}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div
              className="max-w-[86%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13.5px] leading-relaxed"
              style={
                t.role === "user"
                  ? { background: "var(--brand)", color: "#fff" }
                  : { background: "var(--surface-hover, rgba(127,127,127,.08))", color: "var(--foreground)" }
              }
            >
              {t.role === "assistant" && mode === "roleplay" && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest opacity-60">Homeowner</div>
              )}
              {t.content}
              {!!t.cited?.length && (
                <div className="mt-2 border-t pt-1.5 text-[11px] opacity-70" style={{ borderColor: "var(--border)" }}>
                  From: {t.cited.slice(0, 3).map((c) => c.lesson).join(" · ")}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
          </div>
        )}
      </div>

      {/* input */}
      <div className="flex items-end gap-2">
        {SR && (
          <button
            onClick={listen}
            title={listening ? "Stop" : "Hold a conversation out loud"}
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border"
            style={listening ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : card}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={
            mode === "roleplay"
              ? scenario ? "What do you say?" : "Pick an objection first"
              : "Ask the playbook…"
          }
          disabled={mode === "roleplay" && !scenario}
          className="min-h-[42px] flex-1 resize-none rounded-lg border bg-transparent px-3 py-2.5 text-[13.5px] text-foreground outline-none disabled:opacity-50"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
          style={{ background: "var(--brand)" }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Answers come from your Survival Guide and name the lesson they came from. It will tell you when something is not in the playbook.
      </p>
    </div>
  );
}
