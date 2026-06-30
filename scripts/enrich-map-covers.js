#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_ZOOM_BY_QUERY_TYPE = {
  address: 12,
  county: 8,
  municipality: 10,
};
const PAGE_SIZE = 500;
const REQUEST_DELAY_MS = 250;

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    limit: null,
    organizationSlug: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--write':
        args.dryRun = false;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--limit':
        args.limit = Number.parseInt(requireValue(argv, ++index, arg), 10);
        break;
      case '--organization':
        args.organizationSlug = requireValue(argv, ++index, arg);
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    throw new Error('--limit must be a positive number');
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function printHelp() {
  console.log(`
Usage:
  npm run enrich:map-covers -- [--dry-run] [--write] [--limit <count>] [--organization <slug>]

Dry-run is the default. Use --write to store coordinates.

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MAPBOX_GEOCODING_TOKEN
`);
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createSupabaseClient() {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function fetchAllOrganizations(client, organizationSlug) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from('organizations')
      .select(
        'id, official_name, organization_type, state_code, official_website, slug, cover_lat, cover_lng, cover_zoom, cover_location_label'
      )
      .order('official_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (organizationSlug) {
      query = query.eq('slug', organizationSlug);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch organizations: ${error.message}`);
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE || organizationSlug) {
      return rows;
    }
  }
}

async function fetchGovUnitContext(client, organizations) {
  const ids = organizations.map((organization) => organization.id);
  const sourceByOrganizationId = new Map();
  const govUnitIds = [];

  for (let from = 0; from < ids.length; from += PAGE_SIZE) {
    const idPage = ids.slice(from, from + PAGE_SIZE);
    const { data, error } = await client
      .from('organization_sources')
      .select('organization_id, source_table, source_record_id, is_primary')
      .in('organization_id', idPage)
      .eq('source_table', 'gov_units_2025')
      .order('is_primary', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch organization source rows: ${error.message}`);
    }

    for (const row of data) {
      if (!sourceByOrganizationId.has(row.organization_id)) {
        sourceByOrganizationId.set(row.organization_id, row);
        govUnitIds.push(Number(row.source_record_id));
      }
    }
  }

  const govUnitById = new Map();
  const uniqueGovUnitIds = [...new Set(govUnitIds)].filter(Number.isFinite);

  for (let from = 0; from < uniqueGovUnitIds.length; from += PAGE_SIZE) {
    const idPage = uniqueGovUnitIds.slice(from, from + PAGE_SIZE);
    const { data, error } = await client
      .from('gov_units_2025')
      .select(
        'CENSUS_ID_PID6, UNIT_NAME, UNIT_TYPE, ADDRESS1, ADDRESS2, CITY, STATE, ZIP, COUNTY_AREA_NAME, WEB_ADDRESS'
      )
      .in('CENSUS_ID_PID6', idPage);

    if (error) {
      throw new Error(`Failed to fetch Census government unit rows: ${error.message}`);
    }

    for (const row of data) {
      govUnitById.set(Number(row.CENSUS_ID_PID6), row);
    }
  }

  return { govUnitById, sourceByOrganizationId };
}

function hasCoverOverride(organization) {
  return (
    organization.cover_lat !== null ||
    organization.cover_lng !== null ||
    organization.cover_zoom !== null ||
    organization.cover_location_label !== null
  );
}

function buildLocationQuery(organization, govUnit) {
  const state = normalizeState(organization.state_code || govUnit?.STATE);
  const organizationType = normalizeText(organization.organization_type);
  const city = titleCase(normalizeText(govUnit?.CITY));
  const name = normalizeName(organization.official_name);
  const address = buildAddress(govUnit);

  if (organizationType === 'municipality' && state && (city || name)) {
    const label = `${city || name}, ${state}`;

    return {
      expectedFeatureTypes: ['place', 'locality'],
      label,
      query: label,
      queryType: 'municipality',
      zoom: DEFAULT_ZOOM_BY_QUERY_TYPE.municipality,
    };
  }

  if (organizationType === 'county' && state && name) {
    const countyName = /\bcounty\b/i.test(name) ? name : `${name} County`;
    const label = `${countyName}, ${state}`;

    return {
      expectedFeatureTypes: ['district', 'place', 'locality'],
      label,
      query: label,
      queryType: 'county',
      zoom: DEFAULT_ZOOM_BY_QUERY_TYPE.county,
    };
  }

  if (address && state) {
    return {
      expectedFeatureTypes: ['address', 'street', 'poi'],
      label: address,
      query: address,
      queryType: 'address',
      zoom: DEFAULT_ZOOM_BY_QUERY_TYPE.address,
    };
  }

  return null;
}

