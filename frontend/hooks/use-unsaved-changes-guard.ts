'use client';

import { useEffect } from 'react';

/**
 * Warns the user before they lose unsaved form edits. Wires a `beforeunload`
 * prompt (tab close / reload) whenever `dirty` is true. Route-level interception
 * is handled by the form shells that call this.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
