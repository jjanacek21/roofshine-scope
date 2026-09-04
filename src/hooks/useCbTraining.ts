import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useProfile } from "@/hooks/useProfile";
import { useCompany } from "@/hooks/useCompany";
import {
  cbTable,
  CB_POINTS,
  startOfMonth,
  startOfWeek,
  type CbAssignment,
  type CbCheckpoint,
  type CbCourse,
  type CbLesson,
  type CbLiveSession,
  type CbModule,
  type CbPointReason,
  type CbProgress,
  type CbTrainingRule,
} from "@/lib/cbTraining";

/**
 * Whose classroom this is, and whether the signed-in user can change it.
 *
 * This used to read the Claim Buddy workspace, which meant Company Training
 * was only reachable by someone who happened to have one. There are ten
 * companies and seven workspaces, so a user at a company without one opened
 * the classroom and found an empty room — not an error, just nothing, because
 * every query below is gated on an id that was null for them.
 *
 * It is the company's training. It follows the company.
 *
 * `workspaceId` keeps its name because a hundred call sites read it, but what
 * it carries is the company id, which is what the tables are now keyed on.
 */
export function useTrainingScope() {
  const { data: profile } = useProfile();
  const { data: company } = useCompany();
  const { surface } = useCbSession();
  const role = profile?.role ?? "rep";
  return {
    workspaceId: profile?.company_id ?? null,
    role,
    isAdmin:
      role === "owner" || role === "admin" || role === "super_admin" || surface === "platform",
    workspaceName: company?.name ?? "your company",
  };
}

/* ---------------------------------------------------------------- */
/* Catalog                                                           */
/* ---------------------------------------------------------------- */

export function useCbCourses(includeDrafts = false) {
  const { workspaceId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-courses", workspaceId, includeDrafts],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = cbTable("cb_courses")
        .select("*")
        .eq("company_id", workspaceId!)
        .is("archived_at", null)
        .order("sort_order")
        .order("created_at");
      if (!includeDrafts) q = q.eq("status", "published");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CbCourse[];
    },
  });
}

export function useCbCourse(courseId: string | null) {
  const { workspaceId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-course", courseId],
    enabled: !!courseId && !!workspaceId,
    queryFn: async () => {
      const [
        { data: course, error: e1 },
        { data: modules, error: e2 },
        { data: lessons, error: e3 },
      ] = await Promise.all([
        cbTable("cb_courses").select("*").eq("id", courseId!).maybeSingle(),
        cbTable("cb_modules").select("*").eq("course_id", courseId!).order("sort_order"),
        cbTable("cb_lessons").select("*").eq("course_id", courseId!).order("sort_order"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      return {
        course: (course ?? null) as unknown as CbCourse | null,
        modules: (modules ?? []) as unknown as CbModule[],
        lessons: (lessons ?? []) as unknown as CbLesson[],
      };
    },
  });
}

export function useCbLesson(lessonId: string | null) {
  return useQuery({
    queryKey: ["cb-lesson", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      const [{ data: lesson, error: e1 }, { data: checkpoints, error: e2 }] = await Promise.all([
        cbTable("cb_lessons").select("*").eq("id", lessonId!).maybeSingle(),
        cbTable("cb_video_checkpoints").select("*").eq("lesson_id", lessonId!).order("at_seconds"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        lesson: (lesson ?? null) as unknown as CbLesson | null,
        checkpoints: (checkpoints ?? []) as unknown as CbCheckpoint[],
      };
    },
  });
}

/* ---------------------------------------------------------------- */
/* Progress                                                          */
/* ---------------------------------------------------------------- */

export function useMyProgress() {
  const { workspaceId } = useTrainingScope();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cb-progress", workspaceId, user?.id],
    enabled: !!workspaceId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_progress")
        .select("*")
        .eq("company_id", workspaceId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as CbProgress[];
    },
  });
}

/** Awards points once per (reason, ref) pair. */
export async function awardPoints(
  workspaceId: string,
  userId: string,
  reason: CbPointReason,
  refId: string | null,
) {
  let dedupe = cbTable("cb_training_points")
    .select("id")
    .eq("company_id", workspaceId)
    .eq("user_id", userId)
    .eq("reason", reason);
  dedupe = refId === null ? dedupe.is("ref_id", null) : dedupe.eq("ref_id", refId);
  const { data: existing } = await dedupe.maybeSingle();
  if (existing) return;
  await cbTable("cb_training_points").insert({
    company_id: workspaceId,
    user_id: userId,
    reason,
    ref_id: refId,
    points: CB_POINTS[reason],
  });
}

export async function logEvent(input: {
  workspaceId: string;
  userId: string;
  kind: string;
  courseId?: string | null;
  lessonId?: string | null;
  seconds?: number;
  meta?: Record<string, unknown>;
}) {
  await cbTable("cb_training_events").insert({
    company_id: input.workspaceId,
    user_id: input.userId,
    kind: input.kind,
    course_id: input.courseId ?? null,
    lesson_id: input.lessonId ?? null,
    seconds: input.seconds ?? 0,
    meta: (input.meta ?? {}) as Json,
  });
}

/* ---------------------------------------------------------------- */
/* Team, scoreboard, rules, live                                     */
/* ---------------------------------------------------------------- */

export interface TeamMemberRow {
  user_id: string;
  name: string;
  email: string | null;
  role: string;
}

/**
 * Who is on the scoreboard.
 *
 * The roster is the company's people, read straight from profiles. It used to
 * be the Claim Buddy workspace's members, which meant a rep could complete a
 * course and still not appear on their own company's board — they were never
 * on the list to begin with.
 */
export function useTrainingTeam() {
  const { workspaceId: companyId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-training-team", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role")
        .eq("company_id", companyId!);
      if (error) throw error;
      return (data ?? []).map((p) => {
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
        return {
          user_id: p.id as string,
          role: (p.role as string) ?? "rep",
          name: fullName || p.email || "Team member",
          email: p.email ?? null,
        };
      }) as TeamMemberRow[];
    },
  });
}

