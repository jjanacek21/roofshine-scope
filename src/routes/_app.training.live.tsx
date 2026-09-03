import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Video, Plus, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { awardPoints, logEvent, useLiveSessions, useTrainingScope } from "@/hooks/useCbTraining";

export const Route = createFileRoute("/_app/training/live")({
  head: () => ({
    meta: [
      { title: "Live coaching — Company Training" },
      { name: "description", content: "Join your company's live coaching calls and get credit for attending." },
      { property: "og:title", content: "Live coaching — Company Training" },
      { property: "og:description", content: "Scheduled live coaching sessions for your crew." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

const inputStyle = {
  border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
  background: "transparent",
} as const;

function LivePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaceId, isAdmin } = useTrainingScope();
  const sessions = useLiveSessions();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", startsAt: "", minutes: 45, meetUrl: "", description: "" });
  const [saving, setSaving] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const all = sessions.data ?? [];
    return {
      upcoming: all.filter((s) => new Date(s.starts_at).getTime() >= now - 60 * 60000),
      past: all.filter((s) => new Date(s.starts_at).getTime() < now - 60 * 60000).reverse(),
    };
  }, [sessions.data]);

  async function create() {
    if (!workspaceId || !user?.id) return;
    if (!form.title.trim() || !form.startsAt) {
      toast.error("Give the session a title and a start time.");
      return;
    }
    setSaving(true);
    const starts = new Date(form.startsAt);
    const { error } = await supabase.from("cb_live_sessions").insert({
      workspace_id: workspaceId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + form.minutes * 60000).toISOString(),
      meet_url: form.meetUrl.trim() || null,
      counts_toward_hours: true,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Session scheduled");
    setCreating(false);
    setForm({ title: "", startsAt: "", minutes: 45, meetUrl: "", description: "" });
    void sessions.refetch();
  }

  async function join(sessionId: string, url: string | null, minutes: number) {
    if (!workspaceId || !user?.id) return;
    await supabase.from("cb_live_attendance").upsert(
      {
        session_id: sessionId,
        workspace_id: workspaceId,
        user_id: user.id,
        status: "attended",
        minutes,
      },
      { onConflict: "session_id,user_id" },
    );
    await awardPoints(workspaceId, user.id, "live_attend", sessionId);
    await logEvent({
      workspaceId,
      userId: user.id,
      kind: "live_attend",
      seconds: minutes * 60,
      meta: { session_id: sessionId },
    });
    if (url) window.open(url, "_blank", "noopener");
    else toast.info("No meeting link on this session yet.");
  }

  /** Opens Google Calendar pre-filled so the organiser can add a Meet link. */
  function googleCalendarLink() {
    const start = form.startsAt ? new Date(form.startsAt) : new Date();
    const end = new Date(start.getTime() + form.minutes * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: form.title || "Team training",
      details: form.description || "Company training session",
      dates: `${fmt(start)}/${fmt(end)}`,
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener");
  }

  return (
    <CbSurface>
      <div>
        <div className="mx-auto w-full max-w-[840px]">
          <CbReveal>
            <button
              type="button"
              onClick={() => navigate({ to: "/training" })}
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Training
            </button>
            <h1 className="cb-display" style={{ fontSize: 26 }}>
              Live coaching
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Scheduled calls count toward each rep's required training time.
            </p>
          </CbReveal>

          {isAdmin ? (
            <div className="mt-4">
              {creating ? (
                <CbCard elevation="raised" style={{ padding: 18 }}>
                  <p className="cb-microlabel">New session</p>
                  <div className="mt-3 space-y-3">
                    <input
                      className="w-full rounded-[12px] px-3 py-2 text-[14px]"
                      style={inputStyle}
                      placeholder="Title — e.g. Monday morning role play"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                    <textarea
                      className="w-full rounded-[12px] px-3 py-2 text-[14px]"
                      style={inputStyle}
                      rows={2}
                      placeholder="What are you covering?"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-3">
                      <input
                        type="datetime-local"
                        className="rounded-[12px] px-3 py-2 text-[14px]"
                        style={inputStyle}
                        value={form.startsAt}
                        onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      />
                      <input
                        type="number"
                        min={15}
                        step={15}
                        className="w-24 rounded-[12px] px-3 py-2 text-[14px]"
                        style={inputStyle}
                        value={form.minutes}
                        onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                      />
                    </div>
                    <input
                      className="w-full rounded-[12px] px-3 py-2 text-[14px]"
                      style={inputStyle}
                      placeholder="Google Meet link (https://meet.google.com/…)"
                      value={form.meetUrl}
                      onChange={(e) => setForm({ ...form, meetUrl: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <CbButton size="md" loading={saving} onClick={create}>
                        Schedule
                      </CbButton>
                      <CbButton size="md" variant="secondary" onClick={googleCalendarLink}>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarPlus className="h-4 w-4" /> Create in Google Calendar
                        </span>
                      </CbButton>
                      <CbButton size="md" variant="ghost" onClick={() => setCreating(false)}>
                        Cancel
                      </CbButton>
                    </div>
                    <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      Google Calendar opens with the details filled in — add the Meet link there, then paste it back
                      here so the crew can join in one tap.
                    </p>
                  </div>
                </CbCard>
              ) : (
                <CbButton size="md" onClick={() => setCreating(true)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Plus className="h-4 w-4" /> Schedule a session
                  </span>
                </CbButton>
              )}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {sessions.isLoading ? (
              <CbLoading label="Loading sessions…" />
            ) : upcoming.length === 0 ? (
              <CbEmptyState headline="Nothing scheduled" body="Live coaching calls will show up here." />
            ) : (
              upcoming.map((s) => (
                <CbCard key={s.id} elevation="card" style={{ padding: 16 }}>
                  <div className="flex items-start gap-3">
                    <Video className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{s.title}</p>
                      <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                        {new Date(s.starts_at).toLocaleString()}
                      </p>
                      {s.description ? (
                        <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                          {s.description}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <CbButton
                          size="md"
                          onClick={() =>
                            join(
                              s.id,
                              s.meet_url,
                              s.ends_at
                                ? Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000)
                                : 45,
                            )
                          }
                        >
                          Join
                        </CbButton>
                      </div>
                    </div>
                  </div>
                </CbCard>
              ))
            )}
          </div>

          {past.length ? (
            <div className="mt-8">
              <p className="cb-microlabel">Past sessions</p>
              <div className="mt-2 space-y-2">
                {past.slice(0, 10).map((s) => (
                  <CbCard key={s.id} elevation="flat" style={{ padding: 14 }}>
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[14px]">{s.title}</span>
                      <CbBadge tone="neutral">{new Date(s.starts_at).toLocaleDateString()}</CbBadge>
                    </div>
                  </CbCard>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </CbSurface>
  );
}
