'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

const SOCIALS = [
  { label: 'LinkedIn', short: 'in' },
  { label: 'Twitter', short: 'X' },
  { label: 'Instagram', short: 'IG' },
];

export function PublicFooter() {
  const year = new Date().getFullYear();
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant') ?? 'demo';

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
                RE
              </span>
              <span className="text-lg font-bold text-white">RE-OS</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              The real estate operating system. Verified listings, locality-led discovery, and
              CRM-backed inquiries for modern property teams.
            </p>

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
            © {year} RE-OS. All rights reserved. · Powered by RE-OS
          </p>
          <div className="flex items-center gap-2">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href="#"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-slate-300 transition hover:border-teal-400/40 hover:text-white"
              >
                {social.short}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