export function useScoreboard(period: "week" | "month" | "all" = "month") {
  const { workspaceId } = useTrainingScope();
  const team = useTrainingTeam();

  const since = useMemo(() => {
    if (period === "week") return startOfWeek().toISOString();
    if (period === "month") return startOfMonth().toISOString();
    return null;
  }, [period]);

  const query = useQuery({
    queryKey: ["cb-scoreboard", workspaceId, period],
    enabled: !!workspaceId,
    queryFn: async () => {
      let pq = cbTable("cb_training_points")
        .select("user_id, points, created_at")
        .eq("company_id", workspaceId!);
      let eq = cbTable("cb_training_events")
        .select("user_id, seconds, kind, created_at")
        .eq("company_id", workspaceId!);
      if (since) {
        pq = pq.gte("created_at", since);
        eq = eq.gte("created_at", since);
      }
      const [{ data: pts, error: e1 }, { data: evts, error: e2 }] = await Promise.all([pq, eq]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { pts: pts ?? [], evts: evts ?? [] };
    },
  });

  const rows = useMemo(() => {
    const points = new Map<string, number>();
    const seconds = new Map<string, number>();
    for (const p of query.data?.pts ?? [])
      points.set(
        p.user_id as string,
        (points.get(p.user_id as string) ?? 0) + (p.points as number),
      );
    for (const e of query.data?.evts ?? [])
      seconds.set(
        e.user_id as string,
        (seconds.get(e.user_id as string) ?? 0) + ((e.seconds as number) ?? 0),
      );
    return (team.data ?? [])
      .map((m) => ({
        ...m,
        points: points.get(m.user_id) ?? 0,
        minutes: Math.round((seconds.get(m.user_id) ?? 0) / 60),
      }))
      .sort((a, b) => b.points - a.points || b.minutes - a.minutes);
  }, [query.data, team.data]);

  return { rows, loading: query.isLoading || team.isLoading, refetch: query.refetch };
}

export function useTrainingRules() {
  const { workspaceId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-training-rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_training_rules")
        .select("*")
        .eq("company_id", workspaceId!);
      if (error) throw error;
      return (data ?? []) as unknown as CbTrainingRule[];
    },
  });
}

export function useAssignments() {
  const { workspaceId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-assignments", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_assignments")
        .select("*")
        .eq("company_id", workspaceId!);
      if (error) throw error;
      return (data ?? []) as unknown as CbAssignment[];
    },
  });
}

export function useLiveSessions() {
  const { workspaceId } = useTrainingScope();
  return useQuery({
    queryKey: ["cb-live-sessions", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_live_sessions")
        .select("*")
        .eq("company_id", workspaceId!)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as CbLiveSession[];
    },
  });
}

/** Minutes of training this user logged in the current week and month. */
export function useMyTrainingMinutes() {
  const { workspaceId } = useTrainingScope();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cb-my-minutes", workspaceId, user?.id],
    enabled: !!workspaceId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await cbTable("cb_training_events")
        .select("seconds, created_at")
        .eq("company_id", workspaceId!)
        .eq("user_id", user!.id)
        .gte("created_at", startOfMonth().toISOString());
      if (error) throw error;
      const weekStart = startOfWeek().getTime();
      let week = 0;
      let month = 0;
      for (const e of data ?? []) {
        const s = (e.seconds as number) ?? 0;
        month += s;
        if (new Date(e.created_at as string).getTime() >= weekStart) week += s;
      }
      return { week: Math.round(week / 60), month: Math.round(month / 60) };
    },
  });
}

export function useInvalidateTraining() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["cb-courses"] });
    void qc.invalidateQueries({ queryKey: ["cb-course"] });
    void qc.invalidateQueries({ queryKey: ["cb-lesson"] });
    void qc.invalidateQueries({ queryKey: ["cb-progress"] });
    void qc.invalidateQueries({ queryKey: ["cb-scoreboard"] });
    void qc.invalidateQueries({ queryKey: ["cb-my-minutes"] });
    void qc.invalidateQueries({ queryKey: ["cb-live-sessions"] });
    void qc.invalidateQueries({ queryKey: ["cb-assignments"] });
    void qc.invalidateQueries({ queryKey: ["cb-training-rules"] });
  };
}
