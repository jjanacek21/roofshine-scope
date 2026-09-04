-- Company Training belongs to the company, not to a Claim Buddy workspace.
--
-- Every training table was keyed on cb_workspaces, and a workspace is not a
-- company. The two drifted, and the drift was doing real damage:
--
--   * There are ten companies and seven workspaces. A user at Advantex opened
--     Company Training and saw nothing at all -- not an error, just an empty
--     room, because every query was gated on a workspace id that was null for
--     them.
--
--   * Worse, the owner of the whole network built three courses -- "Knocking
--     Doors" among them, with two modules and three lessons -- and they were
--     filed under Roofing & Reconstruction Contractors of America, because
--     that was the Claim Buddy workspace he happened to be in. His own company
--     is Global Contractor Network. The classroom header even said so, out
--     loud, on every page load: "Roofing & Reconstruction Contractors of
--     America's own classroom", to a man who does not work there.
--
-- The name of the feature is the argument. It is the company's classroom, and
-- it should be visible to the company's people whether or not they have ever
-- opened Claim Buddy.
--
-- This is the cheapest this migration will ever be: three courses, two modules,
-- three lessons and six quizzes exist in total.
--
-- workspace_id is kept, and made nullable. Nothing reads it after this, but the
-- old mapping stays on the row so any of this can be traced or undone.

