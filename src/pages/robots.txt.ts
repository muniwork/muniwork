import type { APIRoute } from 'astro';
import { getCanonicalUrl } from '../lib/site';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const sitemapUrl = getCanonicalUrl(url, '/sitemap.xml');

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
