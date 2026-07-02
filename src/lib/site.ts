export const siteName = 'Muniwork';

export const profileRouteSegments = ['', 'careers', 'procurement', 'meetings'];

export function getCanonicalUrl(currentUrl: URL, pathname = currentUrl.pathname): string {
  const url = new URL(pathname, currentUrl.origin);
  url.hash = '';
  url.search = '';

  return url.toString();
}

export function getProfilePath(slug: string, segment = ''): string {
  return segment ? `/${slug}/${segment}` : `/${slug}`;
}

export function getProfileDescription(organization: {
  officialName: string;
  stateCode?: string | null;
}): string {
  const stateText = organization.stateCode ? ` in ${organization.stateCode}` : '';

  return `Profile for ${organization.officialName}${stateText}, including public-sector career opportunities, procurement notices, public meetings, and organization details.`;
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return character;
    }
  });
}