-- ---------------------------------------------------------------------------
-- 1. The column, on all fifteen tables.
-- ---------------------------------------------------------------------------
--
-- cb_progress and cb_video_checkpoints are in this list and are easy to miss:
-- they carry lesson progress and in-video checkpoints, so leaving them behind
-- would give a classroom that lists courses but cannot remember anyone
-- watching one.
do $$
declare t text;
begin
  foreach t in array array[
    'cb_courses','cb_modules','cb_lessons',
    'cb_quizzes','cb_quiz_questions','cb_quiz_attempts',
    'cb_assignments','cb_live_sessions','cb_live_attendance',
    'cb_training_rules','cb_training_points','cb_training_events','cb_training_badges',
    'cb_progress','cb_video_checkpoints'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists company_id uuid references public.companies(id) on delete cascade', t);
    -- The workspace already carries the company it maps to; this reads that
    -- link onto the row.
    execute format(
      'update public.%I x set company_id = w.gc_company_id
         from public.cb_workspaces w
        where w.id = x.workspace_id and x.company_id is null and w.gc_company_id is not null', t);
    execute format('create index if not exists ix_%s_company on public.%I (company_id)', t, t);
    -- Every one of these was NOT NULL, so an insert that names only a company
    -- would be rejected by the column before RLS ever saw it.
    execute format('alter table public.%I alter column workspace_id drop not null', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Give the courses back to the person who made them.
-- ---------------------------------------------------------------------------
--
-- The backfill above is faithful to the old data and wrong about the intent.
-- It reads the workspace's company, and all the training content in this
-- database was created by one account whose workspace and company are two
-- different organisations -- so it filed his courses under a company he does
-- not belong to, and hid them from him.
--
-- Ownership follows the creator, not the workspace they happened to be sitting
-- in. Scoped to the one company pair this actually applies to rather than
-- written as a general rule, because a general rule here would quietly move
-- material for anyone whose two affiliations differ.
do $$
declare t text;
begin
  foreach t in array array[
    'cb_courses','cb_modules','cb_lessons',
    'cb_quizzes','cb_quiz_questions','cb_quiz_attempts',
    'cb_assignments','cb_live_sessions','cb_live_attendance',
    'cb_training_rules','cb_training_points','cb_training_events','cb_training_badges',
    'cb_progress','cb_video_checkpoints'
  ]
  loop
    execute format(
      'update public.%I set company_id = %L where company_id = %L', t,
      'dfd60203-5a0c-4d07-a437-205c651386e0',  -- Global Contractor Network
      'a978a920-68e9-425c-8e71-8451e9458d4f'); -- RRCA, the workspace's company
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Fill the company in on the way in.
-- ---------------------------------------------------------------------------
--
-- Any insert that does not name a company gets the caller's own. Without this
-- the write policies below reject rows from code that has not been updated
-- yet, which is a deploy ordering trap: the migration lands before the
-- frontend does, and the gap between them is where "could not save" bug
-- reports come from.
create or replace function public.cb_training_default_company()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.company_id is null then
    new.company_id := public.auth_company_id();
  end if;
  return new;
end $fn$;

do $$
declare t text;
begin
  foreach t in array array[
    'cb_courses','cb_modules','cb_lessons',
    'cb_quizzes','cb_quiz_questions','cb_quiz_attempts',
    'cb_assignments','cb_live_sessions','cb_live_attendance',
    'cb_training_rules','cb_training_points','cb_training_events','cb_training_badges',
    'cb_progress','cb_video_checkpoints'
  ]
  loop
    execute format('drop trigger if exists trg_%s_company on public.%I', t, t);
    execute format(
      'create trigger trg_%s_company before insert on public.%I
         for each row execute function public.cb_training_default_company()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. The policies, rewritten onto the company.
-- ---------------------------------------------------------------------------
--
-- Same shape as before with one substitution: cb_role(workspace_id) is not
-- null becomes "this row belongs to your company", and cb_is_admin(workspace_id)
-- becomes is_company_admin(). Scope is otherwise unchanged -- nobody reads
-- another company's material, and only an owner or admin writes.
--
-- Dropped by whatever name they were carrying: the old policies were named
-- after the thing ("members read courses") rather than the table, so a
-- name-guessing drop would have left half of them in place, and a leftover
-- workspace policy would keep granting on a column nothing sets any more.

-- Shared material: the company reads, admins write.
do $$
declare r record;
begin
  for r in select unnest(array[
    'cb_courses','cb_modules','cb_lessons','cb_quizzes','cb_quiz_questions',
    'cb_assignments','cb_live_sessions','cb_training_rules']) as t
  loop
    execute (select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, r.t), ' '), '')
             from pg_policies where schemaname='public' and tablename=r.t);
    execute format(
      'create policy "company reads" on public.%I for select to authenticated
         using (company_id = public.auth_company_id())', r.t);
    execute format(
      'create policy "company admins write" on public.%I for all to authenticated
         using (company_id = public.auth_company_id() and public.is_company_admin())
         with check (company_id = public.auth_company_id() and public.is_company_admin())', r.t);
  end loop;
end $$;

-- A rep's own record: they write their own, an admin can read everyone's.
drop policy if exists "own attempts" on public.cb_quiz_attempts;
drop policy if exists "admins read attempts" on public.cb_quiz_attempts;
drop policy if exists "company admins read attempts" on public.cb_quiz_attempts;
create policy "own attempts" on public.cb_quiz_attempts for all to authenticated
  using (user_id = auth.uid() and company_id = public.auth_company_id())
  with check (user_id = auth.uid() and company_id = public.auth_company_id());
create policy "company admins read attempts" on public.cb_quiz_attempts for select to authenticated
  using (company_id = public.auth_company_id() and public.is_company_admin());

drop policy if exists "own attendance" on public.cb_live_attendance;
drop policy if exists "members read attendance" on public.cb_live_attendance;
drop policy if exists "company reads attendance" on public.cb_live_attendance;
create policy "own attendance" on public.cb_live_attendance for all to authenticated
  using (company_id = public.auth_company_id() and (user_id = auth.uid() or public.is_company_admin()))
  with check (company_id = public.auth_company_id() and (user_id = auth.uid() or public.is_company_admin()));
create policy "company reads attendance" on public.cb_live_attendance for select to authenticated
  using (company_id = public.auth_company_id());

-- Progress is the rep's own; the team can see it, which is what a scoreboard is.
drop policy if exists "own progress" on public.cb_progress;
drop policy if exists "team reads progress" on public.cb_progress;
create policy "own progress" on public.cb_progress for all to authenticated
  using (user_id = auth.uid() and company_id = public.auth_company_id())
  with check (user_id = auth.uid() and company_id = public.auth_company_id());
create policy "team reads progress" on public.cb_progress for select to authenticated
  using (company_id = public.auth_company_id());

drop policy if exists "admins write checkpoints" on public.cb_video_checkpoints;
drop policy if exists "members read checkpoints" on public.cb_video_checkpoints;
create policy "company reads checkpoints" on public.cb_video_checkpoints for select to authenticated
  using (company_id = public.auth_company_id());
create policy "company admins write checkpoints" on public.cb_video_checkpoints for all to authenticated
  using (company_id = public.auth_company_id() and public.is_company_admin())
  with check (company_id = public.auth_company_id() and public.is_company_admin());

-- Points, events and badges are append-only from the rep and readable by the team.
do $$
declare r record;
begin
  for r in select unnest(array['cb_training_points','cb_training_events','cb_training_badges']) as t
  loop
    execute (select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, r.t), ' '), '')
             from pg_policies where schemaname='public' and tablename=r.t);
    execute format(
      'create policy "own row insert" on public.%I for insert to authenticated
         with check (user_id = auth.uid() and company_id = public.auth_company_id())', r.t);
    execute format(
      'create policy "team reads" on public.%I for select to authenticated
         using (company_id = public.auth_company_id())', r.t);
  end loop;
end $$;
