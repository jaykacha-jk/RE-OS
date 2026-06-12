'use client';

import type { ReactNode } from 'react';

import { getSession, hasPermission } from '../../lib/auth';

type PermissionGateProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  return hasPermission(getSession(), permission) ? <>{children}</> : <>{fallback}</>;
}
