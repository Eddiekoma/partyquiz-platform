# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive upgrade plan for 2026 stack modernization (`UPGRADE_PLAN_2026.md`)
- Quick summary of upgrade strategy (`UPGRADE_SUMMARY.md`)
- Documentation for all major version updates needed

### Planned
- Next.js 14.1.0 → 16.1.6 upgrade
- React 18.2.0 → 19.2.4 upgrade
- Tailwind CSS 3.4.1 → 4.1.18 upgrade
- Zod 3.22.4 → 4.3.6 upgrade
- ESLint 8.56.0 → 9.39.2 upgrade
- 20+ other major dependency updates

## [1.0.0-pre-upgrade] - 2026-02-XX

### Added
- Web application with Next.js 14 standalone output (✅ ONLINE)
- WebSocket server with Socket.IO (⚠️ In progress)
- Shared package with tsup bundler
- PostgreSQL database with Prisma ORM
- Redis for caching and real-time data
- Docker multi-stage builds for both apps
- pnpm workspace monorepo structure

### Changed
- Web Dockerfile: Uses Next.js standalone output (commit 730ebca)
- WebSocket Dockerfile: Uses pnpm deploy pattern (commit bfd840d)
- Shared package: Split into universal (index) and server-only (server) exports (commit 58111e1)
- Shared package: Added tsup bundler for proper ESM output (commit fcc25f8)

### Fixed
- Web deployment: Resolved symlink issues with Next.js standalone
- Import patterns: Separated server-only exports from client-safe exports
- Module resolution: TypeScript to JavaScript with correct .js extensions

### Known Issues
- WebSocket deployment still failing with module resolution errors
- 21 major dependency updates needed for Web application
- 7 major dependency updates needed for WebSocket application
- Stack is 1-2 years behind current versions

## [0.1.0] - 2026-01-XX

### Added
- Initial project structure
- Basic Next.js setup
- Basic WebSocket server
- Prisma schema for database
- Docker configuration

### Notes
- Development started with Next.js 14.1.0, React 18.2.0, Tailwind CSS 3.4.1
- Versions were from early 2024, now outdated by 1-2 years
