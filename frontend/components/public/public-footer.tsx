'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { API_BASE, type PublicSettings, resolvePublicTenantSlug } from '../../lib/public-site';
import { NewsletterForm } from './newsletter-form';

const DEFAULT_CITY = 'ahmedabad';

type Column = { title: string; links: { label: string; href: string }[] };

const COLUMNS: Column[] = [
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/about' },
    ],
  },
  {
    title: 'Properties',
    links: [
      { label: 'Buy', href: `/buy/${DEFAULT_CITY}` },
      { label: 'Rent', href: `/rent/${DEFAULT_CITY}` },
      { label: 'Commercial', href: `/commercial/${DEFAULT_CITY}` },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Sign in', href: '/login' },
    ],
  },
];

const SOCIAL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

export function PublicFooter() {
  const year = new Date().getFullYear();
  const searchParams = useSearchParams();
  const tenant = resolvePublicTenantSlug(searchParams.get('tenant'));
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/public/settings?tenant=${encodeURIComponent(tenant)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.data) setSettings(body.data as PublicSettings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  const siteName = settings?.name ?? 'RE-OS';
  const about =
    settings?.website?.footer?.about ??
    'Verified listings, locality-led discovery, and CRM-backed inquiries for modern property teams.';
  const copyright = settings?.website?.footer?.copyright;
  const socialEntries = Object.entries(settings?.website?.social_links ?? {}).filter(
    ([, url]) => typeof url === 'string' && url.length > 0,
  ) as Array<[string, string]>;
  const showPoweredBy = settings?.powered_by_reos !== false;

  function hrefFor(path: string) {
    if (path === '/login') return path;
    return `${path}?tenant=${encodeURIComponent(tenant)}`;
  }

  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">
                {siteName.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-lg font-bold text-white">{siteName}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{about}</p>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Newsletter
            </p>
            <p className="mt-1 text-sm text-slate-400">New listings and market insights, monthly.</p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {column.title}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.label}`}>
                      <Link
                        href={hrefFor(link.href)}
                        className="text-sm text-slate-400 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © {year} {siteName}. {copyright ?? 'All rights reserved.'}
            {showPoweredBy ? ' · Powered by RE-OS' : ''}
          </p>
          {socialEntries.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {socialEntries.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={SOCIAL_LABELS[key] ?? key}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-teal-400/40 hover:text-white"
                >
                  {SOCIAL_LABELS[key] ?? key}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
