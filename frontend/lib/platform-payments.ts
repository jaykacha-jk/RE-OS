import { apiFetch } from './api';
import { getSession } from './auth';

export type RazorpayPlatformConfigMasked = {
  provider: 'razorpay';
  environment: 'test' | 'live';
  active: boolean;
  key_id_masked: string | null;
  key_secret_configured: boolean;
  webhook_secret_configured: boolean;
  source: 'database' | 'environment' | 'none';
  version: number | null;
  updated_at: string | null;
};

export type UpdateRazorpayPlatformConfigInput = {
  key_id?: string;
  key_secret?: string;
  webhook_secret?: string;
  environment: 'test' | 'live';
  active: boolean;
};

export async function fetchRazorpayPlatformConfig() {
  const session = getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return (
    await apiFetch<RazorpayPlatformConfigMasked>('/api/v1/platform/payment-providers/razorpay', {
      token: session.access_token,
    })
  ).data;
}

export async function updateRazorpayPlatformConfig(input: UpdateRazorpayPlatformConfigInput) {
  const session = getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return (
    await apiFetch<RazorpayPlatformConfigMasked>('/api/v1/platform/payment-providers/razorpay', {
      method: 'PUT',
      token: session.access_token,
      body: JSON.stringify(input),
    })
  ).data;
}
