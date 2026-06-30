import { getSupabaseServerClient } from './supabase.js';

export type OpenJob = {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employmentType?: string | null;
  postedAt?: string | null;
  closesAt?: string | null;
  applyUrl?: string | null;
  status: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

type JobRow = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  posted_at: string | null;
  closes_at: string | null;
  apply_url: string | null;
  status: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

function normalizeJob(row: JobRow): OpenJob {
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

export async function getOpenJobsByOrganizationId(
  organizationId: string | null | undefined,
  { limit = 25 }: { limit?: number } = {}
) {
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
    .order('title', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load jobs for organization ${organizationId}: ${error.message}`);
  }

  return {
    jobs: ((data ?? []) as JobRow[]).map(normalizeJob),
    total: count ?? data?.length ?? 0,
  };
}
