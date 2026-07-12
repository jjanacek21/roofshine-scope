import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listAssistantThreads,
  createAssistantThread,
  getAssistantThreadMessages,
  deleteAssistantThread,
} from "@/lib/assistant.functions";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { toast } from "sonner";
import {
  MessageSquare, Mic, MicOff, Send, Sparkles, X, Plus,
  Trash2, Loader2, ArrowUpRight, CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Part =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: any };

type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: Part[];
  created_at?: string;
};

type Thread = { id: string; title: string; updated_at: string; created_at: string };

export function AssistantPanel({ open, onClose, contextHint }: {
  open: boolean;
  onClose: () => void;
  contextHint: { path?: string | null; job_id?: string | null };
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showList, setShowList] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const threadsQ = useQuery({
    queryKey: ["assistant-threads"],
    queryFn: () => listAssistantThreads(),
    enabled: open,
  });

  const messagesQ = useQuery({
    queryKey: ["assistant-messages", activeThreadId],
    queryFn: () => getAssistantThreadMessages({ data: { thread_id: activeThreadId! } }),
    enabled: !!activeThreadId && open,
  });

  const messages = useMemo(() => (messagesQ.data ?? []) as StoredMessage[], [messagesQ.data]);

  // Auto-pick most recent thread, or create one when opened.
  useEffect(() => {
    if (!open) return;
    if (activeThreadId) return;
    const threads = threadsQ.data as Thread[] | undefined;
    if (!threads) return;
    if (threads.length > 0) {
      setActiveThreadId(threads[0].id);
    } else {
      createAssistantThread({ data: {} }).then((t) => {
        qc.invalidateQueries({ queryKey: ["assistant-threads"] });
        setActiveThreadId(t.id);
      }).catch(() => {});
    }
  }, [open, threadsQ.data, activeThreadId, qc]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, activeThreadId]);

  // Auto scroll on message change / while sending.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const sendMessage = async (text: string) => {
    const clean = text.trim();
    if (!clean || !activeThreadId || sending) return;
    setInput("");
    setSending(true);

    // Optimistic user bubble
    qc.setQueryData(["assistant-messages", activeThreadId], (prev: StoredMessage[] = []) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "user", parts: [{ type: "text", text: clean }] } as StoredMessage,
    ]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          thread_id: activeThreadId,
          user_message: clean,
          context: contextHint,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Error ${res.status}`);
      }
      const json = await res.json();
      // Handle any navigate tool result — take the first one.
      const parts = (json.message?.parts ?? []) as Part[];
      const nav = parts.find((p) => p.type === "tool_result" && p.name === "navigate") as any;
      if (nav?.result?.path) {
        try { navigate({ to: nav.result.path }); } catch { /* invalid route */ }
      }
      await qc.invalidateQueries({ queryKey: ["assistant-messages", activeThreadId] });
      await qc.invalidateQueries({ queryKey: ["assistant-threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant error");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const voice = useVoiceInput({
    autoSubmitSilenceMs: 1500,
    onFinal: (t) => {
      sendMessage(t);
    },
    onInterim: (t) => {
      setInput(t);
    },
  });

  const createNew = useMutation({
    mutationFn: () => createAssistantThread({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["assistant-threads"] });
      setActiveThreadId(t.id);
      setShowList(false);
    },
  });

  const removeThread = useMutation({
    mutationFn: (id: string) => deleteAssistantThread({ data: { thread_id: id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["assistant-threads"] });
      if (activeThreadId === id) setActiveThreadId(null);
    },
  });

  if (!open) return null;

  const panel = (
    <div
      className="fixed bottom-24 right-4 z-[90] flex h-[min(640px,calc(100vh-140px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">GCN Assistant</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {activeThreadId ? (threadsQ.data?.find((t) => t.id === activeThreadId)?.title ?? "Chat") : "Loading…"}
          </div>
        </div>
        <button onClick={() => setShowList((s) => !s)} title="Threads" className="rounded p-1.5 hover:bg-[var(--surface-hover)]">
          <MessageSquare className="h-4 w-4" />
        </button>
        <button onClick={() => createNew.mutate()} title="New chat" className="rounded p-1.5 hover:bg-[var(--surface-hover)]">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={onClose} title="Close" className="rounded p-1.5 hover:bg-[var(--surface-hover)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread list overlay */}
      {showList && (
        <div className="absolute inset-x-0 top-[57px] z-10 max-h-72 overflow-y-auto border-b" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          {(threadsQ.data ?? []).length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No previous chats.</div>
          )}
          {(threadsQ.data ?? []).map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2 border-b px-3 py-2 text-sm hover:bg-[var(--surface-hover)]",
                activeThreadId === t.id && "bg-[var(--surface-hover)]",
              )}
              style={{ borderColor: "var(--border)" }}
            >
              <button
                className="flex-1 min-w-0 text-left truncate"
                onClick={() => { setActiveThreadId(t.id); setShowList(false); }}
              >
                {t.title || "Untitled"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this chat?")) removeThread.mutate(t.id);
                }}
                className="rounded p-1 text-muted-foreground hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !messagesQ.isLoading && (
          <EmptyState onExample={(t) => setInput(t)} />
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} onNav={(p) => { try { navigate({ to: p }); } catch { /* noop */ } onClose(); }} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        {voice.transcript && voice.listening && !voiceMode && (
          <div className="mb-2 text-[11px] italic text-muted-foreground">🎙 {voice.transcript}</div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            rows={1}
            placeholder={voiceMode ? "Voice mode on — just talk" : "Ask or say what to do…"}
            className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1"
            style={{ borderColor: "var(--border)", maxHeight: 120 }}
          />
          {voice.supported && (
            <>
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                title={voice.listening ? "Stop mic" : "Push to talk"}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border",
                  voice.listening && "border-red-500 bg-red-500/10 text-red-500 animate-pulse",
                )}
                style={{ borderColor: voice.listening ? undefined : "var(--border)" }}
              >
                {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !voiceMode;
                  setVoiceMode(next);
                  if (next) voice.start(); else voice.stop();
                }}
                title="Voice mode: auto-send after silence"
                className={cn("h-9 rounded-lg border px-2 text-[11px] font-semibold", voiceMode && "border-blue-500 bg-blue-500/10 text-blue-500")}
                style={{ borderColor: voiceMode ? undefined : "var(--border)" }}
              >
                Auto
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-white disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {!voice.supported && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            Voice input needs Chrome or Edge (Safari desktop is not supported).
          </div>
        )}
      </div>
    </div>
  );

  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}

function MessageBubble({ msg, onNav }: { msg: StoredMessage; onNav: (path: string) => void }) {
  if (msg.role === "user") {
    const text = msg.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 px-3 py-2 text-sm text-white shadow-sm">
          {text}
        </div>
      </div>
    );
  }
  // assistant
  return (
    <div className="space-y-1.5">
      {msg.parts.map((p, i) => {
        if (p.type === "text") {
          return (
            <div key={i} className="max-w-[95%] whitespace-pre-wrap text-sm text-foreground">
              {p.text}
            </div>
          );
        }
        if (p.type === "tool_result") {
          return <ToolResultCard key={i} name={p.name} result={p.result} onNav={onNav} />;
        }
        return null;
      })}
    </div>
  );
}

function ToolResultCard({ name, result, onNav }: { name: string; result: any; onNav: (p: string) => void }) {
  const err = result?.error as string | undefined;
  if (err) {
    return (
      <div className="flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] text-red-500" style={{ borderColor: "var(--border)" }}>
        <AlertCircle className="mt-0.5 h-3.5 w-3.5" /> {err}
      </div>
    );
  }
  if (name === "navigate" && result?.path) {
    return (
      <button
        onClick={() => onNav(result.path)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-[var(--surface-hover)]"
        style={{ borderColor: "var(--border)" }}
      >
        <ArrowUpRight className="h-3.5 w-3.5" /> Go to {result.path}
      </button>
    );
  }
  if (result?.action === "created_lead") {
    return (
      <ActionCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label={`Lead created: ${result.address}`} href={`/leads/${result.lead_id}`} onNav={onNav} />
    );
  }
  if (result?.action === "created_job") {
    return (
      <ActionCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label={`Job created: ${result.name}`} href={`/jobs/${result.job_id}`} onNav={onNav} />
    );
  }
  if (result?.action === "populated_order_form") {
    const applied = result.applied?.length ?? 0;
    return (
      <ActionCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label={`Order form auto-filled (${applied} field${applied === 1 ? "" : "s"})`} href={`/jobs/${result.job_id}/order-form`} onNav={onNav} />
    );
  }
  if (name === "search_leads" && Array.isArray(result?.leads)) {
    return (
      <div className="space-y-1">
        {result.leads.length === 0 && <div className="text-[11px] text-muted-foreground">No matching leads.</div>}
        {result.leads.slice(0, 5).map((l: any) => (
          <ActionCard key={l.id} icon={<ArrowUpRight className="h-3.5 w-3.5" />} label={`${l.owner ?? "—"} · ${l.address}`} href={`/leads/${l.id}`} onNav={onNav} />
        ))}
      </div>
    );
  }
  if (name === "search_jobs" && Array.isArray(result?.jobs)) {
    return (
      <div className="space-y-1">
        {result.jobs.length === 0 && <div className="text-[11px] text-muted-foreground">No matching jobs.</div>}
        {result.jobs.slice(0, 5).map((j: any) => (
          <ActionCard key={j.id} icon={<ArrowUpRight className="h-3.5 w-3.5" />} label={`${j.name} · ${j.status}`} href={`/jobs/${j.id}`} onNav={onNav} />
        ))}
      </div>
    );
  }
  return null;
}

function ActionCard({ icon, label, href, onNav }: { icon: React.ReactNode; label: string; href: string; onNav: (p: string) => void }) {
  return (
    <button
      onClick={() => onNav(href)}
      className="flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-[var(--surface-hover)]"
      style={{ borderColor: "var(--border)" }}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
    </button>
  );
}

function EmptyState({ onExample }: { onExample: (t: string) => void }) {
  const examples = [
    "Add a new lead for Jason Smith at 2847 NE 2nd Ave, Boca Raton FL 33431",
    "What does the order form do?",
    "Open my jobs",
    "Auto-fill the order form from measurements for this job",
  ];
  return (
    <div className="pt-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold">Hi! I can help you use the app.</div>
      <div className="mt-1 text-xs text-muted-foreground">Speak or type — I can create leads and jobs, explain features, and navigate.</div>
      <div className="mt-4 space-y-1.5">
        {examples.map((e) => (
          <button
            key={e}
            onClick={() => onExample(e)}
            className="mx-auto block w-full max-w-[320px] rounded-lg border px-3 py-2 text-left text-[11px] text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
