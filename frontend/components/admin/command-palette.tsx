'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Icon, type IconName } from '../ui/icons';
import { hasPermission, isFeatureEnabled, type AuthSession } from '../../lib/auth';
import { visibleNavFor } from './nav-config';

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  run: () => void;
};

/**
 * Global command palette (Cmd/Ctrl + K). Provides fuzzy navigation across
 * every page the user can access plus a few primary "create" actions.
 * Keyboard: ↑/↓ to move, Enter to run, Esc to close.
 */
export function CommandPalette({
  open,
  onClose,
  session,
}: {
  open: boolean;
  onClose: () => void;
  session: AuthSession;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const navCommands: Command[] = visibleNavFor(session).map((item) => ({
      id: `nav:${item.href}`,
      label: item.label,
      icon: item.icon,
      group: 'Navigate',
      run: go(item.href),
    }));

    const actions: Command[] = [];
    if (hasPermission(session, 'properties.create')) {
      actions.push({ id: 'act:new-property', label: 'Add property', hint: 'Create', icon: 'plus', group: 'Actions', run: go('/properties/new') });
    }
    if (hasPermission(session, 'crm.inquiries.create') && isFeatureEnabled(session, 'crm')) {
      actions.push({ id: 'act:new-inquiry', label: 'New inquiry', hint: 'Create', icon: 'plus', group: 'Actions', run: go('/inquiries/new') });
    }
    return [...actions, ...navCommands];
  }, [router, onClose, session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-reos-border bg-white shadow-premium">
        <div className="flex items-center gap-3 border-b border-reos-border px-4">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and actions…"
            className="h-14 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            aria-label="Search commands"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-500">No matches for “{query}”.</p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-2xs font-bold uppercase tracking-[0.16em] text-slate-400">{group}</p>
                {items.map((c) => {
                  runningIndex += 1;
                  const isActive = runningIndex === active;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseEnter={() => setActive(filtered.indexOf(c))}
                      onClick={c.run}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        isActive ? 'bg-teal-50 text-teal-900' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon name={c.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1 font-medium">{c.label}</span>
                      {c.hint ? <span className="text-2xs font-semibold uppercase tracking-wide text-slate-400">{c.hint}</span> : null}
                      {isActive ? <Icon name="chevronRight" className="h-4 w-4 text-teal-500" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-reos-border bg-slate-50 px-4 py-2 text-2xs text-slate-400">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> to navigate</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}
