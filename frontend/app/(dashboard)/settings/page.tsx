'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getSession, hasPermission, isFeatureEnabled, type AuthSession } from '../../../lib/auth';

type Card = {
  href: string;
  title: string;
  description: string;
  permission: string;
  featureFlag?: string;
  hiddenInLaunch?: boolean;
  group: 'Brand' | 'Growth' | 'Platform' | 'Trust';
  accent: string;
};

const CARDS: Card[] = [
  {
    href: '/settings/branding',
    title: 'Branding',
    description: 'Logo, favicon, colors, typography, email & PDF branding.',
    permission: 'settings.branding.manage',
    hiddenInLaunch: true,
    group: 'Brand',
    accent: 'bg-teal-100 text-teal-800',
  },
  // Website setup — temporarily disabled
  // {
  //   href: '/settings/website',
  //   title: 'Website Setup',
  //   description: 'Launch-ready brand, homepage, contact, social, and SEO basics.',
  //   permission: 'settings.website.manage',
  //   group: 'Brand',
  //   accent: 'bg-amber-100 text-amber-800',
  // },
  {
    href: '/settings/seo',
    title: 'SEO',
    description: 'Meta tags, Open Graph, Twitter cards, schema, robots, sitemap.',
    permission: 'settings.seo.manage',
    hiddenInLaunch: true,
    group: 'Growth',
    accent: 'bg-blue-100 text-blue-800',
  },
  {
    href: '/settings/domains',
    title: 'Custom domains',
    description: 'Connect white-label domains with DNS verification + SSL.',
    permission: 'settings.read',
    featureFlag: 'domains',
    hiddenInLaunch: true,
    group: 'Trust',
    accent: 'bg-slate-100 text-slate-800',
  },
  {
    href: '/settings/features',
    title: 'Feature flags',
    description: 'Enable or disable platform capabilities per organization.',
    permission: 'settings.features.manage',
    hiddenInLaunch: true,
    group: 'Platform',
    accent: 'bg-purple-100 text-purple-800',
  },
  {
    href: '/settings/configuration',
    title: 'Configuration',
    description: 'Timezone, currency, language, date & number formats.',
    permission: 'settings.configuration.manage',
    hiddenInLaunch: true,
    group: 'Platform',
    accent: 'bg-teal-100 text-teal-800',
  },
  {
    href: '/settings/white-label',
    title: 'White label',
    description: 'Resell under your own brand, hide RE-OS, custom login.',
    permission: 'settings.whitelabel.manage',
    hiddenInLaunch: true,
    group: 'Brand',
    accent: 'bg-amber-100 text-amber-800',
  },
  {
    href: '/settings/public-analytics',
    title: 'Public analytics',
    description: 'Website views, clicks, conversions, traffic sources.',
    permission: 'analytics.public.read',
    hiddenInLaunch: true,
    group: 'Growth',
    accent: 'bg-blue-100 text-blue-800',
  },
  {
    href: '/settings/profile',
    title: 'Profile',
    description: 'Your personal account details.',
    permission: 'settings.read',
    group: 'Platform',
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    href: '/audit-logs',
    title: 'Audit logs',
    description: 'Full activity trail with before/after, IP, and CSV export.',
    permission: 'audit.logs.read',
    hiddenInLaunch: true,
    group: 'Trust',
    accent: 'bg-rose-100 text-rose-800',
  },
];

function isLaunchMode(): boolean {
  return process.env.NEXT_PUBLIC_REOS_LAUNCH_MODE !== 'false';
}

export default function SettingsHubPage() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const visible = CARDS.filter((c) => {
    if (c.href === '/settings/profile') return true;
    if (isLaunchMode() && c.hiddenInLaunch) return false;
    return hasPermission(session, c.permission) && isFeatureEnabled(session, c.featureFlag);
  });
  const groups = ['Brand', 'Growth', 'Platform', 'Trust'] as const;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-card">
        <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-6 text-white lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">Launch settings</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
              Manage the essentials needed to launch the agency workspace: profile and alerts.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white">Configuration health</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {visible.length} available settings areas for this role. Keep the first-customer setup focused on publishing inventory and capturing leads.
            </p>
          </div>
        </div>
      </section>

      {groups.map((group) => {
        const cards = visible.filter((card) => card.group === group);
        if (!cards.length) return null;
        return (
          <section key={group} className="space-y-3">
            <div>
              <p className="eyebrow">{group}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">{group} settings</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group block rounded-2xl border border-reos-border bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-raised"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.accent}`}>{card.group}</span>
                    <span className="text-slate-300 transition group-hover:text-teal-700">Open</span>
                  </div>
                  <p className="mt-5 text-lg font-bold text-slate-950">{card.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
