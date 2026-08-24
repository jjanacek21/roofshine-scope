-- 1. Roles: owner / admin / rep
ALTER TABLE public.cb_workspace_members DROP CONSTRAINT IF EXISTS cb_workspace_members_role_check;
ALTER TABLE public.cb_invites DROP CONSTRAINT IF EXISTS cb_invites_role_check;

UPDATE public.cb_workspace_members SET role = 'admin' WHERE role = 'manager';
UPDATE public.cb_invites SET role = 'admin' WHERE role = 'manager';

WITH first_admin AS (
  SELECT DISTINCT ON (workspace_id) id
  FROM public.cb_workspace_members
  WHERE role = 'admin'
  ORDER BY workspace_id, created_at ASC
)
UPDATE public.cb_workspace_members m SET role = 'owner'
FROM first_admin f
WHERE m.id = f.id
  AND NOT EXISTS (
    SELECT 1 FROM public.cb_workspace_members o
    WHERE o.workspace_id = m.workspace_id AND o.role = 'owner'
  );

ALTER TABLE public.cb_workspace_members
  ADD CONSTRAINT cb_workspace_members_role_check CHECK (role = ANY (ARRAY['owner','admin','rep']));
ALTER TABLE public.cb_invites
  ADD CONSTRAINT cb_invites_role_check CHECK (role = ANY (ARRAY['owner','admin','rep']));

-- 2. Seats
ALTER TABLE public.cb_workspaces ADD COLUMN IF NOT EXISTS seats_purchased integer NOT NULL DEFAULT 3;

-- 3. Invite tokens
ALTER TABLE public.cb_invites ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.cb_invites ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE public.cb_invites SET token = encode(gen_random_bytes(24), 'hex') WHERE token IS NULL;
UPDATE public.cb_invites SET expires_at = created_at + interval '14 days' WHERE expires_at IS NULL;
ALTER TABLE public.cb_invites ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(24), 'hex');
ALTER TABLE public.cb_invites ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days');
CREATE UNIQUE INDEX IF NOT EXISTS cb_invites_token_key ON public.cb_invites(token);

-- 4. Role helper functions
CREATE OR REPLACE FUNCTION public.cb_is_admin(_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.cb_workspace_members
  where workspace_id = _ws and user_id = auth.uid() and role in ('owner','admin') and is_active); $$;

CREATE OR REPLACE FUNCTION public.cb_is_owner(_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.cb_workspace_members
  where workspace_id = _ws and user_id = auth.uid() and role = 'owner' and is_active); $$;

CREATE OR REPLACE FUNCTION public.cb_sees_all(_ws uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.cb_workspace_members
  where workspace_id = _ws and user_id = auth.uid() and role in ('owner','admin') and is_active); $$;

CREATE OR REPLACE FUNCTION public.cb_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin'); $$;

-- 5. Invite member: seat limit + new roles
CREATE OR REPLACE FUNCTION public.cb_invite_member(_ws uuid, _email text, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare _uid uuid := auth.uid(); _existing uuid; _clean text := lower(trim(_email));
        _used int; _seats int; _tok text;
begin
  if not public.cb_is_admin(_ws) then raise exception 'not allowed'; end if;
  if _role not in ('owner','admin','rep') then raise exception 'bad role'; end if;
  if _role = 'owner' and not public.cb_is_owner(_ws) then raise exception 'only an owner can create another owner'; end if;

  select seats_purchased into _seats from public.cb_workspaces where id = _ws;
  select (select count(*) from public.cb_workspace_members where workspace_id = _ws and is_active)
       + (select count(*) from public.cb_invites where workspace_id = _ws and accepted_at is null and revoked_at is null)
    into _used;
  if _used >= coalesce(_seats, 0) then
    raise exception 'no seats available';
  end if;

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
    do update set role = excluded.role, revoked_at = null, accepted_at = null,
                  token = encode(gen_random_bytes(24),'hex'),
                  expires_at = now() + interval '14 days', updated_at = now()
  returning token into _tok;
  return jsonb_build_object('seated', false, 'email', _clean, 'token', _tok);
end $$;

-- 6. Seats payload includes seat counts
CREATE OR REPLACE FUNCTION public.cb_seats(_ws uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare _rows jsonb; _seats int; _used int; _pending int;
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
  select seats_purchased into _seats from public.cb_workspaces where id = _ws;
  select count(*) into _used from public.cb_workspace_members where workspace_id = _ws and is_active;
  select count(*) into _pending from public.cb_invites
    where workspace_id = _ws and accepted_at is null and revoked_at is null;
  return jsonb_build_object(
    'seats', _rows,
    'seats_purchased', coalesce(_seats,0),
    'seats_used', _used,
    'seats_pending', _pending,
    'my_role', public.cb_role(_ws),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'role', i.role,
             'created_at', i.created_at, 'token', i.token)
             order by i.created_at desc)
      from public.cb_invites i
      where i.workspace_id = _ws and i.accepted_at is null and i.revoked_at is null
    ), '[]'::jsonb)
  );
end $$;

