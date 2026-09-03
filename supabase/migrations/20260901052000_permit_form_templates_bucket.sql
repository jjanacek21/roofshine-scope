-- Blank city permit forms, shared across companies.
--
-- A city's form belongs to the city, not to whichever contractor happened to
-- upload it, and permit_form_templates deliberately carries no company_id: a
-- map written once fills for every company working that jurisdiction. That is
-- the only route to national coverage that does not require one person to map
-- twenty thousand jurisdictions by hand.
--
-- What is NOT shared: the filled example a contractor learns from. It carries a
-- homeowner's name, their address and somebody's signature, so the learner
-- reads it in the browser and never uploads it. Only the blank and the map land
-- here.
insert into storage.buckets (id, name, public)
values ('permit-form-templates', 'permit-form-templates', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone reads blank permit forms" on storage.objects;
create policy "Anyone reads blank permit forms" on storage.objects
  for select using (bucket_id = 'permit-form-templates');

-- Writing is limited to company admins: a bad map propagates to everyone.
drop policy if exists "Company admins add blank permit forms" on storage.objects;
create policy "Company admins add blank permit forms" on storage.objects
  for insert with check (bucket_id = 'permit-form-templates' and is_company_admin());
