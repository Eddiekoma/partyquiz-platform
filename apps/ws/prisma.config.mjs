// Prisma 7 Configuration for WebSocket Server (Production Runtime)
// This JavaScript version works without tsx in production
// See: https://pris.ly/d/config-datasource

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
