// Prisma 7 Configuration for WebSocket Server
// This file replaces the url= in schema.prisma
// See: https://pris.ly/d/config-datasource

import 'dotenv/config';
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
