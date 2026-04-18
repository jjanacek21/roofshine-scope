DO $$
DECLARE
  v_uid uuid;
BEGIN
  -- jared@globalcontractor.network — force password + confirm + super_admin
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'jared@globalcontractor.network';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt('Billion$26..', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_uid;
    UPDATE public.profiles SET role = 'super_admin', updated_at = now() WHERE id = v_uid;
  END IF;

  -- jaredjjanacek@gmail.com — confirm + super_admin (preserve existing password)
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'jaredjjanacek@gmail.com';
  IF v_uid IS NOT NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_uid;
    UPDATE public.profiles SET role = 'super_admin', updated_at = now() WHERE id = v_uid;
  END IF;
END $$;