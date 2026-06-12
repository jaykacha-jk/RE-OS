import Link from 'next/link';

import {
  inr,
  propertyJsonLd,
  propertyPath,
  type PublicProperty,
} from '../../lib/public-site';
import { PropertyInquiryForm } from './property-inquiry-form';

const NEARBY_BY_CITY: Record<string, string[]> = {
  Ahmedabad: ['SG Highway', 'Satellite', 'Prahlad Nagar', 'Thaltej', 'South Bopal'],
  Surat: ['Vesu', 'Adajan', 'Pal', 'Althan', 'City Light'],
  Vadodara: ['Alkapuri', 'Gotri', 'Manjalpur', 'Akota', 'Harni'],
};

function nearbyFor(city: string) {
  return NEARBY_BY_CITY[city] ?? ['City centre', 'Main road', 'Residential hub', 'Commercial corridor'];
}

export function PublicPropertyDetail({
  property,
  tenant,
  canonicalUrl,
  related = [],
}: {
  property: PublicProperty;
  tenant: string;
  canonicalUrl: string;
  related?: PublicProperty[];
}) {
  const cover = property.cover_image_url ?? property.images[0]?.url;
  const gallery = property.images.length ? property.images : cover ? [{ url: cover, alt_text: property.title }] : [];
  const whatsappText = `Hi, I am interested in ${property.title} in ${property.city}. ${canonicalUrl}`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(propertyJsonLd(property, canonicalUrl)) }}
      />

      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href={`/?tenant=${encodeURIComponent(tenant)}`} className="hover:text-teal-700">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/listings?tenant=${encodeURIComponent(tenant)}`} className="hover:text-teal-700">
          Listings
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-slate-700">{property.title}</span>
      </nav>

      {/* Gallery */}
      {gallery.length ? (
        <div className="mt-6 grid gap-3 overflow-hidden rounded-3xl md:grid-cols-[2fr_1fr] md:grid-rows-2">
          <div className="relative min-h-[280px] md:row-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery[0].url}
              alt={gallery[0].alt_text ?? property.title}
              className="h-full min-h-[280px] w-full object-cover"
            />
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-teal-800 shadow-sm">
              Verified listing
            </span>
          </div>
          {gallery.slice(1, 3).map((img, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${img.url}-${index}`}
              src={img.url}
              alt={img.alt_text ?? property.title}
              className="hidden h-full min-h-[136px] w-full object-cover md:block"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <p className="eyebrow">{property.city}{property.state ? `, ${property.state}` : ''}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{property.title}</h1>
          <p className="mt-2 text-slate-600">
            {property.category} · {property.requirement_type} · {property.type}
          </p>
          <p className="mt-4 text-3xl font-bold text-teal-800">
            {property.price ? inr.format(property.price) : 'Price on request'}
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {property.bedrooms != null ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <dt className="text-slate-500">Bedrooms</dt>
                <dd className="mt-1 text-lg font-semibold">{property.bedrooms}</dd>
              </div>
            ) : null}
            {property.bathrooms != null ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <dt className="text-slate-500">Bathrooms</dt>
                <dd className="mt-1 text-lg font-semibold">{property.bathrooms}</dd>
              </div>
            ) : null}
            {property.super_builtup_area != null ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <dt className="text-slate-500">Super built-up</dt>
                <dd className="mt-1 text-lg font-semibold">{property.super_builtup_area} sqft</dd>
              </div>
            ) : null}
            {property.carpet_area != null ? (
              <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                <dt className="text-slate-500">Carpet area</dt>
                <dd className="mt-1 text-lg font-semibold">{property.carpet_area} sqft</dd>
              </div>
            ) : null}
          </dl>

          {property.description ? (
            <section className="mt-8">
              <h2 className="text-2xl font-bold text-slate-950">Description</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{property.description}</p>
            </section>
          ) : null}

          {property.amenities.length ? (
            <section className="mt-8">
              <h2 className="text-2xl font-bold text-slate-950">Amenities</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {property.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-center gap-2 rounded-xl border border-reos-border bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {amenity}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-2xl font-bold text-slate-950">Location</h2>
            <p className="mt-2 text-sm text-slate-600">
              {property.city}
              {property.state ? `, ${property.state}` : ''}
              {property.pincode ? ` · ${property.pincode}` : ''}
            </p>
            <div className="mt-4 flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-100 text-sm font-medium text-slate-500">
              Map preview — coordinates can be wired when geocoding is enabled
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-bold text-slate-950">Nearby places</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {nearbyFor(property.city).map((place) => (
                <span key={place} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  {place}
                </span>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Listing agent</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-sm font-bold text-teal-900">
                RE
              </span>
              <div>
                <p className="font-bold text-slate-950">RE-OS Sales Team</p>
                <p className="text-sm text-slate-500">Responds within 2 hours</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Local specialists for {property.city} inventory. Site visits and negotiation support available.
            </p>
          </div>

          <PropertyInquiryForm
            tenant={tenant}
            propertySlug={property.slug}
            requirementType={property.requirement_type}
            preferredLocation={property.city}
          />

          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-600 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            Chat on WhatsApp
          </a>
        </aside>
      </div>

      {related.length ? (
        <section className="mt-16 border-t border-reos-border pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">You may also like</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Related properties</h2>
            </div>
            <Link href={`/listings?tenant=${encodeURIComponent(tenant)}&city=${encodeURIComponent(property.city)}`} className="btn-secondary">
              View all in {property.city}
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`${propertyPath(item)}?tenant=${encodeURIComponent(tenant)}`}
                className="group overflow-hidden rounded-3xl border border-reos-border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-raised"
              >
                <div className="h-44 bg-slate-100">
                  {item.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_image_url} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : null}
                </div>
                <div className="p-4">
                  <p className="font-bold text-teal-800">{item.price ? inr.format(item.price) : 'Price on request'}</p>
                  <p className="mt-1 font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.city} · {item.requirement_type}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
