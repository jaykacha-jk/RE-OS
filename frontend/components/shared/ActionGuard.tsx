'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getSession, hasAnyRole, hasPermission, isFeatureEnabled, type AuthSession } from '../../lib/auth';

type ActionGuardProps = {
  permission?: string;
  featureFlag?: string;
  roles?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function ActionGuard({
  permission,
  featureFlag,
  roles,
  children,
  fallback = null,
}: ActionGuardProps) {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const allowed =
    (!permission || hasPermission(session, permission)) &&
    (!featureFlag || isFeatureEnabled(session, featureFlag)) &&
    (!roles || hasAnyRole(session, roles));

  return allowed ? <>{children}</> : <>{fallback}</>;
}
