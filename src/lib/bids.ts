import { getSupabaseServerClient } from './supabase.js';

export type OpenBid = {
  id: string;
  title: string;
  bidNumber?: string | null;
  bidType?: string | null;
  issueDate?: string | null;
  closeAt?: string | null;
  publicUrl?: string | null;
  status: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

type BidRow = {
  id: string;
  title: string;
  bid_number: string | null;
  bid_type: string | null;
  issue_date: string | null;
  close_at: string | null;
  public_url: string | null;
  status: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

function normalizeBid(row: BidRow): OpenBid {
  return {
    id: row.id,
    title: row.title,
    bidNumber: row.bid_number,
    bidType: row.bid_type,
    issueDate: row.issue_date,
    closeAt: row.close_at,
    publicUrl: row.public_url,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function getOpenBidsByOrganizationId(
  organizationId: string | null | undefined,
  { limit = 25 }: { limit?: number } = {}
) {
  if (!organizationId) {
    return {
      bids: [],
      total: 0,
    };
  }

  const supabase = getSupabaseServerClient();
  const { data, error, count } = await supabase
    .from('bids')
    .select(
      'id, title, bid_number, bid_type, issue_date, close_at, public_url, status, first_seen_at, last_seen_at',
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .order('close_at', { ascending: true, nullsFirst: false })
    .order('issue_date', { ascending: false, nullsFirst: false })
    .order('title', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load bids for organization ${organizationId}: ${error.message}`);
  }

  return {
    bids: ((data ?? []) as BidRow[]).map(normalizeBid),
    total: count ?? data?.length ?? 0,
  };
}
