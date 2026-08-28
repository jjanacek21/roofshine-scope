CREATE POLICY "Signed in read ai reference photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-reference-photos');
CREATE POLICY "Super admins write ai reference photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-reference-photos' AND public.is_super_admin());
CREATE POLICY "Super admins update ai reference photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-reference-photos' AND public.is_super_admin());
CREATE POLICY "Super admins delete ai reference photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-reference-photos' AND public.is_super_admin());