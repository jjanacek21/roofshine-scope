-- Drop and recreate the company INSERT policy with a more direct check
DROP POLICY IF EXISTS "Users without a company can create one" ON public.companies;

CREATE POLICY "Users without a company can create one"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND company_id IS NOT NULL
  )
);