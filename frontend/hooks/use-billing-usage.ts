'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchUsage, type BillingUsage } from '../lib/billing';
import { isAtCountLimit, resourceAtLimit, type QuotaResource } from '../lib/quota';

export function useBillingUsage() {
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchUsage()
      .then((data) => {
        setUsage(data);
        return data;
      })
      .catch(() => {
        setUsage(null);
        return null;
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const atLimit = useCallback(
    (resource: QuotaResource) => (usage ? resourceAtLimit(usage, resource) : false),
    [usage],
  );

  return {
    usage,
    loading,
    reload,
    propertyAtLimit: usage ? isAtCountLimit(usage.usage.properties, usage.limits.properties) : false,
    employeeAtLimit: usage ? isAtCountLimit(usage.usage.employees, usage.limits.employees) : false,
    atLimit,
  };
}
