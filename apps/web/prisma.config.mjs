// Prisma 7 Configuration for Web App (Production Runtime)
// This JavaScript version works without tsx in production
// See: https://pris.ly/d/config-datasource

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
