// Prisma 7 Configuration for WebSocket Server (Development)
// See: https://pris.ly/d/config-datasource
//
// IMPORTANT: WS uses the SAME schema as Web app (single source of truth)
// This points to the web app's prisma folder for local development

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // For local dev: point to web app's prisma folder
  // For production: Dockerfile copies web's prisma to /app/prisma
  schema: '../web/prisma/schema.prisma',
  migrations: {
    path: '../web/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
