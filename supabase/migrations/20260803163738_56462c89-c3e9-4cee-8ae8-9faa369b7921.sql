CREATE POLICY "Company members read company assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-assets' AND (
    (storage.foldername(name))[1] = public.auth_company_id()::text OR public.is_super_admin()
  ));

CREATE POLICY "Company admins upload company assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND (
    ((storage.foldername(name))[1] = public.auth_company_id()::text AND public.is_company_admin())
    OR public.is_super_admin()
  ));

CREATE POLICY "Company admins update company assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND (
    ((storage.foldername(name))[1] = public.auth_company_id()::text AND public.is_company_admin())
    OR public.is_super_admin()
  ));

CREATE POLICY "Company admins delete company assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND (
    ((storage.foldername(name))[1] = public.auth_company_id()::text AND public.is_company_admin())
    OR public.is_super_admin()
  ));