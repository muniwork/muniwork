import type { APIRoute } from 'astro';
import { getOrganizationsForSitemap } from '../lib/organizations.js';
import { escapeXml, getCanonicalUrl, getProfilePath, profileRouteSegments } from '../lib/site';

export const prerender = false;

type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
  priority: string;
};

export const GET: APIRoute = async ({ url }) => {
  const organizations = await getOrganizationsForSitemap();
  const now = new Date().toISOString();
  const entries: SitemapEntry[] = [
    {
      loc: getCanonicalUrl(url, '/'),
      priority: '1.0',
    },
    ...organizations.flatMap((organization) =>
      profileRouteSegments.map((segment) => ({
        loc: getCanonicalUrl(url, getProfilePath(organization.slug, segment)),
        lastmod: organization.updatedAt ?? now,
        priority: segment ? '0.7' : '0.9',
      }))
    ),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) => [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        entry.lastmod ? `    <lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>` : '',
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ].filter(Boolean).join('\n')
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
