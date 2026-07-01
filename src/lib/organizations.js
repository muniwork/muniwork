import { getSupabaseServerClient } from './supabase.js';

const ORGANIZATION_ASSETS_BUCKET = 'organization-assets';

function normalizeIdentityAsset(row, supabase) {
  if (!row) {
    return null;
  }

  return {
    assetType: row.asset_type,
    mimeType: row.mime_type,
    publicUrl: supabase.storage.from(ORGANIZATION_ASSETS_BUCKET).getPublicUrl(row.storage_path)
      .data.publicUrl,
    sourceUrl: row.source_url,
    sourceAssetUrl: row.source_asset_url,
    storagePath: row.storage_path,
    usageNotes: row.usage_notes,
    verificationStatus: row.verification_status,
  };
}

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
    sealAsset: row.sealAsset ?? null,
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

  if (!data) {
    return null;
  }

  const { data: sealAsset, error: sealAssetError } = await supabase
    .from('organization_identity_assets')
    .select(
      'asset_type, storage_path, mime_type, source_url, source_asset_url, verification_status, usage_notes'
    )
    .eq('organization_id', data.id)
    .eq('asset_type', 'seal')
    .eq('is_primary', true)
    .maybeSingle();

  if (sealAssetError) {
    throw new Error(`Failed to load organization seal ${slug}: ${sealAssetError.message}`);
  }

  return normalizeOrganization({
    ...data,
    sealAsset: normalizeIdentityAsset(sealAsset, supabase),
  });
}
