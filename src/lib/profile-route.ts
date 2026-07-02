import { getOrganizationProfileBySlug, type OrganizationProfilePageData } from './profile';
import { MissingSupabaseEnvError } from './supabase.js';

type ProfileRouteOptions = Parameters<typeof getOrganizationProfileBySlug>[1];

const emptyProfile: OrganizationProfilePageData = {
  organization: null,
  openJobs: [],
  totalOpenJobs: 0,
  openBids: [],
  totalOpenBids: 0,
  upcomingMeetings: [],
  totalUpcomingMeetings: 0,
};

export type ProfileRouteData = {
  profile: OrganizationProfilePageData;
  missingSupabaseVariables: string[];
};

export async function loadProfileRouteData(
  slug: string | undefined,
  options: ProfileRouteOptions = {},
  { shouldLoad = true }: { shouldLoad?: boolean } = {}
): Promise<ProfileRouteData> {
  if (!shouldLoad) {
    return {
      profile: emptyProfile,
      missingSupabaseVariables: [],
    };
  }

  try {
    return {
      profile: await getOrganizationProfileBySlug(slug, options),
      missingSupabaseVariables: [],
    };
  } catch (error) {
    if (!(error instanceof MissingSupabaseEnvError)) {
      throw error;
    }

    return {
      profile: emptyProfile,
      missingSupabaseVariables: error.missingVariables,
    };
  }
}

export function getProfileRouteStatus(
  { profile, missingSupabaseVariables }: ProfileRouteData,
  { notFound = !profile.organization }: { notFound?: boolean } = {}
): number | undefined {
  if (missingSupabaseVariables.length > 0) {
    return 503;
  }

  if (notFound) {
    return 404;
  }

  return undefined;
}
