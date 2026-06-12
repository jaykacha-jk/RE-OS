import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createPrismaClient } from '../dist/common/database/create-prisma-client.js';

const prisma = createPrismaClient();
const user = await prisma.users.findFirst({
  where: { email: 'super@reos.dev', tenant_id: null },
});
console.log('user found:', Boolean(user));
if (user?.password_hash) {
  console.log('password ok:', await bcrypt.compare('ChangeMe123!', user.password_hash));
}
await prisma.$disconnect();
