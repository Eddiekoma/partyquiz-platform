# 🗄️ Database Migrations Guide

## Overview

PartyQuiz Platform uses **Prisma 7** for database management. This guide covers the migration workflow for development and production.

## Architecture

```
apps/web/prisma/           # Primary schema location (Next.js app)
├── schema.prisma          # Database schema definition
├── prisma.config.ts       # Prisma CLI config (development)
├── prisma.config.mjs      # Prisma CLI config (production runtime)
├── migrations/            # Migration history
│   └── 0_init/           # Initial schema migration
│       └── migration.sql
└── seed.ts               # Database seed script

apps/ws/prisma/            # WebSocket server (shared schema)
├── schema.prisma          # Copy of web schema
├── prisma.config.ts
├── prisma.config.mjs
└── migrations/            # Copy of web migrations
```

> **Important**: Web and WS apps share the same database. Keep migrations in sync!

## Development Workflow

### 1. Making Schema Changes

Edit `apps/web/prisma/schema.prisma`:

```prisma
model NewFeature {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  
  @@index([name])
}
```

### 2. Generate Migration

```bash
cd apps/web

# Create a new migration
pnpm exec prisma migrate dev --name add_new_feature

# This will:
# 1. Generate SQL migration file
# 2. Apply to local database
# 3. Regenerate Prisma Client
```

### 3. Sync to WS App

```bash
# Copy migrations to WS app
cp -r apps/web/prisma/migrations/* apps/ws/prisma/migrations/

# Update WS schema if needed
cp apps/web/prisma/schema.prisma apps/ws/prisma/schema.prisma
```

### 4. Commit & Deploy

```bash
git add -A
git commit -m "feat: Add new feature table"
git push
```

Coolify will automatically:
1. Build the Docker images
2. Run `prisma migrate deploy` on container startup
3. Apply pending migrations to production

## Production Deployment

### How It Works

The WS container (`Dockerfile.ws`) runs migrations at startup:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

This is safe because:
- `migrate deploy` only applies **pending** migrations
- Already-applied migrations are skipped
- Failed migrations block startup (fail-fast)

### Manual Migration (Emergency)

If you need to run migrations manually:

```bash
# SSH to Hetzner
ssh Hetzner

# Run migration via Docker
docker run --rm \
  --network coolify \
  -v /tmp/migration:/workspace \
  -w /workspace \
  -e DATABASE_URL="postgres://postgres:PASSWORD@r00oss4cggks40c48c0kg8o8:5432/postgres" \
  node:20-alpine sh -c "
    npm install prisma@7.3.0 --silent
    npx prisma migrate deploy
  "
```

### Fixing Failed Migrations

If a migration fails in production:

```bash
# Option 1: Roll back and retry
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Option 2: Mark as applied (if changes exist in DB)
npx prisma migrate resolve --applied MIGRATION_NAME

# Option 3: Check migration status
ssh Hetzner "docker exec r00oss4cggks40c48c0kg8o8 psql -U postgres -d postgres -c 'SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;'"
```

## Common Scenarios

### Adding a New Table

```bash
# 1. Edit schema.prisma
# 2. Generate migration
cd apps/web && pnpm exec prisma migrate dev --name add_table_name

# 3. Sync to WS
cp -r apps/web/prisma/migrations/* apps/ws/prisma/migrations/

# 4. Deploy
git add -A && git commit -m "feat: Add table" && git push
```

### Adding a Column

```bash
# 1. Edit schema.prisma
# 2. Generate migration
cd apps/web && pnpm exec prisma migrate dev --name add_column_to_table

# 3. Sync & Deploy
```

### Renaming a Column (Careful!)

Prisma will generate DROP + CREATE by default. For zero-downtime:

1. Create migration manually:
```sql
ALTER TABLE "TableName" RENAME COLUMN "oldName" TO "newName";
```

2. Place in `prisma/migrations/YYYYMMDDHHMMSS_rename_column/migration.sql`

3. Update schema.prisma to match

4. Run `prisma migrate deploy`

### Data Migrations

For data migrations (not just schema):

1. Create a migration as usual
2. Add custom SQL in the migration file
3. Or create a separate seed/migration script

## Prisma 7 Specifics

### Configuration Files

Prisma 7 uses `prisma.config.ts` (or `.mjs`) instead of `url` in schema:

```typescript
// prisma.config.ts (development - needs tsx)
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

```javascript
// prisma.config.mjs (production - no tsx needed)
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

### Schema Datasource

```prisma
datasource db {
  provider = "postgresql"
  // NO url here! It's in prisma.config.ts
}
```

## Troubleshooting

### "Migration failed" error

```bash
# Check what failed
ssh Hetzner "docker exec r00oss4cggks40c48c0kg8o8 psql -U postgres -d postgres -c \"SELECT migration_name, logs FROM _prisma_migrations WHERE finished_at IS NULL;\""

# Fix and retry
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

### "Table already exists"

Database is ahead of migrations. Baseline it:

```bash
npx prisma migrate resolve --applied MIGRATION_NAME
```

### "Column does not exist"

Migration was partially applied. Check the database state and either:
- Complete the migration manually
- Roll back and regenerate

### Schema drift

```bash
# Check for drift
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma

# Reset if development only (DESTROYS DATA)
pnpm exec prisma migrate reset
```

## Best Practices

1. **Always test locally first** - Run migrations on dev before pushing
2. **Small, focused migrations** - One feature per migration
3. **Never edit applied migrations** - Create new ones instead
4. **Keep web/ws in sync** - Copy migrations after generating
5. **Backup before major changes** - Use `pg_dump` for safety
6. **Use transactions** - Prisma wraps migrations in transactions by default

## Database Credentials

Stored in Coolify environment variables:

- **Host**: `r00oss4cggks40c48c0kg8o8` (internal Docker network)
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: See Coolify dashboard

For local development with SSH tunnel:
```bash
./scripts/setup-ssh-tunnel.sh
# Then use localhost:5432
```
