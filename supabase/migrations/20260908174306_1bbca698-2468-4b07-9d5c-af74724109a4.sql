create extension if not exists pg_trgm;
create index if not exists idx_lim_name_trgm on public.line_item_master using gin (name gin_trgm_ops);
create index if not exists idx_lim_code_trgm on public.line_item_master using gin (code gin_trgm_ops);