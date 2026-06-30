import { getSupabaseServerClient } from './supabase.js';

function normalizeOrganization(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    officialName: row.official_name,
    organizationType: row.organization_type,
    stateCode: row.state_code,
    officialWebsite: row.official_website,
    slug: row.slug,
    coverLat: row.cover_lat,
    coverLng: row.cover_lng,
    coverZoom: row.cover_zoom,
    coverLocationLabel: row.cover_location_label,
  };
}

function normalizeJob(row) {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    employmentType: row.employment_type,
    postedAt: row.posted_at,
    closesAt: row.closes_at,
    applyUrl: row.apply_url,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function getOrganizationBySlug(slug) {
  if (!slug) {
    return null;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, official_name, organization_type, state_code, official_website, slug, cover_lat, cover_lng, cover_zoom, cover_location_label'
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization ${slug}: ${error.message}`);
  }

  return normalizeOrganization(data);
}

export async function getOpenJobsByOrganizationId(organizationId, { limit = 25 } = {}) {
  if (!organizationId) {
    return {
      jobs: [],
      total: 0,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from('jobs')
    .select(
      'id, title, department, location, employment_type, posted_at, closes_at, apply_url, status, first_seen_at, last_seen_at',
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load jobs for organization ${organizationId}: ${error.message}`);
  }

  return {
    jobs: (data ?? []).map(normalizeJob),
    total: count ?? data?.length ?? 0,
  };
}
