import { getSupabaseServerClient } from './supabase.js';

export type LeadershipRole = {
  id: string;
  name: string;
  title: string;
  url?: string | null;
  sourceUrl: string;
  sourceType: string;
  checkedAt: string;
  displayOrder: number;
};

type LeadershipRow = {
  id: string;
  name: string;
  title: string;
  url: string | null;
  source_url: string;
  source_type: string;
  checked_at: string;
  display_order: number;
};

function normalizeLeadershipRole(row: LeadershipRow): LeadershipRole {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    url: row.url,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    checkedAt: row.checked_at,
    displayOrder: row.display_order,
  };
}

export async function getLeadershipByOrganizationId(
  organizationId: string | null | undefined,
  { limit = 12 }: { limit?: number } = {}
) {
  if (!organizationId) {
    return [];
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('organization_leadership')
    .select('id, name, title, url, source_url, source_type, checked_at, display_order')
    .eq('organization_id', organizationId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load leadership for organization ${organizationId}: ${error.message}`);
  }

  return ((data ?? []) as LeadershipRow[]).map(normalizeLeadershipRole);
}
