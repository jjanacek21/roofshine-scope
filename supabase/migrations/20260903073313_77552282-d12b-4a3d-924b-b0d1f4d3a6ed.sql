CREATE POLICY "cb training read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cb-training'
  AND public.cb_role(((storage.foldername(name))[1])::uuid) IS NOT NULL
);

CREATE POLICY "cb training write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cb-training'
  AND public.cb_is_admin(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "cb training update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cb-training'
  AND public.cb_is_admin(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "cb training delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cb-training'
  AND public.cb_is_admin(((storage.foldername(name))[1])::uuid)
);