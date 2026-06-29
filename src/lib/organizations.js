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
  };
}

export async function getOrganizationBySlug(slug) {
  if (!slug) {
    return null;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, official_name, organization_type, state_code, official_website, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization ${slug}: ${error.message}`);
  }

  return normalizeOrganization(data);
}
