import { createHmac } from 'crypto';

import { getJwtPrivateKeyPem } from '../../config/jwt-keys';

/** Stable dev-only fallback so visitor tokens survive backend restarts locally. */
const DEV_CHAT_CLIENT_TOKEN_SECRET = 'reos-dev-chat-client-token-secret';

export type VerifiedVisitorToken = {
  tenantId: string;
  conversationId: string;
  clientIdentifier: string;
};

function clientTokenSecret(): string {
  const secret =
    process.env.CHAT_CLIENT_TOKEN_SECRET ||
    process.env.JWT_PRIVATE_KEY ||
    getJwtPrivateKeyPem();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CHAT_CLIENT_TOKEN_SECRET is required in production');
  }
  return DEV_CHAT_CLIENT_TOKEN_SECRET;
}

/** Issue an HMAC-signed access token for an anonymous website visitor. */
export function issueClientToken(
  tenantId: string,
  conversationId: string,
  clientIdentifier: string,
): string {
  const secret = clientTokenSecret();
  const payload = `${tenantId}:${conversationId}:${clientIdentifier}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyClientToken(token: string): VerifiedVisitorToken | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return null;
    const [tenantId, conversationId, clientIdentifier, sig] = parts;
    const secret = clientTokenSecret();
    const expected = createHmac('sha256', secret)
      .update(`${tenantId}:${conversationId}:${clientIdentifier}`)
      .digest('hex');
    if (sig !== expected) return null;
    return { tenantId, conversationId, clientIdentifier };
  } catch {
    return null;
  }
}
