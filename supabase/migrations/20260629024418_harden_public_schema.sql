-- Keep the exposed public schema read-only for client roles. Server-side code and
-- ingestion continue to use service_role for writes.

alter function public.set_updated_at() set search_path = public, pg_temp;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.set_updated_at() from authenticated;
grant execute on function public.set_updated_at() to service_role;

revoke all on table public.gov_units_2025 from anon, authenticated;
revoke all on table public.job_ingestion_runs from anon, authenticated;
revoke all on table public.job_sources from anon, authenticated;
revoke all on table public.jobs from anon, authenticated;
revoke all on table public.organization_retirement from anon, authenticated;
revoke all on table public.organization_sources from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organizations_without_active_job_sources from anon, authenticated;

grant select on table public.gov_units_2025 to anon, authenticated;
grant select on table public.job_sources to anon, authenticated;
grant select on table public.jobs to anon, authenticated;
grant select on table public.organization_retirement to anon, authenticated;
grant select on table public.organization_sources to anon, authenticated;
grant select on table public.organizations to anon, authenticated;
grant select on table public.organizations_without_active_job_sources to anon, authenticated;

create policy "Public can read Census government units"
on public.gov_units_2025
for select
to anon, authenticated
using (true);

create policy "Service role can manage job ingestion runs"
on public.job_ingestion_runs
for all
to service_role
using (true)
with check (true);

create policy "Public can read active job sources"
on public.job_sources
for select
to anon, authenticated
using (is_active);

create policy "Public can read open jobs"
on public.jobs
for select
to anon, authenticated
using (status = 'open');

create policy "Public can read organization retirement"
on public.organization_retirement
for select
to anon, authenticated
using (true);

create policy "Public can read organization sources"
on public.organization_sources
for select
to anon, authenticated
using (true);

create policy "Public can read organizations"
on public.organizations
for select
to anon, authenticated
using (true);

create index if not exists organization_sources_organization_id_idx
on public.organization_sources using btree (organization_id);

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from public;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
