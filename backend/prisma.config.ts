import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    // Required by Prisma CLI (Prisma 7+); actual connection is not needed for `prisma generate`.
    url: env('DATABASE_URL'),
  },
});

