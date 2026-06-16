'use client';

import type { ReactNode } from 'react';

import { getSession, hasPermission, isFeatureEnabled } from '../../lib/auth';

type PermissionGateProps = {
  permission: string;
  featureFlag?: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({ permission, featureFlag, children, fallback = null }: PermissionGateProps) {
  const session = getSession();
  return hasPermission(session, permission) && isFeatureEnabled(session, featureFlag) ? <>{children}</> : <>{fallback}</>;
}
