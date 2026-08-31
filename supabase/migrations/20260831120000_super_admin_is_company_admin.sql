-- A super admin was not counted as a company admin.
--
-- 46 RLS policies are written as `company_id = auth_company_id() AND
-- is_company_admin()`. Only 14 of them remembered to also allow
-- `is_super_admin()`. On the other 32 — including the one guarding company
-- credentials — a super admin was treated as LESS privileged than an admin and
-- was refused writes to their own company. That is why saving a company
-- document failed for every super admin, every time, with no row ever written.
--
-- Fixing the helper rather than the 32 policies keeps the two roles from
-- drifting apart again the next time a policy is added.
--
-- Scope is unchanged. Every one of those policies still requires the row to
-- belong to the caller's own company, so this grants a super admin nothing
-- outside the company on their own profile.
create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('owner', 'admin', 'super_admin')
  );
$function$;
