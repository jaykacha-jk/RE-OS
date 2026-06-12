import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const outDir = resolve(process.cwd(), '.keys');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'jwt-private.pem'), privateKey, { mode: 0o600 });
writeFileSync(resolve(outDir, 'jwt-public.pem'), publicKey, { mode: 0o644 });

console.log('JWT keys written to backend/.keys/');
console.log('Add to .env as single-line PEM values or load from files in local dev.');
