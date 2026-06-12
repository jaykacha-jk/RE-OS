import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicPropertyDetail } from '../../../../../components/public/property-detail';
import {
  buildPropertyMetadata,
  fetchPublicListings,
  fetchPublicProperty,
  isPublicIntent,
  propertyIntent,
  propertyMatchesRoute,
  propertyPath,
} from '../../../../../lib/public-site';

export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ intent: string; city: string; slug: string }>;
  searchParams: Promise<{ tenant?: string }>;
}): Promise<Metadata> {
  const { intent, city, slug } = await params;
  const { tenant } = await searchParams;
  if (!isPublicIntent(intent)) return { title: 'Not found' };

  const property = await fetchPublicProperty(slug, tenant ?? 'demo');
  if (!property || !propertyMatchesRoute(property, intent, city)) return { title: 'Property not found' };
  return buildPropertyMetadata(property, propertyPath(property));
}

export default async function SeoPropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ intent: string; city: string; slug: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { intent, city, slug } = await params;
  const { tenant } = await searchParams;
  if (!isPublicIntent(intent)) notFound();

  const tenantSlug = tenant ?? 'demo';
  const property = await fetchPublicProperty(slug, tenantSlug);
  if (!property || !propertyMatchesRoute(property, intent, city)) notFound();

  const { data: cityListings } = await fetchPublicListings({
    tenant: tenantSlug,
    city: property.city,
    intent: propertyIntent(property),
    perPage: 6,
  });
  const related = cityListings.filter((item) => item.slug !== property.slug).slice(0, 3);

  return (
    <PublicPropertyDetail
      property={property}
      tenant={tenantSlug}
      canonicalUrl={propertyPath(property)}
      related={related}
    />
  );
}
