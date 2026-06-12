import { getJwtPrivateKeyPem, getJwtPublicKeyPem } from '../dist/config/jwt-keys.js';

console.log('cwd:', process.cwd());
console.log('private:', Boolean(getJwtPrivateKeyPem()));
console.log('public:', Boolean(getJwtPublicKeyPem()));
