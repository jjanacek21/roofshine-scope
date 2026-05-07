ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS card_published boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET card_published = true WHERE card_slug IS NOT NULL AND card_published = false;

CREATE OR REPLACE FUNCTION public.get_public_rep_card(_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_blocks jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles
   WHERE lower(card_slug) = lower(_slug)
     AND card_published = true
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
$function$;