function buildAddress(govUnit) {
  if (!govUnit?.ADDRESS1 || !govUnit?.CITY || !govUnit?.STATE) {
    return null;
  }

  const parts = [
    normalizeText(govUnit.ADDRESS1),
    normalizeText(govUnit.ADDRESS2),
    normalizeText(govUnit.CITY),
    normalizeState(govUnit.STATE),
    govUnit.ZIP ? String(govUnit.ZIP) : null,
  ].filter(Boolean);

  return parts.join(', ');
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeState(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeName(value) {
  return titleCase(normalizeText(value));
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

async function geocodeLocation({ geocodingToken, locationQuery }) {
  const params = new URLSearchParams({
    access_token: geocodingToken,
    country: 'us',
    language: 'en',
    limit: '5',
    permanent: 'true',
    q: locationQuery.query,
    types: locationQuery.expectedFeatureTypes.join(','),
  });
  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'muniwork-map-cover-enrichment/1.0',
    },
  });

  if (!response.ok) {
    return {
      reason: `Mapbox returned ${response.status}`,
      status: 'failed',
    };
  }

  const payload = await response.json();
  const candidates = (payload.features || []).filter((feature) =>
    isConfidentFeature(feature, locationQuery)
  );

  if (candidates.length === 0) {
    return {
      reason: 'no sufficiently confident US/state/type match',
      status: 'skipped',
    };
  }

  if (candidates.length > 1) {
    return {
      reason: `${candidates.length} plausible matches`,
      status: 'ambiguous',
    };
  }

  const feature = candidates[0];
  const coordinates = feature.properties?.coordinates;

  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    mapboxId: feature.properties?.mapbox_id,
    name: feature.properties?.name || feature.properties?.full_address,
    status: 'matched',
  };
}

function isConfidentFeature(feature, locationQuery) {
  const properties = feature.properties || {};
  const coordinates = properties.coordinates || {};
  const featureType = properties.feature_type;

  return (
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    locationQuery.expectedFeatureTypes.includes(featureType) &&
    isUsFeature(properties) &&
    matchesState(properties, locationQuery.label)
  );
}

function isUsFeature(properties) {
  const country = properties.context?.country;
  const code = country?.country_code || country?.country_code_alpha_3;

  return String(code || '').toUpperCase().startsWith('US');
}

function matchesState(properties, label) {
  const expectedState = label.match(/,\s*([A-Z]{2})(?:\b|$)/)?.[1];

  if (!expectedState) {
    return false;
  }

  const region = properties.context?.region || {};
  const values = [
    region.region_code,
    region.region_code_full,
    region.name,
    region.name_en,
  ].map((value) => String(value || '').toUpperCase());

  return values.some(
    (value) => value === expectedState || value === `US-${expectedState}`
  );
}

async function saveCoordinates(client, organization, locationQuery, result) {
  const update = {
    cover_lat: result.latitude,
    cover_lng: result.longitude,
    cover_location_label: locationQuery.label,
    cover_zoom: locationQuery.zoom,
  };
  const { data, error } = await client
    .from('organizations')
    .update(update)
    .eq('id', organization.id)
    .is('cover_lat', null)
    .is('cover_lng', null)
    .is('cover_zoom', null)
    .is('cover_location_label', null)
    .select('id');

  if (error) {
    throw new Error(`Failed to update ${organization.slug}: ${error.message}`);
  }

  return data.length === 1;
}

function log(status, organization, message) {
  console.log(`${status}\t${organization.slug}\t${organization.official_name}\t${message}`);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv);
  const client = createSupabaseClient();
  const geocodingToken = getRequiredEnv('MAPBOX_GEOCODING_TOKEN');
  const organizations = await fetchAllOrganizations(client, args.organizationSlug);
  const { govUnitById, sourceByOrganizationId } = await fetchGovUnitContext(
    client,
    organizations
  );
  const stats = {
    ambiguous: 0,
    failed: 0,
    matched: 0,
    skipped: 0,
    written: 0,
  };

  console.log(args.dryRun ? 'mode\tdry-run' : 'mode\twrite');

  for (const organization of organizations) {
    if (args.limit !== null && stats.matched >= args.limit) {
      break;
    }

    if (hasCoverOverride(organization)) {
      stats.skipped += 1;
      log('skip', organization, 'cover coordinates or label already present');
      continue;
    }

    const source = sourceByOrganizationId.get(organization.id);
    const govUnit = source
      ? govUnitById.get(Number(source.source_record_id))
      : null;
    const locationQuery = buildLocationQuery(organization, govUnit);

    if (!locationQuery) {
      stats.skipped += 1;
      log('skip', organization, 'not enough location context');
      continue;
    }

    const result = await geocodeLocation({ geocodingToken, locationQuery });

    if (result.status !== 'matched') {
      stats[result.status] += 1;
      log(result.status, organization, `${locationQuery.query} (${result.reason})`);
      await delay(REQUEST_DELAY_MS);
      continue;
    }

    stats.matched += 1;
    log(
      'match',
      organization,
      `${locationQuery.query} -> ${result.latitude},${result.longitude} zoom ${locationQuery.zoom}`
    );

    if (!args.dryRun) {
      const didWrite = await saveCoordinates(client, organization, locationQuery, result);

      if (didWrite) {
        stats.written += 1;
        log('write', organization, 'coordinates stored');
      } else {
        stats.skipped += 1;
        log('skip', organization, 'row changed before write; manual values preserved');
      }
    }

    await delay(REQUEST_DELAY_MS);
  }

  console.log(`summary\t${JSON.stringify(stats)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
