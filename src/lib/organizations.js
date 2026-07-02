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

function normalizeProfileStatements(rows) {
  return Object.fromEntries(
    (rows ?? []).map((row) => [
      row.statement_type,
      {
        statementText: row.statement_text,
        sourceUrl: row.source_url,
        sourceLabel: row.source_label,
        verifiedAt: row.verified_at,
      },
    ])
  );
}

function normalizeOrganization(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    officialName: row.official_name,
    organizationType: row.organization_type,
    countyName: row.countyName ?? null,
    stateCode: row.state_code,
    officialWebsite: row.official_website,
    slug: row.slug,
    coverLat: row.cover_lat,
    coverLng: row.cover_lng,
    coverZoom: row.cover_zoom,
    coverLocationLabel: row.cover_location_label,
    sealAsset: row.sealAsset ?? null,
    profileStatements: row.profileStatements ?? {},
  };
}

function normalizeCountyName(value) {
  if (!value) {
    return null;
  }

  const countyName = value.trim();

  return countyName.length > 0 ? countyName : null;
}

async function getCountyNameForOrganization(supabase, organizationId) {
  const { data: sources, error: sourcesError } = await supabase
    .from('organization_sources')
    .select('source_record_id, is_primary')
    .eq('organization_id', organizationId)
    .order('is_primary', { ascending: false })
    .limit(5);

  if (sourcesError) {
    throw new Error(`Failed to load organization source ${organizationId}: ${sourcesError.message}`);
  }

  const censusIds = [
    ...new Set(
      (sources ?? [])
        .map((source) => source.source_record_id?.trim())
        .filter((sourceRecordId) => /^\d+$/.test(sourceRecordId ?? ''))
    ),
  ];

  if (censusIds.length === 0) {
    return null;
  }

  const { data: govUnits, error: govUnitsError } = await supabase
    .from('gov_units_2025')
    .select('CENSUS_ID_PID6, COUNTY_AREA_NAME')
    .in('CENSUS_ID_PID6', censusIds);

  if (govUnitsError) {
    throw new Error(`Failed to load organization county ${organizationId}: ${govUnitsError.message}`);
  }

  const govUnitsByCensusId = new Map(
    (govUnits ?? []).map((govUnit) => [String(govUnit.CENSUS_ID_PID6), govUnit])
  );

  for (const censusId of censusIds) {
    const countyName = normalizeCountyName(govUnitsByCensusId.get(censusId)?.COUNTY_AREA_NAME);

    if (countyName) {
      return countyName;
    }
  }

  return null;
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

  const [
    { data: sealAsset, error: sealAssetError },
    { data: profileStatements, error: profileStatementsError },
    countyName,
  ] = await Promise.all([
    supabase
      .from('organization_identity_assets')
      .select(
        'asset_type, storage_path, mime_type, source_url, source_asset_url, verification_status, usage_notes'
      )
      .eq('organization_id', data.id)
      .eq('asset_type', 'seal')
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('organization_profile_statements')
      .select('statement_type, statement_text, source_url, source_label, verified_at')
      .eq('organization_id', data.id),
    getCountyNameForOrganization(supabase, data.id),
  ]);

  if (sealAssetError) {
    throw new Error(`Failed to load organization seal ${slug}: ${sealAssetError.message}`);
  }

  if (profileStatementsError) {
    throw new Error(
      `Failed to load organization profile statements ${slug}: ${profileStatementsError.message}`
    );
  }

  return normalizeOrganization({
    ...data,
    countyName,
    sealAsset: normalizeIdentityAsset(sealAsset, supabase),
    profileStatements: normalizeProfileStatements(profileStatements),
  });
}

export async function getOrganizationsForSitemap() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('slug, updated_at')
    .not('slug', 'is', null)
    .order('slug', { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to load organization sitemap entries: ${error.message}`);
  }

  return (data ?? [])
    .map((organization) => ({
      slug: organization.slug?.trim(),
      updatedAt: organization.updated_at,
    }))
    .filter((organization) => organization.slug);
}
