export const PLATFORM_SETTINGS_KEYS = {
  RAZORPAY: 'payment.razorpay',
} as const;

export type RazorpayEnvironment = 'test' | 'live';

export type RazorpayPlatformConfig = {
  key_id: string;
  key_secret: string;
  webhook_secret: string;
  environment: RazorpayEnvironment;
  active: boolean;
};

export type RazorpayPlatformConfigMasked = {
  provider: 'razorpay';
  environment: RazorpayEnvironment;
  active: boolean;
  key_id_masked: string | null;
  key_secret_configured: boolean;
  webhook_secret_configured: boolean;
  source: 'database' | 'environment' | 'none';
  version: number | null;
  updated_at: string | null;
};

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  environment: RazorpayEnvironment;
  source: 'database' | 'environment';
};
