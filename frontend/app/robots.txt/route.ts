import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function baseUrl(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export function GET(request: NextRequest) {
  const base = baseUrl(request);
  const body = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /platform
Disallow: /settings
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`;

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
