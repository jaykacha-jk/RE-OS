import { NextResponse, type NextRequest } from 'next/server';

import { fetchPublicListings, propertyPath } from '../../lib/public-site';

export const dynamic = 'force-dynamic';

type SitemapUrl = {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string | null;
};

function tenantFromRequest(request: NextRequest) {
  const queryTenant = request.nextUrl.searchParams.get('tenant');
  if (queryTenant) return queryTenant;

  const host = request.headers.get('host') ?? '';
  const firstLabel = host.split('.')[0];
  if (firstLabel && !['localhost', '127', 'www'].includes(firstLabel)) return firstLabel;
  return 'demo';
}

function baseUrl(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchAllProperties(tenant: string) {
  const firstPage = await fetchPublicListings({ tenant, page: 1, perPage: 60 });
  const properties = [...firstPage.data];
  const totalPages = firstPage.meta?.total_pages ?? 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchPublicListings({ tenant, page, perPage: 60 });
    properties.push(...nextPage.data);
  }

  return properties;
}

export async function GET(request: NextRequest) {
  const tenant = tenantFromRequest(request);
  const base = baseUrl(request);
  const data = await fetchAllProperties(tenant);
  const tenantQuery = `?tenant=${encodeURIComponent(tenant)}`;

  const urls: SitemapUrl[] = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${base}/about${tenantQuery}`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${base}/contact${tenantQuery}`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${base}/privacy`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${base}/terms`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${base}/listings${tenantQuery}`, priority: '0.9', changefreq: 'daily' },
    ...data.map((property) => ({
      loc: `${base}${propertyPath(property)}?tenant=${encodeURIComponent(tenant)}`,
      priority: '0.8',
      changefreq: 'daily',
      lastmod: property.published_at,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
