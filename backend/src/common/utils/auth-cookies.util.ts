import type { Response } from 'express';

import {
  ACCESS_COOKIE_MAX_AGE_MS,
  AUTH_ACCESS_COOKIE,
  AUTH_REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_MS,
} from '../constants/auth.constants';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function cookieAttributes(maxAgeMs: number): string {
  const parts = [
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    isProduction() ? 'SameSite=Strict' : 'SameSite=Lax',
  ];
  if (isProduction()) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(req: { headers?: { cookie?: string } }, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }
  return undefined;
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.append(
    'Set-Cookie',
    `${AUTH_ACCESS_COOKIE}=${encodeURIComponent(tokens.accessToken)}; ${cookieAttributes(ACCESS_COOKIE_MAX_AGE_MS)}`,
  );
  res.append(
    'Set-Cookie',
    `${AUTH_REFRESH_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; ${cookieAttributes(REFRESH_COOKIE_MAX_AGE_MS)}`,
  );
}

export function clearAuthCookies(res: Response) {
  const expired = 'HttpOnly; Path=/; Max-Age=0';
  res.append('Set-Cookie', `${AUTH_ACCESS_COOKIE}=; ${expired}`);
  res.append('Set-Cookie', `${AUTH_REFRESH_COOKIE}=; ${expired}`);
}

export function readRefreshToken(
  req: { headers?: { cookie?: string } },
  bodyToken?: string,
): string | undefined {
  return bodyToken?.trim() || readCookie(req, AUTH_REFRESH_COOKIE);
}

export function readAccessToken(req: {
  headers?: { authorization?: string; cookie?: string };
}): string | undefined {
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return readCookie(req, AUTH_ACCESS_COOKIE);
}
