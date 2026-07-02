create table if not exists public.organization_profile_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  statement_type text not null,
  statement_text text not null,
  source_url text not null,
  source_label text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_profile_statements_type_check
    check (statement_type in ('mission', 'vision', 'purpose', 'overview')),
  constraint organization_profile_statements_organization_type_key
    unique (organization_id, statement_type)
);

comment on table public.organization_profile_statements is
  'Source-backed mission, vision, purpose, and overview statements for organization profiles.';

create trigger organization_profile_statements_set_updated_at
before update on public.organization_profile_statements
for each row execute function public.set_updated_at();

alter table public.organization_profile_statements enable row level security;

revoke all on table public.organization_profile_statements from anon, authenticated;
grant select on table public.organization_profile_statements to anon, authenticated, service_role;
grant all on table public.organization_profile_statements to service_role;

create policy "Public can read organization profile statements"
on public.organization_profile_statements
for select
to anon, authenticated
using (true);

insert into public.organization_profile_statements (
  organization_id,
  statement_type,
  statement_text,
  source_url,
  source_label,
  verified_at
)
select
  id,
  'mission',
  'We are dedicated to providing municipal services for our diverse community in an atmosphere of cooperation, courtesy and respect.',
  'https://www.hollywoodfl.org/214/Budget-Strategy',
  'Budget & Strategy',
  now()
from public.organizations
where slug = 'hollywood-fl'
on conflict (organization_id, statement_type) do update
set
  statement_text = excluded.statement_text,
  source_url = excluded.source_url,
  source_label = excluded.source_label,
  verified_at = excluded.verified_at;
