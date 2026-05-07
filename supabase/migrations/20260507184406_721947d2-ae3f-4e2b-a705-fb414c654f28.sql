
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS mobile_phone text,
  ADD COLUMN IF NOT EXISTS office_phone text,
  ADD COLUMN IF NOT EXISTS card_slug text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_card_slug_key ON public.profiles (lower(card_slug)) WHERE card_slug IS NOT NULL;

-- 2. rep_card_blocks
CREATE TABLE IF NOT EXISTS public.rep_card_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('link','photo','document','video')),
  title text,
  subtitle text,
  url text,
  storage_path text,
  thumb_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rep_card_blocks_user ON public.rep_card_blocks(user_id, sort_order);

ALTER TABLE public.rep_card_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own blocks" ON public.rep_card_blocks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Company members view team blocks" ON public.rep_card_blocks
  FOR SELECT TO authenticated
  USING (company_id = public.auth_company_id());

CREATE POLICY "Super admin manages blocks" ON public.rep_card_blocks
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_rep_card_blocks_updated
  BEFORE UPDATE ON public.rep_card_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rep-card-assets','rep-card-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read rep card assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'rep-card-assets');

CREATE POLICY "Users upload own rep card assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rep-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own rep card assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rep-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own rep card assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rep-card-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Public RPC for /c/:slug
CREATE OR REPLACE FUNCTION public.get_public_rep_card(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_blocks jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles
   WHERE lower(card_slug) = lower(_slug)
     AND onboarding_completed_at IS NOT NULL
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = v_profile.company_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.sort_order), '[]'::jsonb)
    INTO v_blocks
    FROM public.rep_card_blocks b
   WHERE b.user_id = v_profile.id AND b.is_visible = true;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'first_name', v_profile.first_name,
      'last_name', v_profile.last_name,
      'email', v_profile.email,
      'title', v_profile.title,
      'bio', v_profile.bio,
      'avatar_url', v_profile.avatar_url,
      'mobile_phone', v_profile.mobile_phone,
      'office_phone', v_profile.office_phone,
      'card_slug', v_profile.card_slug
    ),
    'company', CASE WHEN v_company.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'logo_url', v_company.logo_url,
      'website', v_company.website,
      'phone', v_company.phone,
      'email', v_company.email
    ) END,
    'blocks', v_blocks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_rep_card(text) TO anon, authenticated;

-- 5. Server-side helpers used by super-admin company creation flow
CREATE OR REPLACE FUNCTION public.create_company_as_super_admin(
  _name text,
  _address text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _website text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.companies (name, address, phone, email, website)
  VALUES (_name, _address, _phone, _email, _website)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_as_super_admin(text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_invite_as_super_admin(
  _company_id uuid,
  _email text,
  _role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _role = 'super_admin'::app_role THEN
    RAISE EXCEPTION 'Cannot invite super_admin role';
  END IF;
  INSERT INTO public.company_invites (company_id, email, role, invited_by)
  VALUES (_company_id, _email, _role, auth.uid())
  RETURNING id, token INTO v_id, v_token;
  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_invite_as_super_admin(uuid,text,app_role) TO authenticated;

-- 6. Slug availability check
CREATE OR REPLACE FUNCTION public.is_card_slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(card_slug) = lower(_slug) AND id <> auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_card_slug_available(text) TO authenticated;
