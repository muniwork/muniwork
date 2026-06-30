import { getOpenJobsByOrganizationId, type OpenJob } from './jobs';
import { getOrganizationBySlug } from './organizations.js';

export type OrganizationProfile = {
  id: string;
  officialName: string;
  organizationType: string | null;
  stateCode: string | null;
  officialWebsite: string | null;
  slug: string;
  coverLat: number | null;
  coverLng: number | null;
  coverZoom: number | null;
  coverLocationLabel: string | null;
};

export type OrganizationProfilePageData = {
  organization: OrganizationProfile | null;
  openJobs: OpenJob[];
  totalOpenJobs: number;
};

export async function getOrganizationProfileBySlug(
  slug: string | undefined,
  { jobLimit = 25 }: { jobLimit?: number } = {}
): Promise<OrganizationProfilePageData> {
  const organization = (await getOrganizationBySlug(slug)) as OrganizationProfile | null;

  if (!organization) {
    return {
      organization: null,
      openJobs: [],
      totalOpenJobs: 0,
    };
  }

  const jobsResult = await getOpenJobsByOrganizationId(organization.id, { limit: jobLimit });

  return {
    organization,
    openJobs: jobsResult.jobs,
    totalOpenJobs: jobsResult.total,
  };
}
