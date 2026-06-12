import { apiFetch } from './api';
import { getSession } from './auth';
import type { LeadSource } from './crm';

export type EmployeeOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_code: string | null;
};

export type PropertyOption = {
  id: string;
  property_code: string;
  title: string;
};

export function employeeLabel(e: EmployeeOption): string {
  return [e.first_name, e.last_name].filter(Boolean).join(' ') || e.email;
}

export async function fetchEmployees(): Promise<EmployeeOption[]> {
  const session = getSession();
  if (!session?.access_token) return [];
  const res = await apiFetch<EmployeeOption[]>('/api/v1/employees?per_page=100', {
    token: session.access_token,
  });
  return res.data;
}

export async function fetchProperties(): Promise<PropertyOption[]> {
  const session = getSession();
  if (!session?.access_token) return [];
  const res = await apiFetch<PropertyOption[]>('/api/v1/properties?per_page=100', {
    token: session.access_token,
  });
  return res.data.map((p) => ({ id: p.id, property_code: p.property_code, title: p.title }));
}

export async function fetchLeadSources(): Promise<LeadSource[]> {
  const session = getSession();
  if (!session?.access_token) return [];
  const res = await apiFetch<LeadSource[]>('/api/v1/lead-sources', {
    token: session.access_token,
  });
  return res.data;
}