-- 7. Bootstrap creates an owner; platform mirror maps GC roles
CREATE OR REPLACE FUNCTION public.cb_bootstrap_workspace(_workspace_name text, _company jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare _ws uuid; _co uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  insert into public.cb_workspaces (name, origin, created_by)
  values (coalesce(nullif(_workspace_name,''),'My Company'), 'standalone', _uid) returning id into _ws;
  insert into public.cb_workspace_members (workspace_id, user_id, role) values (_ws, _uid, 'owner');
  insert into public.cb_companies (workspace_id, name, legal_name, logo_url, primary_color, accent_color,
    phone, email, website, address, city, state, zip, license_numbers)
  values (_ws, coalesce(_company->>'name', _workspace_name, 'My Company'), _company->>'legal_name',
    _company->>'logo_url', coalesce(_company->>'primary_color','#1F425D'),
    coalesce(_company->>'accent_color','#E21F2F'), _company->>'phone', _company->>'email',
    _company->>'website', _company->>'address', _company->>'city', _company->>'state', _company->>'zip',
    coalesce(_company->'license_numbers','[]'::jsonb)) returning id into _co;
  insert into public.cb_audit_log (workspace_id, actor, action, entity, entity_id)
  values (_ws, _uid, 'workspace.created.standalone', 'cb_workspaces', _ws);
  return jsonb_build_object('workspace_id', _ws, 'company_id', _co, 'origin','standalone');
end $$;

CREATE OR REPLACE FUNCTION public.cb_ensure_platform_workspace()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare _uid uuid := auth.uid(); _gc uuid; _ws uuid; _co uuid; _gcname text; _role text; _prole text;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select company_id, role::text into _gc, _prole from public.profiles where id = _uid;
  if _gc is null then raise exception 'no GlobalContractor company on this account'; end if;
  _role := case when _prole in ('owner','super_admin') then 'owner'
                when _prole in ('admin','estimator') then 'admin' else 'rep' end;
  select id into _ws from public.cb_workspaces where gc_company_id = _gc;
  if _ws is null then
    select name into _gcname from public.companies where id = _gc;
    insert into public.cb_workspaces (name, origin, gc_company_id, created_by, measure_credits, plan, seats_purchased)
    values (coalesce(_gcname,'Company'), 'platform', _gc, _uid, 999999, 'team', 999) returning id into _ws;
  end if;
  insert into public.cb_workspace_members (workspace_id, user_id, role) values (_ws, _uid, _role)
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  select id into _co from public.cb_companies where workspace_id = _ws and gc_company_id = _gc;
  if _co is null then
    insert into public.cb_companies (workspace_id, gc_company_id, name, is_locked)
    values (_ws, _gc, coalesce((select name from public.companies where id=_gc),'Company'), true)
    returning id into _co;
  end if;
  update public.cb_companies c set
    name = g.name, logo_url = coalesce(g.logo_url, c.logo_url), phone = coalesce(g.phone, c.phone),
    email = coalesce(g.email, c.email), website = coalesce(g.website, c.website),
    address = coalesce(g.address, c.address), license_numbers = to_jsonb(g.license_numbers),
    insurance_note = coalesce(g.warranty_blurb, c.insurance_note), is_locked = true, updated_at = now()
  from public.companies g where c.id = _co and g.id = _gc;
  return jsonb_build_object('workspace_id', _ws, 'company_id', _co, 'origin','platform',
                            'gc_company_id', _gc, 'role', _role);
end $$;

-- 8. Dispositions scoped to a workspace
ALTER TABLE public.property_dispositions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.cb_workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS property_dispositions_workspace_idx ON public.property_dispositions(workspace_id);

UPDATE public.property_dispositions d
SET workspace_id = m.workspace_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, workspace_id
  FROM public.cb_workspace_members WHERE is_active
  ORDER BY user_id, created_at ASC
) m
WHERE d.workspace_id IS NULL AND m.user_id = d.user_id;

DROP POLICY IF EXISTS "users manage own dispositions" ON public.property_dispositions;
CREATE POLICY "dispositions own access" ON public.property_dispositions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dispositions workspace leaders read" ON public.property_dispositions
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.cb_sees_all(workspace_id));
CREATE POLICY "dispositions workspace leaders update" ON public.property_dispositions
  FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.cb_sees_all(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.cb_sees_all(workspace_id));

-- 9. Demo requests from the marketing site
CREATE TABLE IF NOT EXISTS public.cb_demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  seats integer,
  message text,
  source text NOT NULL DEFAULT 'landing',
  kind text NOT NULL DEFAULT 'demo',
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.cb_demo_requests TO authenticated;
GRANT ALL ON public.cb_demo_requests TO service_role;
ALTER TABLE public.cb_demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins read demo requests" ON public.cb_demo_requests
  FOR SELECT TO authenticated USING (public.cb_is_super_admin());
CREATE POLICY "super admins update demo requests" ON public.cb_demo_requests
  FOR UPDATE TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_demo_requests_touch BEFORE UPDATE ON public.cb_demo_requests
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();