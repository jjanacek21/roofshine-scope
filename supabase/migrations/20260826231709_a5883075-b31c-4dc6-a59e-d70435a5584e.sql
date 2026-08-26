ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS module_label text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.companies
    ADD CONSTRAINT companies_status_check CHECK (status IN ('active','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.company_set_status(_company_id uuid, _status text)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.companies;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;
  IF _status NOT IN ('active','archived') THEN
    RAISE EXCEPTION 'Invalid status %', _status;
  END IF;
  UPDATE public.companies
     SET status = _status,
         archived_at = CASE WHEN _status = 'archived' THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = _company_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.company_delete_counts(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb := '{}'::jsonb;
  _t text;
  _n bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  FOR _t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'company_id'
       AND t.table_type = 'BASE TABLE'
       AND c.table_name <> 'companies'
     ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id = $1', _t)
      INTO _n USING _company_id;
    IF _n > 0 THEN
      _out := _out || jsonb_build_object(_t, _n);
    END IF;
  END LOOP;

  SELECT count(*) INTO _n FROM public.cb_workspaces WHERE gc_company_id = _company_id;
  IF _n > 0 THEN _out := _out || jsonb_build_object('cb_workspaces', _n); END IF;

  SELECT count(*) INTO _n
    FROM public.lead_contacts lc
    JOIN public.leads l ON l.id = lc.lead_id
   WHERE l.company_id = _company_id;
  IF _n > 0 THEN _out := _out || jsonb_build_object('lead_contacts', _n); END IF;

  _out := _out || jsonb_build_object('companies', 1);
  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.company_purge(_company_id uuid, _confirm_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _co public.companies;
  _t text;
  _deleted jsonb := '{}'::jsonb;
  _n bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super admin only';
  END IF;

  SELECT * INTO _co FROM public.companies WHERE id = _company_id;
  IF _co.id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;
  IF _co.status <> 'archived' THEN
    RAISE EXCEPTION 'Archive the company before permanently deleting it';
  END IF;
  IF _confirm_name IS DISTINCT FROM _co.name THEN
    RAISE EXCEPTION 'Confirmation name does not match';
  END IF;

  DELETE FROM public.lead_contacts lc
   USING public.leads l
   WHERE l.id = lc.lead_id AND l.company_id = _company_id;

  DELETE FROM public.cb_workspaces WHERE gc_company_id = _company_id;

  FOR _t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name = 'company_id'
       AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT IN ('companies','profiles')
     ORDER BY 1
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', _t) USING _company_id;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n > 0 THEN _deleted := _deleted || jsonb_build_object(_t, _n); END IF;
  END LOOP;

  DELETE FROM public.profiles WHERE company_id = _company_id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n > 0 THEN _deleted := _deleted || jsonb_build_object('profiles', _n); END IF;

  DELETE FROM public.companies WHERE id = _company_id;
  RETURN _deleted || jsonb_build_object('companies', 1);
END;
$$;

REVOKE ALL ON FUNCTION public.company_set_status(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.company_delete_counts(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.company_purge(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_set_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_delete_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_purge(uuid, text) TO authenticated;