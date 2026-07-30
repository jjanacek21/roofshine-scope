CREATE POLICY "Company members read storm mailer images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'storm-mailer-images' AND (storage.foldername(name))[1] = public.auth_company_id()::text);

CREATE POLICY "Company members upload storm mailer images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'storm-mailer-images' AND (storage.foldername(name))[1] = public.auth_company_id()::text);

CREATE POLICY "Company members delete storm mailer images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'storm-mailer-images' AND (storage.foldername(name))[1] = public.auth_company_id()::text);