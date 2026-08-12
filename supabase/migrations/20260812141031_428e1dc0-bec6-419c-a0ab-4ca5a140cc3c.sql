alter table public.cb_companies add column if not exists default_doc_type text not null default 'contingency';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cb_companies_default_doc_type_check') then
    alter table public.cb_companies add constraint cb_companies_default_doc_type_check check (default_doc_type in ('contingency','retail'));
  end if;
end $$;