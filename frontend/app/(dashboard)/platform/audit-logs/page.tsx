'use client';

import { Suspense } from 'react';

import { AuditLogsView } from '../../../../components/audit/audit-logs-view';

export default function PlatformAuditLogsPage() {
  return (
    <Suspense fallback={null}>
      <AuditLogsView platformMode />
    </Suspense>
  );
}
