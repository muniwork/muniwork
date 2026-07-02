create table if not exists public.meeting_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null,
  provider text not null,
  source_url text not null,
  public_url text,
  is_active boolean not null default true,
  last_feed_hash text,
  last_checked_at timestamptz,
  last_successful_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_sources_source_type_check check (source_type in ('civicplus_ical')),
  constraint meeting_sources_organization_source_url_key unique (organization_id, source_url)
);

comment on table public.meeting_sources is 'Public meeting calendar and archive sources monitored for an organization.';

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_source_id uuid not null references public.meeting_sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text,
  location text,
  public_url text,
  status text not null default 'scheduled',
  source_updated_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_status_check check (status in ('scheduled', 'canceled', 'unknown')),
  constraint meetings_organization_source_external_id_key unique (organization_id, meeting_source_id, external_id)
);

comment on table public.meetings is 'Normalized public meetings collected from official public calendar sources.';

create table if not exists public.meeting_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  meeting_source_id uuid not null references public.meeting_sources(id) on delete cascade,
  provider text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  meetings_seen integer not null default 0,
  meetings_inserted integer not null default 0,
  meetings_updated integer not null default 0,
  meetings_unchanged integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint meeting_ingestion_runs_meetings_seen_check check (meetings_seen >= 0),
  constraint meeting_ingestion_runs_meetings_inserted_check check (meetings_inserted >= 0),
  constraint meeting_ingestion_runs_meetings_updated_check check (meetings_updated >= 0),
  constraint meeting_ingestion_runs_meetings_unchanged_check check (meetings_unchanged >= 0),
  constraint meeting_ingestion_runs_status_check check (status in ('running', 'succeeded', 'failed', 'dry_run', 'skipped'))
);

comment on table public.meeting_ingestion_runs is 'Operational record of each meeting-source ingestion attempt.';

create index if not exists meeting_sources_active_idx
on public.meeting_sources using btree (is_active, provider);

create index if not exists meetings_upcoming_by_organization_idx
on public.meetings using btree (organization_id, starts_at)
where status = 'scheduled';

create index if not exists meetings_recent_by_organization_idx
on public.meetings using btree (organization_id, starts_at desc);

create trigger meeting_sources_set_updated_at
before update on public.meeting_sources
for each row execute function public.set_updated_at();

create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

alter table public.meeting_sources enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_ingestion_runs enable row level security;

revoke all on table public.meeting_sources from anon, authenticated;
revoke all on table public.meetings from anon, authenticated;
revoke all on table public.meeting_ingestion_runs from anon, authenticated;

grant select on table public.meeting_sources to anon, authenticated;
grant select on table public.meetings to anon, authenticated;

create policy "Public can read active meeting sources"
on public.meeting_sources
for select
to anon, authenticated
using (is_active);

create policy "Public can read public meetings"
on public.meetings
for select
to anon, authenticated
using (true);

create policy "Service role can manage meeting sources"
on public.meeting_sources
for all
to service_role
using (true)
with check (true);

create policy "Service role can manage meetings"
on public.meetings
for all
to service_role
using (true)
with check (true);

create policy "Service role can manage meeting ingestion runs"
on public.meeting_ingestion_runs
for all
to service_role
using (true)
with check (true);

insert into public.meeting_sources (
  organization_id,
  source_type,
  provider,
  source_url,
  public_url,
  is_active
)
select
  id,
  'civicplus_ical',
  'CivicPlus',
  'https://www.myboca.us/common/modules/iCalendar/iCalendar.aspx?catID=29&feed=calendar',
  'https://www.myboca.us/129/Agendas',
  true
from public.organizations
where slug = 'boca-raton-fl'
on conflict (organization_id, source_url) do update
set
  source_type = excluded.source_type,
  provider = excluded.provider,
  public_url = excluded.public_url,
  is_active = excluded.is_active;
