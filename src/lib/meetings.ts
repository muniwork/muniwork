import { getSupabaseServerClient } from './supabase.js';

export type UpcomingMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string | null;
  location?: string | null;
  publicUrl?: string | null;
  status: string;
};

type MeetingRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  location: string | null;
  public_url: string | null;
  status: string;
};

function normalizeMeeting(row: MeetingRow): UpcomingMeeting {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    location: row.location,
    publicUrl: row.public_url,
    status: row.status,
  };
}

export async function getUpcomingMeetingsByOrganizationId(
  organizationId: string | null | undefined,
  { limit = 5 }: { limit?: number } = {}
) {
  if (!organizationId) {
    return {
      meetings: [],
      total: 0,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from('meetings')
    .select('id, title, starts_at, ends_at, timezone, location, public_url, status', {
      count: 'exact',
    })
    .eq('organization_id', organizationId)
    .eq('status', 'scheduled')
    .gte('starts_at', new Date().toISOString())
    .not('title', 'ilike', '%observed%')
    .order('starts_at', { ascending: true })
    .order('title', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load meetings for organization ${organizationId}: ${error.message}`);
  }

  return {
    meetings: ((data ?? []) as MeetingRow[]).map(normalizeMeeting),
    total: count ?? data?.length ?? 0,
  };
}
