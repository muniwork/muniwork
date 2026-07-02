create table if not exists public.organization_leadership (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  title text not null,
  url text,
  source_url text not null,
  source_type text not null default 'official_site',
  checked_at timestamptz not null default now(),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_leadership_name_check check (length(btrim(name)) > 0),
  constraint organization_leadership_title_check check (length(btrim(title)) > 0),
  constraint organization_leadership_source_type_check check (
    source_type in ('official_site', 'official_document', 'election_office', 'news', 'manual')
  ),
  constraint organization_leadership_organization_name_title_key unique (
    organization_id,
    name,
    title
  )
);

comment on table public.organization_leadership is 'Current source-backed leadership rows displayed on organization profiles.';

create index if not exists organization_leadership_organization_order_idx
on public.organization_leadership using btree (organization_id, display_order, name);

create trigger organization_leadership_set_updated_at
before update on public.organization_leadership
for each row execute function public.set_updated_at();

alter table public.organization_leadership enable row level security;

revoke all on table public.organization_leadership from anon, authenticated;
grant select on table public.organization_leadership to anon, authenticated;

create policy "Public can read organization leadership"
on public.organization_leadership
for select
to anon, authenticated
using (true);

create policy "Service role can manage organization leadership"
on public.organization_leadership
for all
to service_role
using (true)
with check (true);

insert into public.organization_leadership (
  organization_id,
  name,
  title,
  url,
  source_url,
  source_type,
  display_order
)
select
  organizations.id,
  leadership.name,
  leadership.title,
  leadership.url,
  leadership.source_url,
  'official_site',
  leadership.display_order
from public.organizations
cross join (
  values
    (
      'Andy Thomson',
      'Mayor & CRA Chair',
      'https://www.myboca.us/772/Mayor',
      'https://www.myboca.us/directory.aspx?did=55',
      10
    ),
    (
      'Michelle Grau',
      'Deputy Mayor',
      'https://www.myboca.us/2927/Michelle-Grau',
      'https://www.myboca.us/directory.aspx?did=55',
      20
    ),
    (
      'Yvette Drucker',
      'City Council Member & CRA Vice Chair',
      'https://www.myboca.us/1948/Yvette-Drucker',
      'https://www.myboca.us/directory.aspx?did=55',
      30
    ),
    (
      'Stacy Sipple',
      'Council Member',
      'https://www.myboca.us/2928/Stacy-Sipple',
      'https://www.myboca.us/directory.aspx?did=55',
      40
    ),
    (
      'Jon Pearlman',
      'Council Member',
      'https://www.myboca.us/2929/Jon-Pearlman',
      'https://www.myboca.us/directory.aspx?did=55',
      50
    ),
    (
      'Mark Sohaney',
      'City Manager',
      'https://www.myboca.us/650/City-Managers-Office',
      'https://www.myboca.us/650/City-Managers-Office',
      60
    )
) as leadership(name, title, url, source_url, display_order)
where organizations.slug = 'boca-raton-fl'
on conflict (organization_id, name, title) do update
set
  url = excluded.url,
  source_url = excluded.source_url,
  source_type = excluded.source_type,
  checked_at = now(),
  display_order = excluded.display_order;
