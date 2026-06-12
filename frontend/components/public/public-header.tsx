'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatCityTitle } from '../../lib/public-site';

const DEFAULT_CITY = 'ahmedabad';
const CITY_OPTIONS = [
  { label: 'Ahmedabad', slug: 'ahmedabad' },
  { label: 'Surat', slug: 'surat' },
  { label: 'Vadodara', slug: 'vadodara' },
  { label: 'Rajkot', slug: 'rajkot' },
  { label: 'Gandhinagar', slug: 'gandhinagar' },
];
const INTENTS = new Set(['buy', 'rent', 'commercial']);

type NavLink = { label: string; href: string };

export function PublicHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const tenant = searchParams.get('tenant') ?? 'demo';
  const q = (path: string) => `${path}?tenant=${encodeURIComponent(tenant)}`;
  const pathParts = pathname.split('/').filter(Boolean);
  const activeIntent = INTENTS.has(pathParts[0]) ? pathParts[0] : 'buy';
  const cityFromPath = INTENTS.has(pathParts[0]) ? pathParts[1] : undefined;
  const cityFromQuery = searchParams.get('city')?.toLowerCase().replace(/\s+/g, '-');
  const currentCitySlug = cityFromPath ?? cityFromQuery ?? DEFAULT_CITY;

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links: NavLink[] = [
    { label: 'Buy', href: q(`/buy/${currentCitySlug}`) },
    { label: 'Rent', href: q(`/rent/${currentCitySlug}`) },
    { label: 'Commercial', href: q(`/commercial/${currentCitySlug}`) },
    { label: 'About', href: q('/about') },
    { label: 'Contact', href: q('/contact') },
  ];

  function onCityChange(nextCity: string) {
    if (pathname === '/listings') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tenant', tenant);
      params.set('city', formatCityTitle(nextCity));
      router.push(`/listings?${params.toString()}`);
      return;
    }
    router.push(`/${activeIntent}/${nextCity}?tenant=${encodeURIComponent(tenant)}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href={q('/')} className="flex items-center gap-2.5" aria-label="RE-OS home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">
            RE
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-950">RE-OS</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <label className="sr-only" htmlFor="public-city-selector">
            Select city
          </label>
          <select
            id="public-city-selector"
            value={currentCitySlug}
            onChange={(event) => onCityChange(event.target.value)}
            className="h-10 rounded-xl border border-reos-border bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-teal-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          >
            {CITY_OPTIONS.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.label}
              </option>
            ))}
          </select>
          <Link href="/login" className="btn-ghost px-3 py-2">
            Login
          </Link>
          <Link href="/login" className="btn-primary px-4 py-2">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost p-2 lg:hidden"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
            <label className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="public-mobile-city-selector">
              City
            </label>
            <select
              id="public-mobile-city-selector"
              value={currentCitySlug}
              onChange={(event) => onCityChange(event.target.value)}
              className="rounded-xl border border-reos-border bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
            >
              {CITY_OPTIONS.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.label}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/login" className="btn-secondary w-full">
                Login
              </Link>
              <Link href="/login" className="btn-primary w-full">
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
