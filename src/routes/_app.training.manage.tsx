import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Sparkles, Pencil, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbCourseBuilder } from "@/components/claim-buddy/training/CbCourseBuilder";
import {
  useAssignments,
  useCbCourses,
  useInvalidateTraining,
  useTrainingRules,
  useTrainingScope,
  useTrainingTeam,
  useScoreboard,
} from "@/hooks/useCbTraining";
import { cbGenerateCourseOutline, cbSaveGeneratedCourse } from "@/lib/cb-training.functions";
import { cbTable, formatMinutes, startOfMonth } from "@/lib/cbTraining";

export const Route = createFileRoute("/_app/training/manage")({
  head: () => ({
    meta: [
      { title: "Training — Global Contractor" },
      {
        name: "description",
        content:
          "Build courses, set required training hours, assign them to roles and track who is actually training.",
      },
      { property: "og:title", content: "Training — Global Contractor" },
      {
        property: "og:description",
        content: "Company training courses, requirements and accountability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminTraining,
});

const TABS = ["Courses", "Requirements", "Accountability"] as const;
type Tab = (typeof TABS)[number];

const input = {
  border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
  background: "transparent",
} as const;

function AdminTraining() {
  const [tab, setTab] = useState<Tab>("Courses");
  const { isAdmin } = useTrainingScope();

  return (
    <CbSurface skin="app">
      <div className="mx-auto w-full max-w-[840px]">
        <Link
          to="/training"
          className="mb-3 inline-flex items-center gap-1 text-[13px]"
          style={{ color: "var(--cb-text-muted)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Training
        </Link>
        <h1 className="cb-display" style={{ fontSize: 26, lineHeight: 1.15 }}>
          Company Training
        </h1>
        <p className="mb-5 mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Your own classroom — courses, requirements and a scoreboard for your crew.
        </p>
        {!isAdmin ? (
          <CbEmptyState
            headline="Owners and admins only"
            body="Ask your company owner for access."
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="cb-chip"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  style={
                    tab === t
                      ? {
                          background: "var(--cb-accent)",
                          color: "#fff",
                          borderColor: "transparent",
                        }
                      : undefined
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "Courses" ? <CoursesTab /> : null}
            {tab === "Requirements" ? <RequirementsTab /> : null}
            {tab === "Accountability" ? <AccountabilityTab /> : null}
          </>
        )}
      </div>
    </CbSurface>
  );
}

/* ---------------------------------------------------------------- */

function CoursesTab() {
  const { workspaceId } = useTrainingScope();
  const { user } = useAuth();
  const courses = useCbCourses(true);
  const invalidate = useInvalidateTraining();
  const [editing, setEditing] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [generating, setGenerating] = useState(false);

  async function createBlank() {
    if (!workspaceId || !user?.id) return;
    const { data, error } = await cbTable<{ id: string }>("cb_courses")
      .insert({
        company_id: workspaceId,
        title: "New course",
        status: "draft",
        created_by: user.id,
        sort_order: courses.data?.length ?? 0,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create the course");
      return;
    }
    invalidate();
    setEditing(data.id);
  }

  async function generate() {
    if (!workspaceId || !topic.trim()) {
      toast.error("Give the AI a topic to build from.");
      return;
    }
    setGenerating(true);
    try {
      const res = await cbGenerateCourseOutline({
        data: { workspaceId, topic: topic.trim(), source: source.trim() || undefined },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const saved = await cbSaveGeneratedCourse({ data: { workspaceId, outline: res.outline } });
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success("Course drafted — review it before publishing.");
      invalidate();
      void courses.refetch();
      setAiOpen(false);
      setTopic("");
      setSource("");
      setEditing(saved.courseId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The AI could not draft that course.");
    } finally {
      setGenerating(false);
    }
  }

  if (editing) return <CbCourseBuilder courseId={editing} onClose={() => setEditing(null)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CbButton size="md" onClick={createBlank}>
          <span className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> New course
          </span>
        </CbButton>
        <CbButton size="md" variant="secondary" onClick={() => setAiOpen((v) => !v)}>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> Draft with AI
          </span>
        </CbButton>
      </div>

      {aiOpen ? (
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <p className="cb-microlabel">Draft a course</p>
          <div className="mt-3 space-y-3">
            <input
              className="w-full rounded-[12px] px-3 py-2 text-[14px]"
              style={input}
              placeholder="Topic — e.g. Door knocking after a hail storm"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <textarea
              className="w-full rounded-[12px] px-3 py-2 text-[14px]"
              style={input}
              rows={5}
              placeholder="Optional: paste your own notes, script or transcript for the AI to build from"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <CbButton
              size="md"
              loading={generating}
              loadingText="Writing the course…"
              onClick={generate}
            >
              Generate draft
            </CbButton>
          </div>
        </CbCard>
      ) : null}

      {courses.isLoading ? (
        <CbLoading label="Loading courses…" />
      ) : (courses.data ?? []).length === 0 ? (
        <CbEmptyState
          headline="No courses yet"
          body="Create one from scratch or let AI draft the first one."
        />
      ) : (
        <div className="space-y-2">
          {(courses.data ?? []).map((c) => (
            <CbCard key={c.id} elevation="card" style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{c.title}</p>
                  {c.description ? (
                    <p
                      className="line-clamp-1 text-[12.5px]"
                      style={{ color: "var(--cb-text-muted)" }}
                    >
                      {c.description}
                    </p>
                  ) : null}
                </div>
                <CbBadge tone={c.status === "published" ? "success" : "warning"}>
                  {c.status === "published" ? "Published" : "Draft"}
                </CbBadge>
                <CbButton size="md" variant="secondary" onClick={() => setEditing(c.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="h-4 w-4" /> Edit
                  </span>
                </CbButton>
              </div>
            </CbCard>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function RequirementsTab() {
  const { workspaceId } = useTrainingScope();
  const rules = useTrainingRules();
  const courses = useCbCourses(true);
  const assignments = useAssignments();
  const [role, setRole] = useState("rep");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [minutes, setMinutes] = useState(60);

  async function saveRule() {
    if (!workspaceId) return;
    const { error } = await cbTable("cb_training_rules").upsert(
      { company_id: workspaceId, role, period, required_minutes: minutes },
      { onConflict: "workspace_id,role" },
    );
    if (error) toast.error(error.message);
    else {
      toast.success("Requirement saved");
      void rules.refetch();
    }
  }

  async function assign(courseId: string, audience: "all" | "role", value?: string) {
    if (!workspaceId) return;
    const { error } = await cbTable("cb_assignments").insert({
      company_id: workspaceId,
      course_id: courseId,
      audience,
      role: audience === "role" ? (value ?? null) : null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Course assigned");
      void assignments.refetch();
    }
  }

  return (
    <div className="space-y-4">
      <CbCard elevation="raised" style={{ padding: 18 }}>
        <p className="cb-microlabel">Required training time</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded-[12px] px-3 py-2 text-[14px]"
            style={input}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">Everyone</option>
            <option value="rep">Reps</option>
            <option value="admin">Admins</option>
            <option value="owner">Owners</option>
          </select>
          <select
            className="rounded-[12px] px-3 py-2 text-[14px]"
            style={input}
            value={period}
            onChange={(e) => setPeriod(e.target.value as "week" | "month")}
          >
            <option value="week">per week</option>
            <option value="month">per month</option>
          </select>
          <input
            type="number"
            className="w-28 rounded-[12px] px-3 py-2 text-[14px]"
            style={input}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 0)}
          />
          <span className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            minutes
          </span>
          <CbButton size="md" onClick={saveRule}>
            Save
          </CbButton>
        </div>
        <div className="mt-3 space-y-1">
          {(rules.data ?? []).map((r) => (
            <p key={r.id} className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {r.role === "all" ? "Everyone" : r.role} — {formatMinutes(r.required_minutes)} per{" "}
              {r.period}
            </p>
          ))}
        </div>
      </CbCard>

      <CbCard elevation="card" style={{ padding: 18 }}>
        <p className="cb-microlabel">Assign courses</p>
        <div className="mt-3 space-y-2">
          {(courses.data ?? []).map((c) => {
            const assigned = (assignments.data ?? []).filter((a) => a.course_id === c.id);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px]">{c.title}</span>
                {assigned.map((a) => (
                  <CbBadge key={a.id} tone="accent">
                    {a.audience === "all" ? "Everyone" : a.role}
                  </CbBadge>
                ))}
                <CbButton size="md" variant="secondary" onClick={() => assign(c.id, "all")}>
                  Everyone
                </CbButton>
                <CbButton size="md" variant="ghost" onClick={() => assign(c.id, "role", "rep")}>
                  Reps
                </CbButton>
              </div>
            );
          })}
        </div>
      </CbCard>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function AccountabilityTab() {
  const { workspaceId } = useTrainingScope();
  const team = useTrainingTeam();
  const { rows } = useScoreboard("month");

  const activity = useQuery({
    queryKey: ["cb-training-activity", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_training_events")
        .select("user_id, kind, seconds, created_at")
        .eq("company_id", workspaceId!)
        .gte("created_at", startOfMonth().toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lastSeen = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of activity.data ?? []) {
      if (!map.has(e.user_id as string)) map.set(e.user_id as string, e.created_at as string);
    }
    return map;
  }, [activity.data]);

  function exportCsv() {
    const lines = [
      "Name,Role,Points,Minutes,Last activity",
      ...rows.map((r) =>
        [
          `"${r.name}"`,
          r.role,
          r.points,
          r.minutes,
          lastSeen.get(r.user_id) ? new Date(lastSeen.get(r.user_id)!).toISOString() : "never",
        ].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "training-activity.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CbButton size="md" variant="secondary" onClick={exportCsv}>
          Export CSV
        </CbButton>
      </div>
      {team.isLoading ? (
        <CbLoading label="Loading team…" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const seen = lastSeen.get(r.user_id);
            return (
              <CbCard key={r.user_id} elevation="card" style={{ padding: 14 }}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{r.name}</p>
                    <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      {r.role} · last activity{" "}
                      {seen ? new Date(seen).toLocaleDateString() : "none this month"}
                    </p>
                  </div>
                  <CbBadge tone="neutral">{formatMinutes(r.minutes)}</CbBadge>
                  <CbBadge tone={r.points > 0 ? "success" : "warning"}>{r.points} pts</CbBadge>
                </div>
              </CbCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
