
DROP POLICY IF EXISTS "Tenant members read contracts" ON storage.objects;
CREATE POLICY "Tenant members read contracts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND t.slug = (storage.foldername(name))[1]
  )
);
