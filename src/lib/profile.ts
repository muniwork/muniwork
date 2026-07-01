import { getOpenBidsByOrganizationId, type OpenBid } from './bids';
import { getOpenJobsByOrganizationId, type OpenJob } from './jobs';
import { getOrganizationBySlug } from './organizations.js';

type OrganizationProfile = {
  id: string;
  officialName: string;
  organizationType: string | null;
  countyName: string | null;
  stateCode: string | null;
  officialWebsite: string | null;
  slug: string;
  coverLat: number | null;
  coverLng: number | null;
  coverZoom: number | null;
  coverLocationLabel: string | null;
  sealAsset: {
    assetType: string;
    mimeType: string | null;
    publicUrl: string;
    sourceUrl: string | null;
    sourceAssetUrl: string | null;
    storagePath: string;
    usageNotes: string | null;
    verificationStatus: string;
  } | null;
};

export type OrganizationProfilePageData = {
  organization: OrganizationProfile | null;
  openJobs: OpenJob[];
  totalOpenJobs: number;
  openBids: OpenBid[];
  totalOpenBids: number;
};

export async function getOrganizationProfileBySlug(
  slug: string | undefined,
  { bidLimit = 25, jobLimit = 25 }: { bidLimit?: number; jobLimit?: number } = {}
): Promise<OrganizationProfilePageData> {
  const organization = (await getOrganizationBySlug(slug)) as OrganizationProfile | null;

  if (!organization) {
    return {
      organization: null,
      openJobs: [],
      totalOpenJobs: 0,
      openBids: [],
      totalOpenBids: 0,
    };
  }

  if (jobLimit <= 0 && bidLimit <= 0) {
    return {
      organization,
      openJobs: [],
      totalOpenJobs: 0,
      openBids: [],
      totalOpenBids: 0,
    };
  }

  const [jobsResult, bidsResult] = await Promise.all([
    jobLimit > 0
      ? getOpenJobsByOrganizationId(organization.id, { limit: jobLimit })
      : Promise.resolve({ jobs: [], total: 0 }),
    bidLimit > 0
      ? getOpenBidsByOrganizationId(organization.id, { limit: bidLimit })
      : Promise.resolve({ bids: [], total: 0 }),
  ]);

  return {
    organization,
    openJobs: jobsResult.jobs,
    totalOpenJobs: jobsResult.total,
    openBids: bidsResult.bids,
    totalOpenBids: bidsResult.total,
  };
}
