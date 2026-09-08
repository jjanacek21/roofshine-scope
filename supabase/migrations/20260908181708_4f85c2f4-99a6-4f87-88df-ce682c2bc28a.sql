create extension if not exists pg_trgm;

create index if not exists idx_lip_book_item on public.line_item_prices (price_book_id, line_item_master_id);
create index if not exists idx_lim_active on public.line_item_master (status, company_id, code);

create or replace function public.get_catalog_bundle(p_price_book_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'price_book_id', p_price_book_id,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_array(
          m.id, m.code, m.name, m.unit, m.trade::text, m.domain, m.subgroup, m.category,
          coalesce(p.unit_price, nullif(m.default_price,0), nullif(m.replace_price,0), nullif(m.remove_price,0), 0),
          m.remove_price, m.replace_price,
          case when p.id is null then 0 else 1 end
        ) order by m.code
      )
      from line_item_master m
      left join line_item_prices p
        on p.line_item_master_id = m.id
       and p.price_book_id = p_price_book_id
      where m.status = 'active'
        and m.company_id is null
        and (p_price_book_id is null or p.id is not null)
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_catalog_bundle(uuid) to authenticated, anon;

with m as (
  select m.id, lower(m.name) nm, m.unit,
         case when m.code ~ '^[0-9]+$' then 'numeric' else 'alpha' end fam,
         m.code,
         (select count(*) from line_item_prices p where p.line_item_master_id = m.id) np
  from line_item_master m
  where m.status = 'active' and m.company_id is null
), g as (
  select *,
         count(*) over (partition by nm, unit, fam) gn,
         row_number() over (partition by nm, unit, fam order by np desc, code) rn
  from m
)
update line_item_master t set status = 'inactive', updated_at = now()
from g
where t.id = g.id and g.gn > 1 and g.rn > 1 and g.np = 0;