
DROP POLICY IF EXISTS "Authenticated can create a company" ON public.companies;

CREATE POLICY "Users without a company can create one" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.auth_company_id() IS NULL
  );
