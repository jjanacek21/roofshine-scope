
-- 1. Tighten audit_log: remove user-facing insert
DROP POLICY IF EXISTS "Users can insert their own audit entries" ON public.audit_log;

-- 2. Tighten profiles: avoid NULL company match exposing unaffiliated users
DROP POLICY IF EXISTS "View profiles in same company" ON public.profiles;
CREATE POLICY "View profiles in same company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (company_id IS NOT NULL AND company_id = public.auth_company_id())
);

-- 3. Material suppliers: restrict to authenticated only
DROP POLICY IF EXISTS "view suppliers" ON public.material_suppliers;
CREATE POLICY "view suppliers"
ON public.material_suppliers
FOR SELECT
TO authenticated
USING (company_id IS NULL OR company_id = public.auth_company_id());

-- 4. Contracts bucket: private + tenant-scoped read
UPDATE storage.buckets SET public = false WHERE id = 'contracts';
DROP POLICY IF EXISTS "Public read contracts bucket" ON storage.objects;
CREATE POLICY "Tenant members read contracts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts'
  AND EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND tu.tenant_id::text = (storage.foldername(name))[1]
  )
);
