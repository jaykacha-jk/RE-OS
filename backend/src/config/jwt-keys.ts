import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readKeyFile(filename: string): string | undefined {
  const candidates = [
    join(process.cwd(), '.keys', filename),
    join(process.cwd(), 'backend', '.keys', filename),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  return undefined;
}

export function getJwtPrivateKeyPem(): string | undefined {
  return process.env.JWT_PRIVATE_KEY ?? readKeyFile('jwt-private.pem');
}

export function getJwtPublicKeyPem(): string | undefined {
  return process.env.JWT_PUBLIC_KEY ?? readKeyFile('jwt-public.pem');
}
