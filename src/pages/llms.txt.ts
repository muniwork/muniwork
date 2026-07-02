import type { APIRoute } from 'astro';
import { getCanonicalUrl } from '../lib/site';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const origin = url.origin;
  const sitemapUrl = getCanonicalUrl(url, '/sitemap.xml');

  const body = [
    '# Muniwork',
    '',
    'Muniwork profiles local government organizations and public-sector work surfaces.',
    '',
    '## Available content',
    '',
    `- Home: ${origin}/`,
    `- Organization profiles: ${origin}/{organization-slug}`,
    `- Career pages: ${origin}/{organization-slug}/careers`,
    `- Procurement pages: ${origin}/{organization-slug}/procurement`,
    `- Meeting pages: ${origin}/{organization-slug}/meetings`,
    '',
    '## Discovery',
    '',
    `- Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
