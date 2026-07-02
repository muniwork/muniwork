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
      'Josh Levy',
      'Mayor',
      'https://www.hollywoodfl.org/1073/Mayor-Josh-Levy',
      'https://www.hollywoodfl.org/89/City-Commission',
      10
    ),
    (
      'Caryl S. Shuham',
      'Commissioner, District 1',
      'https://www.hollywoodfl.org/1074/Caryl-S-Shuham-District-1',
      'https://www.hollywoodfl.org/89/City-Commission',
      20
    ),
    (
      'Peter D. Hernandez',
      'Commissioner, District 2',
      'https://www.hollywoodfl.org/132/Peter-D-Hernandez-District-2',
      'https://www.hollywoodfl.org/89/City-Commission',
      30
    ),
    (
      'Traci L. Callari',
      'Vice Mayor and Commissioner, District 3',
      'https://www.hollywoodfl.org/134/Traci-Callari-District-3',
      'https://www.hollywoodfl.org/89/City-Commission',
      40
    ),
    (
      'Adam Gruber',
      'Commissioner, District 4',
      'https://www.hollywoodfl.org/136/Adam-Gruber-District-4',
      'https://www.hollywoodfl.org/89/City-Commission',
      50
    ),
    (
      'Kevin D. Biederman',
      'Commissioner, District 5',
      'https://www.hollywoodfl.org/138/Kevin-Biederman-District-5',
      'https://www.hollywoodfl.org/89/City-Commission',
      60
    ),
    (
      'Idelma Quintana',
      'Commissioner, District 6',
      'https://www.hollywoodfl.org/1441/Idelma-Quintana-District-6',
      'https://www.hollywoodfl.org/89/City-Commission',
      70
    ),
    (
      'Raelin Storey',
      'City Manager',
      'https://www.hollywoodfl.org/722/Raelin-Storey-City-Manager',
      'https://www.hollywoodfl.org/87/City-Managers-Office',
      80
    )
) as leadership(name, title, url, source_url, display_order)
where organizations.slug = 'hollywood-fl'
on conflict (organization_id, name, title) do update
set
  url = excluded.url,
  source_url = excluded.source_url,
  source_type = excluded.source_type,
  checked_at = now(),
  display_order = excluded.display_order;
