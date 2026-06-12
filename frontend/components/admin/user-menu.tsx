'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/icons';
import { isSuperAdmin, type AuthSession } from '../../lib/auth';

export function UserMenu({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const superAdmin = isSuperAdmin(session);
  const initials = (session.user.first_name?.slice(0, 2) ?? session.user.email.slice(0, 2)).toUpperCase();
  const roleLabel = superAdmin ? 'Platform Admin' : session.user.roles[0]?.replace(/_/g, ' ') ?? 'Workspace user';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-xl border border-reos-border bg-white py-1 pl-1 pr-2 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50 focus:outline-none focus:ring-4 focus:ring-teal-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-xs font-bold uppercase text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[10rem] truncate text-xs font-semibold text-slate-800">{session.user.email}</span>
          <span className="block truncate text-2xs capitalize text-slate-400">{roleLabel}</span>
        </span>
        <Icon name="chevronDown" className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 animate-scale-in overflow-hidden rounded-2xl border border-reos-border bg-white shadow-dropdown"
        >
          <div className="border-b border-reos-border bg-slate-50 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{session.user.email}</p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">{roleLabel}</p>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" href="/settings/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <Icon name="profile" className="h-4 w-4 text-slate-400" /> Profile
            </Link>
            <Link role="menuitem" href="/settings/notifications" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <Icon name="notifications" className="h-4 w-4 text-slate-400" /> Alert settings
            </Link>
            {!superAdmin ? (
              <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <Icon name="settings" className="h-4 w-4 text-slate-400" /> Workspace settings
              </Link>
            ) : null}
          </div>
          <div className="border-t border-reos-border p-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <Icon name="logout" className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
