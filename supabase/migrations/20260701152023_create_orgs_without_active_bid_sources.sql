create or replace view public.organizations_without_active_bid_sources
with (security_invoker = true) as
select
  official_name,
  organization_type,
  state_code,
  slug,
  official_website
from public.organizations o
where
  state_code = 'FL'
  and not exists (
    select 1
    from public.bid_sources bs
    where
      bs.organization_id = o.id
      and bs.is_active = true
  )
order by organization_type, official_name;

alter view public.organizations_without_active_bid_sources owner to postgres;

revoke all on table public.organizations_without_active_bid_sources from anon, authenticated;
grant select on table public.organizations_without_active_bid_sources to anon, authenticated, service_role;
