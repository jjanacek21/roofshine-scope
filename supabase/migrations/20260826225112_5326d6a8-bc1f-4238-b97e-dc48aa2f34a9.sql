revoke execute on function public.company_has_feature(uuid, text) from public, anon;
revoke execute on function public.company_my_context() from public, anon;
grant execute on function public.company_has_feature(uuid, text) to authenticated, service_role;
grant execute on function public.company_my_context() to authenticated, service_role;