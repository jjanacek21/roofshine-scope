revoke execute on function public.cb_ensure_roof_measurement(uuid) from public, anon;
revoke execute on function public.cb_roof_plan(uuid) from public, anon;
revoke execute on function public.cb_save_roof_plan(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.cb_ensure_roof_measurement(uuid) to authenticated;
grant execute on function public.cb_roof_plan(uuid) to authenticated;
grant execute on function public.cb_save_roof_plan(uuid, jsonb, jsonb, jsonb) to authenticated;