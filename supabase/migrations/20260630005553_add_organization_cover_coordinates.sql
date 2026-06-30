alter table public.organizations
  add column if not exists cover_lat double precision,
  add column if not exists cover_lng double precision,
  add column if not exists cover_zoom double precision,
  add column if not exists cover_location_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_cover_lat_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_cover_lat_check
      check (cover_lat is null or (cover_lat >= -90 and cover_lat <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_cover_lng_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_cover_lng_check
      check (cover_lng is null or (cover_lng >= -180 and cover_lng <= 180));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_cover_zoom_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_cover_zoom_check
      check (cover_zoom is null or (cover_zoom >= 0 and cover_zoom <= 22));
  end if;
end
$$;

comment on column public.organizations.cover_lat is
  'Latitude used for the static public profile map cover.';

comment on column public.organizations.cover_lng is
  'Longitude used for the static public profile map cover.';

comment on column public.organizations.cover_zoom is
  'Mapbox Static Images zoom level used for the public profile map cover.';

comment on column public.organizations.cover_location_label is
  'Human-readable source location text used to derive static map cover coordinates.';
