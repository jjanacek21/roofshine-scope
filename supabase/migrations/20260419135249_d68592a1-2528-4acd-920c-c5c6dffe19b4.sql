CREATE POLICY "Super admins manage xactimate uploads"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'xactimate-uploads' AND public.is_super_admin())
WITH CHECK (bucket_id = 'xactimate-uploads' AND public.is_super_admin());