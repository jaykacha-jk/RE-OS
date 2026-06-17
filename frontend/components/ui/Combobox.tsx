'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from './icons';

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  /** Selected option id (when a known option is chosen). */
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  /** Free-text value when the user types something not in the list. */
  freeText?: string;
  onFreeTextChange?: (text: string) => void;
  /** Allow typing a value that isn't in the options list. */
  allowCustom?: boolean;
  placeholder?: string;
  id?: string;
};

/**
 * Pick-or-type combobox. Replaces the legacy "select an option OR fill a
 * separate free-text field" pattern with a single control: choose an existing
 * value, or type a new one when `allowCustom` is set.
 */
export function Combobox({
  value,
  onChange,
  options,
  freeText = '',
  onFreeTextChange,
  allowCustom = false,
  placeholder,
  id,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? freeText;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showCustomRow =
    allowCustom && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  function pick(option: ComboboxOption) {
    onChange(option.value);
    onFreeTextChange?.('');
    setQuery('');
    setOpen(false);
  }

  function pickCustom() {
    onChange('');
    onFreeTextChange?.(query.trim());
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
      >
        <span className={selectedLabel ? 'text-slate-900' : 'text-slate-400'}>
          {selectedLabel || placeholder || 'Select…'}
        </span>
        <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-reos-border bg-white shadow-premium">
          <div className="border-b border-reos-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search or add…"
              className="input py-1.5"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto scrollbar-thin py-1 text-sm">
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => pick(option)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-teal-50"
                >
                  <span className="text-slate-700">{option.label}</span>
                  {option.value === value ? <Icon name="check" className="h-4 w-4 text-teal-600" /> : null}
                </button>
              </li>
            ))}
            {showCustomRow ? (
              <li>
                <button
                  type="button"
                  onClick={pickCustom}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-teal-700 hover:bg-teal-50"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add &ldquo;{query.trim()}&rdquo;
                </button>
              </li>
            ) : null}
            {!filtered.length && !showCustomRow ? (
              <li className="px-3 py-2 text-slate-400">No matches</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
