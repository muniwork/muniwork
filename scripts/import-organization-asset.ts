#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getSupabaseServerClient } from '../src/lib/supabase.js';

const BUCKET_NAME = 'organization-assets';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const REQUIRED_ENV_VARIABLES = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

type Args = {
  assetType: string | null;
  dryRun: boolean;
  organizationSlug: string | null;
  sourceAssetUrl: string | null;
  sourceUrl: string | null;
  usageNotes: string | null;
};

type ImageFormat = {
  extension: 'jpg' | 'png' | 'svg' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/svg+xml' | 'image/webp';
};

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

    if (!REQUIRED_ENV_VARIABLES.includes(key) || process.env[key]) {
      continue;
    }

    process.env[key] = valueParts.join('=').replace(/^['"]|['"]$/g, '');
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    assetType: null,
    dryRun: false,
    organizationSlug: null,
    sourceAssetUrl: null,
    sourceUrl: null,
    usageNotes: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--organization-slug':
        args.organizationSlug = requireValue(argv, ++index, arg);
        break;
      case '--asset-type':
        args.assetType = requireValue(argv, ++index, arg);
        break;
      case '--source-url':
        args.sourceUrl = requireValue(argv, ++index, arg);
        break;
      case '--source-asset-url':
        args.sourceAssetUrl = requireValue(argv, ++index, arg);
        break;
      case '--usage-notes':
        args.usageNotes = requireValue(argv, ++index, arg);
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const [name, value] of Object.entries({
    '--organization-slug': args.organizationSlug,
    '--asset-type': args.assetType,
    '--source-url': args.sourceUrl,
    '--source-asset-url': args.sourceAssetUrl,
  })) {
    if (!value) {
      throw new Error(`${name} is required`);
    }
  }

  assertSafePathSegment(args.organizationSlug as string, '--organization-slug');
  assertSafePathSegment(args.assetType as string, '--asset-type');
  assertHttpUrl(args.sourceUrl as string, '--source-url');
  assertHttpUrl(args.sourceAssetUrl as string, '--source-asset-url');

  return args;
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function assertSafePathSegment(value: string, flag: string) {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value)) {
    throw new Error(`${flag} must contain only letters, numbers, underscores, or hyphens`);
  }
}

function assertHttpUrl(value: string, flag: string) {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${flag} must be an HTTP or HTTPS URL`);
  }
}

function printHelp() {
  console.log(`
Usage:
  npm run assets:import -- --organization-slug <slug> --asset-type <type> --source-url <url> --source-asset-url <url> [--usage-notes <text>] [--dry-run]

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

async function findOrganization(client: ReturnType<typeof getSupabaseServerClient>, slug: string) {
  const { data, error } = await client
    .from('organizations')
    .select('id, official_name, slug')
    .eq('slug', slug)
    .single();

  if (error) {
    throw new Error(`Failed to find organization "${slug}": ${error.message}`);
  }

  return data;
}

async function downloadAsset(sourceAssetUrl: string) {
  const response = await fetch(sourceAssetUrl, {
    redirect: 'follow',
    headers: {
      'user-agent': 'muniwork-organization-asset-import/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Asset download failed with HTTP ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');

  if (contentLength && Number(contentLength) > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Asset is larger than ${MAX_FILE_SIZE_BYTES} bytes`);
  }

  if (!response.body) {
    throw new Error('Asset response did not include a body');
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Asset is larger than ${MAX_FILE_SIZE_BYTES} bytes`);
    }

    chunks.push(Buffer.from(value));
  }

  const bytes = Buffer.concat(chunks);
  const format = detectImageFormat(bytes);

  if (!format) {
    throw new Error('Asset is not a supported image type; allowed types are PNG, JPEG, WebP, and SVG');
  }

  return {
    bytes,
    finalUrl: response.url,
    format,
    headerContentType: response.headers.get('content-type'),
  };
}

function detectImageFormat(bytes: Buffer): ImageFormat | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  const sample = bytes.toString('utf8', 0, Math.min(bytes.length, 1024)).trimStart();

  if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(sample)) {
    return { extension: 'svg', mimeType: 'image/svg+xml' };
  }

  return null;
}

async function uploadAsset(
  client: ReturnType<typeof getSupabaseServerClient>,
  storagePath: string,
  bytes: Buffer,
  mimeType: string
) {
  const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, bytes, {
    cacheControl: '31536000',
    contentType: mimeType,
    upsert: false,
  });

  if (!error) {
    return 'uploaded';
  }

  if (/already exists|duplicate/i.test(error.message)) {
    return 'already_exists';
  }

  throw new Error(`Failed to upload asset: ${error.message}`);
}

async function upsertIdentityAsset(
  client: ReturnType<typeof getSupabaseServerClient>,
  {
    organizationId,
    assetType,
    storagePath,
    mimeType,
    sourceUrl,
    sourceAssetUrl,
    usageNotes,
  }: {
    assetType: string;
    mimeType: string;
    organizationId: string;
    sourceAssetUrl: string;
    sourceUrl: string;
    storagePath: string;
    usageNotes: string | null;
  }
) {
  const now = new Date().toISOString();
  const row = {
    asset_type: assetType,
    is_primary: true,
    mime_type: mimeType,
    organization_id: organizationId,
    source_asset_url: sourceAssetUrl,
    source_checked_at: now,
    source_url: sourceUrl,
    storage_path: storagePath,
    updated_at: now,
    usage_notes: usageNotes,
    verification_status: 'official_source',
  };

  const { data, error } = await client
    .from('organization_identity_assets')
    .upsert(row, { onConflict: 'organization_id,asset_type' })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to upsert organization identity asset: ${error.message}`);
  }

  return data;
}

function printResult(result: Record<string, unknown>) {
  for (const [key, value] of Object.entries(result)) {
    console.log(`${key}\t${String(value)}`);
  }
}

async function main() {
  loadDotEnv();

  const args = parseArgs(process.argv);
  const client = getSupabaseServerClient();
  const organization = await findOrganization(client, args.organizationSlug as string);
  const download = await downloadAsset(args.sourceAssetUrl as string);
  const sha256 = createHash('sha256').update(download.bytes).digest('hex');
  const storagePath = `${organization.slug}/${args.assetType}/${sha256}.${download.format.extension}`;
  const publicUrl = client.storage.from(BUCKET_NAME).getPublicUrl(storagePath).data.publicUrl;

  if (args.dryRun) {
    printResult({
      mode: 'dry-run',
      organization: organization.official_name,
      asset_type: args.assetType,
      storage_path: storagePath,
      sha256,
      mime_type: download.format.mimeType,
      size_bytes: download.bytes.byteLength,
      source_final_url: download.finalUrl,
      public_url: publicUrl,
    });
    return;
  }

  const uploadStatus = await uploadAsset(
    client,
    storagePath,
    download.bytes,
    download.format.mimeType
  );

  await upsertIdentityAsset(client, {
    assetType: args.assetType as string,
    mimeType: download.format.mimeType,
    organizationId: organization.id,
    sourceAssetUrl: args.sourceAssetUrl as string,
    sourceUrl: args.sourceUrl as string,
    storagePath,
    usageNotes: args.usageNotes,
  });

  printResult({
    mode: 'write',
    organization: organization.official_name,
    asset_type: args.assetType,
    storage_path: storagePath,
    sha256,
    mime_type: download.format.mimeType,
    size_bytes: download.bytes.byteLength,
    upload_status: uploadStatus,
    public_url: publicUrl,
  });
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
