'use client';

import { useState, type KeyboardEvent } from 'react';

import { Icon } from './icons';

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Suggestions surfaced as quick-add chips below the input. */
  suggestions?: string[];
  id?: string;
};

/**
 * Chip/token input used for free-form lists like amenities and tags. Replaces
 * the legacy comma-separated text fields so values are visible, removable and
 * never silently mis-split.
 */
export function TagInput({ value, onChange, placeholder, suggestions = [], id }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  }

  const remainingSuggestions = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-reos-border bg-white px-2 py-1.5 shadow-sm transition focus-within:border-reos-primary focus-within:ring-4 focus-within:ring-teal-100">
        {value.map((tag) => (
          <span key={tag} className="badge badge-teal">
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-teal-100"
              aria-label={`Remove ${tag}`}
            >
              <Icon name="close" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      </div>
      {remainingSuggestions.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-reos-border px-2.5 py-0.5 text-2xs font-semibold text-slate-500 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
