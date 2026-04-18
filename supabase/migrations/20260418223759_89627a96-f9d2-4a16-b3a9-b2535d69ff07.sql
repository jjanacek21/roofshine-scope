
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE POLICY "Super admins view all companies"
ON public.companies FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins update all companies"
ON public.companies FOR UPDATE TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins delete companies"
ON public.companies FOR DELETE TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_super_admin());

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  audience_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read targeted active announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  (expires_at IS NULL OR expires_at > now())
  AND (audience_company_id IS NULL OR audience_company_id = public.auth_company_id())
);

CREATE POLICY "Super admins manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE INDEX idx_announcements_created ON public.announcements (created_at DESC);
CREATE INDEX idx_announcements_expires ON public.announcements (expires_at);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Users can insert their own audit entries"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid());

CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log (actor_user_id);
