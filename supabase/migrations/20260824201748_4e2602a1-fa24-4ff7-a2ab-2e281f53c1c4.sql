CREATE TABLE public.cb_site_edits (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_key text not null,
  path text,
  old_value jsonb,
  new_value jsonb,
  instruction text,
  reverted_at timestamptz,
  applied_by uuid,
  applied_at timestamptz not null default now()
);

GRANT SELECT ON public.cb_site_edits TO authenticated;
GRANT ALL ON public.cb_site_edits TO service_role;

ALTER TABLE public.cb_site_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read site edits"
  ON public.cb_site_edits FOR SELECT TO authenticated
  USING (public.cb_is_super_admin());

CREATE INDEX cb_site_edits_applied_at_idx ON public.cb_site_edits (applied_at DESC);