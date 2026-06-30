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
