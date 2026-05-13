DROP POLICY IF EXISTS "Company members view leads" ON public.leads;

CREATE POLICY "Company members view leads"
ON public.leads
FOR SELECT
TO authenticated
USING (is_super_admin() OR company_id = auth_company_id());