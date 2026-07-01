import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicPropertyDetail } from '../../../../components/public/property-detail';
import {
  buildPropertyMetadata,
  fetchPublicListings,
  fetchPublicProperty,
  fetchPublicSettings,
  propertyIntent,
  propertyPath,
  resolvePublicTenantSlug,
} from '../../../../lib/public-site';

export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tenant?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { tenant } = await searchParams;
  const property = await fetchPublicProperty(slug, resolvePublicTenantSlug(tenant));
  if (!property) return { title: 'Property not found' };
  return buildPropertyMetadata(property, propertyPath(property));
}

export default async function PublicPropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { slug } = await params;
  const { tenant } = await searchParams;
  const tenantSlug = resolvePublicTenantSlug(tenant);
  const property = await fetchPublicProperty(slug, tenantSlug);
  if (!property) notFound();

  const [{ data: cityListings }, settings] = await Promise.all([
    fetchPublicListings({
      tenant: tenantSlug,
      city: property.city,
      intent: propertyIntent(property),
      perPage: 6,
    }),
    fetchPublicSettings(tenantSlug),
  ]);
  const related = cityListings.filter((item) => item.slug !== property.slug).slice(0, 3);

  return (
    <PublicPropertyDetail
      property={property}
      tenant={tenantSlug}
      canonicalUrl={propertyPath(property)}
      related={related}
      settings={settings}
    />
  );
}
