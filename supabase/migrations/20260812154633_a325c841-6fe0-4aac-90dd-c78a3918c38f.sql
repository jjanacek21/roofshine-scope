alter table public.cb_workspaces add column if not exists default_price_book_id uuid references public.price_books(id) on delete set null;
alter table public.cb_workspace_members add column if not exists is_active boolean not null default true;
alter table public.cb_workspace_members add column if not exists last_active_at timestamptz;

create table if not exists public.cb_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cb_workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'rep' check (role in ('admin','manager','rep')),
  invited_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

grant select, insert, update, delete on public.cb_invites to authenticated;
grant all on public.cb_invites to service_role;

alter table public.cb_invites enable row level security;

create policy "Workspace admins manage invites"
  on public.cb_invites for all
  to authenticated
  using (public.cb_is_admin(workspace_id))
  with check (public.cb_is_admin(workspace_id));

create trigger cb_invites_touch before update on public.cb_invites
  for each row execute function public.cb_touch_updated_at();

create or replace function public.cb_seats(_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare _rows jsonb;
begin
  if not public.cb_is_admin(_ws) then raise exception 'not allowed'; end if;
  select coalesce(jsonb_agg(x order by x->>'email'), '[]'::jsonb) into _rows from (
    select jsonb_build_object(
      'user_id', m.user_id,
      'email', u.email,
      'name', trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
      'role', m.role,
      'is_active', m.is_active,
      'last_active_at', m.last_active_at,
      'joined_at', m.created_at,
      'job_count', (select count(*) from public.cb_jobs j where j.workspace_id = _ws and j.created_by = m.user_id)
    ) as x
    from public.cb_workspace_members m
    left join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.workspace_id = _ws
  ) s;
  return jsonb_build_object(
    'seats', _rows,
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at)
             order by i.created_at desc)
      from public.cb_invites i
      where i.workspace_id = _ws and i.accepted_at is null and i.revoked_at is null
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.cb_invite_member(_ws uuid, _email text, _role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid(); _existing uuid; _clean text := lower(trim(_email));
begin
  if not public.cb_is_admin(_ws) then raise exception 'not allowed'; end if;
  if _role not in ('admin','manager','rep') then raise exception 'bad role'; end if;

  select id into _existing from auth.users where lower(email) = _clean;
  if _existing is not null then
    insert into public.cb_workspace_members (workspace_id, user_id, role)
    values (_ws, _existing, _role)
    on conflict (workspace_id, user_id) do update set role = excluded.role, is_active = true;
    return jsonb_build_object('seated', true, 'email', _clean);
  end if;

  insert into public.cb_invites (workspace_id, email, role, invited_by)
  values (_ws, _clean, _role, _uid)
  on conflict (workspace_id, email)
    do update set role = excluded.role, revoked_at = null, accepted_at = null, updated_at = now();
  return jsonb_build_object('seated', false, 'email', _clean);
end $$;

create or replace function public.cb_set_member_active(_ws uuid, _user uuid, _active boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.cb_is_admin(_ws) then raise exception 'not allowed'; end if;
  if _user = auth.uid() and _active = false then raise exception 'you cannot deactivate yourself'; end if;
  update public.cb_workspace_members set is_active = _active where workspace_id = _ws and user_id = _user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cb_revoke_invite(_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare _ws uuid;
begin
  select workspace_id into _ws from public.cb_invites where id = _id;
  if _ws is null or not public.cb_is_admin(_ws) then raise exception 'not allowed'; end if;
  update public.cb_invites set revoked_at = now() where id = _id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.cb_claim_invites()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid(); _email text; _n int := 0;
begin
  if _uid is null then return jsonb_build_object('claimed', 0); end if;
  select lower(email) into _email from auth.users where id = _uid;
  if _email is null then return jsonb_build_object('claimed', 0); end if;

  insert into public.cb_workspace_members (workspace_id, user_id, role)
  select i.workspace_id, _uid, i.role
  from public.cb_invites i
  where lower(i.email) = _email and i.accepted_at is null and i.revoked_at is null
  on conflict (workspace_id, user_id) do update set role = excluded.role, is_active = true;

  update public.cb_invites set accepted_at = now()
  where lower(email) = _email and accepted_at is null and revoked_at is null;
  get diagnostics _n = row_count;

  update public.cb_workspace_members set last_active_at = now() where user_id = _uid;
  return jsonb_build_object('claimed', _n);
end $$;

create or replace function public.cb_ensure_demo_job(_ws uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare _uid uuid := auth.uid(); _co uuid; _job uuid;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.cb_workspace_members where workspace_id = _ws and user_id = _uid) then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.cb_jobs where workspace_id = _ws) then
    return jsonb_build_object('created', false);
  end if;

  select id into _co from public.cb_companies where workspace_id = _ws limit 1;

  insert into public.cb_jobs (workspace_id, company_id, created_by, status, customer_name,
                              customer_phone, customer_email, address, city, state, zip,
                              carrier, claim_number, date_of_loss, inspection_date, deductible, scopes)
  values (_ws, _co, _uid, 'draft', 'Demo Homeowner (sample)',
          '555-0100', 'demo@example.com', '1420 Sample Ridge Dr', 'Plano', 'TX', '75024',
          'State Farm', 'DEMO-000123', current_date - 30, current_date, 2500,
          '["roof","exterior"]'::jsonb)
  returning id into _job;

  insert into public.cb_takeoffs (job_id, data, elevations)
  values (_job, '{"safety":{"stories":1,"access":"Ladder","pitch":"6/12"}}'::jsonb, '{}'::jsonb)
  on conflict (job_id) do nothing;

  return jsonb_build_object('created', true, 'job_id', _job);
end $$;