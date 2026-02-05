// Prisma 7 Configuration for WebSocket Server (Production Runtime)
// This JavaScript version works without tsx in production
// See: https://pris.ly/d/config-datasource
//
// IMPORTANT: WS uses the SAME schema as Web app (single source of truth)
// In production (Docker), this points to copied files from web app
// Locally, this points to the web app's prisma folder

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // In production Docker: prisma files are copied to /app/prisma
  // This config is used at runtime for prisma migrate deploy
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
