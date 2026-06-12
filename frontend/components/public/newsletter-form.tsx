'use client';

import { useState } from 'react';

/**
 * Lightweight email capture. There is no newsletter ESP wired yet, so this
 * confirms locally and is ready to POST to a subscription endpoint later.
 */
export function NewsletterForm() {
  const [done, setDone] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
      className="mt-4 flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <label className="flex-1">
        <span className="sr-only">Email address</span>
        <input
          type="email"
          required
          placeholder="you@example.com"
          disabled={done}
          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-60"
        />
      </label>
      <button
        type="submit"
        disabled={done}
        className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-teal-600"
      >
        {done ? 'Subscribed' : 'Subscribe'}
      </button>
    </form>
  );
}
