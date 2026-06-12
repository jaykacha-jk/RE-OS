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

export async function GET(request: NextRequest) {
  const tenant = tenantFromRequest(request);
  const base = baseUrl(request);
  const { data } = await fetchPublicListings({ tenant, perPage: 100 });

  const urls: SitemapUrl[] = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'daily' },
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
    <loc>${url.loc}</loc>
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
