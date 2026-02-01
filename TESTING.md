# Testing Guide - PartyQuiz Platform

This document outlines the testing strategy, setup, and best practices for the PartyQuiz Platform.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Running Tests](#running-tests)
- [E2E Tests](#e2e-tests)
- [Load Testing](#load-testing)
- [CI/CD Integration](#cicd-integration)
- [Coverage Goals](#coverage-goals)
- [Troubleshooting](#troubleshooting)

---

## Testing Strategy

PartyQuiz Platform uses a multi-layered testing approach:

### 1. Unit Tests (Jest + React Testing Library)
- **Location**: `__tests__` folders next to components
- **Purpose**: Test individual components and utilities in isolation
- **Coverage**: 36 unit tests currently exist for core functionality
- **Run**: `pnpm test` (in respective package)

### 2. E2E Tests (Playwright)
- **Location**: `apps/web/tests/e2e/`
- **Purpose**: Test complete user workflows across the application
- **Coverage**: Authentication, workspace management, question creation, live sessions, WebSocket communication
- **Browsers**: Desktop Chrome + Mobile (iPhone 13)
- **Run**: `pnpm test:e2e`

### 3. Load Tests (Artillery)
- **Location**: `tests/load/` (to be created)
- **Purpose**: Validate performance with 30+ concurrent players
- **Metrics**: WebSocket latency, answer submission time, server resources
- **Run**: `artillery run tests/load/session-load.yml`

---

## Running Tests

### E2E Tests (Playwright)

#### Prerequisites
1. Ensure database is seeded with demo data:
   ```bash
   pnpm prisma db seed
   ```

2. Start development server:
   ```bash
   pnpm dev
   ```

#### Running Tests

**Run all E2E tests:**
```bash
pnpm test:e2e
```

**Run in UI mode (interactive):**
```bash
pnpm test:e2e:ui
```

**Run in headed mode (see browser):**
```bash
pnpm test:e2e:headed
```

**Run specific test file:**
```bash
pnpm test:e2e tests/e2e/auth.spec.ts
```

**Debug tests:**
```bash
pnpm test:e2e:debug
```

**View HTML report:**
```bash
pnpm test:e2e:report
```

#### Environment Variables

Set `PLAYWRIGHT_BASE_URL` to test against different environments:

```bash
# Test against staging
PLAYWRIGHT_BASE_URL=https://staging.partyquiz.com pnpm test:e2e

# Test against production (careful!)
PLAYWRIGHT_BASE_URL=https://partyquiz-platform.databridge360.com pnpm test:e2e
```

---

## E2E Tests

### Test Structure

```
tests/e2e/
├── user-journey.spec.ts    # Complete user workflow
├── auth.spec.ts            # Authentication flows
├── live-session.spec.ts    # WebSocket and real-time features
├── questions.spec.ts       # Question creation (to be added)
└── quiz-builder.spec.ts    # Quiz building (to be added)
```

### Key Test Scenarios

#### 1. User Journey (`user-journey.spec.ts`)
- **Scenario**: Complete flow from signup to quiz completion
- **Steps**:
  1. Sign up with magic link
  2. Create workspace
  3. Create questions (MC, photo, Spotify, YouTube)
  4. Build quiz with rounds
  5. Start live session
  6. Join as player (separate context)
  7. Answer questions in real-time
  8. View final results

#### 2. Authentication (`auth.spec.ts`)
- **Scenarios**:
  - Signup with magic link
  - Login with existing user
  - Session persistence after reload
  - Logout clears session
  - Protected routes redirect unauthenticated users
  - Invalid magic link shows error

#### 3. Live Session (`live-session.spec.ts`)
- **Scenarios**:
  - Host creates and starts session
  - Player joins with code
  - Real-time player list updates
  - Host pauses/resumes session
  - Player submits answers
  - WebSocket connection resilience
  - Simultaneous player connections (5+ players)
  - Session state transitions (LOBBY → IN_PROGRESS → COMPLETED)

### Writing New E2E Tests

#### Basic Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Navigate
    await page.goto('/some-page');
    
    // Interact
    await page.click('button:has-text("Click Me")');
    await page.fill('input[name="field"]', 'value');
    
    // Assert
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

#### Testing WebSocket Events

```typescript
test('WebSocket event handling', async ({ page }) => {
  // Listen for WebSocket connections
  const wsPromise = page.waitForEvent('websocket');
  
  await page.goto('/play');
  await page.fill('input[name="code"]', 'DEMO123');
  await page.click('button:has-text("Join")');
  
  // Verify WebSocket connected
  const ws = await wsPromise;
  expect(ws.url()).toContain('ws://');
  
  // Listen for messages
  ws.on('framereceived', frame => {
    console.log('Received:', frame.payload);
  });
});
```

#### Testing Multi-User Scenarios

```typescript
test('host and player interaction', async ({ page, context }) => {
  // Host
  await page.goto('/dashboard');
  await page.click('text=Start Session');
  const sessionCode = await page.locator('[data-testid="session-code"]').textContent();
  
  // Player (new context)
  const playerPage = await context.newPage();
  await playerPage.goto('/play');
  await playerPage.fill('input[name="code"]', sessionCode);
  await playerPage.click('button:has-text("Join")');
  
  // Verify host sees player
  await expect(page.locator('text=Player Name')).toBeVisible();
  
  // Clean up
  await playerPage.close();
});
```

---

## Load Testing

### Prerequisites

Install Artillery:
```bash
npm install -g artillery@latest
```

### Running Load Tests

**Basic load test:**
```bash
artillery run tests/load/session-load.yml
```

**Quick test (reduced duration):**
```bash
artillery quick --count 10 --num 20 https://partyquiz-platform.databridge360.com
```

**Custom scenario:**
```bash
artillery run tests/load/session-load.yml --target https://staging.partyquiz.com
```

### Load Test Configuration (Example)

Create `tests/load/session-load.yml`:

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5  # 5 users per second
      name: Warm up
    - duration: 120
      arrivalRate: 15  # 15 users per second (peak load)
      name: Sustained load
  processor: "./load-processor.js"
  socketio:
    transports: ["websocket"]

scenarios:
  - name: "Join session and play"
    engine: socketio
    flow:
      - emit:
          channel: "join_session"
          data:
            sessionCode: "LOAD123"
            playerName: "Player {{ $randomString() }}"
      - think: 2  # Wait 2 seconds
      - emit:
          channel: "submit_answer"
          data:
            questionId: "{{ questionId }}"
            answer: "A"
      - think: 3
      - emit:
          channel: "leave_session"
```

### Metrics to Monitor

- **Response Time**: p50, p95, p99 percentiles (target: <200ms for answers)
- **WebSocket Connections**: Concurrent connections (target: 30+)
- **Error Rate**: Failed connections, timeouts (target: <1%)
- **Server Resources**: CPU, memory, database connections
- **Database Query Time**: Prisma query performance

### Expected Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| WebSocket Connection Time | <500ms | 1s |
| Answer Submission Latency | <100ms | 200ms |
| Concurrent Players | 30+ | 100+ |
| Questions Per Session | 20-30 | 50 |
| Session Duration | 10-30 min | 60 min |

---

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: partyquiz_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Setup database
        run: |
          pnpm prisma migrate deploy
          pnpm prisma db seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/partyquiz_test
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/partyquiz_test
          REDIS_URL: redis://localhost:6379
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: test-secret-key-for-ci
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Coverage Goals

### Current Status

| Test Type | Current | Target |
|-----------|---------|--------|
| Unit Tests | 36 tests | 100+ tests |
| E2E Tests | 3 specs | 5+ specs |
| Code Coverage | Unknown | 80% |
| Load Tests | 0 | 2 scenarios |

### Priority Test Coverage

**Must Have (P0):**
- ✅ Authentication (signup, login, logout)
- ✅ Live session (join, play, WebSocket)
- ✅ User journey (complete workflow)
- ⏸️ Question creation (all types)
- ⏸️ Quiz builder (create, edit, reorder)

**Should Have (P1):**
- ⏸️ Workspace management (create, invite, roles)
- ⏸️ Media uploads (S3 integration)
- ⏸️ Spotify integration (search, preview)
- ⏸️ YouTube integration (embed, playback)
- ⏸️ Swan Race mini-game

**Nice to Have (P2):**
- ⏸️ Accessibility (keyboard navigation, screen readers)
- ⏸️ Error handling (network failures, invalid data)
- ⏸️ Performance (page load times, bundle size)
- ⏸️ Cross-browser (Firefox, Safari)

---

## Troubleshooting

### Common Issues

#### 1. Tests Fail with "Element not visible"

**Cause**: Element takes time to render, or page hasn't loaded.

**Solution**: Increase timeout or wait for element:
```typescript
await expect(page.locator('text=Something')).toBeVisible({ timeout: 10000 });
```

#### 2. WebSocket Connection Fails

**Cause**: WebSocket server not running, or incorrect URL.

**Solution**:
- Verify WebSocket server is running: `curl http://localhost:8080/ws/healthz`
- Check `playwright.config.ts` for correct `baseURL`
- Review WebSocket URL in code (should be `ws://localhost:8080` locally)

#### 3. Database State Conflicts

**Cause**: Tests running in parallel modify the same data.

**Solution**:
- Use sequential execution: `fullyParallel: false` in `playwright.config.ts`
- Use unique test data: `test-user-${Date.now()}@example.com`
- Reset database between test runs: `pnpm prisma migrate reset`

#### 4. Tests Pass Locally but Fail in CI

**Cause**: Environment differences (URLs, secrets, timing).

**Solution**:
- Set environment variables in CI (GitHub Actions secrets)
- Increase timeouts for slower CI environment
- Check database and Redis are available in CI
- Review CI logs for specific errors

#### 5. Playwright Browser Not Found

**Cause**: Playwright browsers not installed.

**Solution**:
```bash
npx playwright install chromium
```

Or install all browsers:
```bash
npx playwright install
```

#### 6. Session Code Not Found in Tests

**Cause**: Element selector changed, or session creation failed.

**Solution**:
- Verify demo data exists: `pnpm prisma db seed`
- Check element selector: `[data-testid="session-code"]`
- Add debug screenshot: `await page.screenshot({ path: 'debug.png' });`

---

## Best Practices

### 1. Use Data Test IDs

Always add `data-testid` attributes to key elements:

```tsx
<button data-testid="start-session-btn">Start Session</button>
<div data-testid="session-code">{sessionCode}</div>
```

Then select in tests:
```typescript
await page.click('[data-testid="start-session-btn"]');
const code = await page.locator('[data-testid="session-code"]').textContent();
```

### 2. Isolate Test Data

Use unique test data to avoid conflicts:

```typescript
const uniqueEmail = `test-${Date.now()}@example.com`;
const uniqueName = `Test User ${Date.now()}`;
```

### 3. Clean Up Resources

Always close pages/contexts created during tests:

```typescript
const playerPage = await context.newPage();
// ... test code ...
await playerPage.close();
```

### 4. Use Step Annotations

Group test actions with `test.step`:

```typescript
await test.step('Create workspace', async () => {
  await page.click('text=New Workspace');
  // ... actions ...
});
```

### 5. Handle Timeouts Gracefully

Set appropriate timeouts based on action:

```typescript
// Quick check (2s)
await expect(page.locator('text=Success')).toBeVisible({ timeout: 2000 });

// Network request (10s)
await expect(page.locator('text=Data Loaded')).toBeVisible({ timeout: 10000 });

// Complex operation (30s)
await expect(page.locator('text=Processing Complete')).toBeVisible({ timeout: 30000 });
```

---

## Next Steps

1. **Complete E2E Test Coverage**:
   - Add `questions.spec.ts` (all question types)
   - Add `quiz-builder.spec.ts` (drag-drop, reorder)
   - Add `workspace.spec.ts` (members, invites, roles)

2. **Implement Load Testing**:
   - Create `tests/load/session-load.yml`
   - Test with 30+ concurrent players
   - Monitor and optimize performance bottlenecks

3. **Add Visual Regression Tests** (optional):
   - Use Playwright's screenshot comparison
   - Create baseline images for key pages
   - Detect unintended UI changes

4. **Improve Unit Test Coverage**:
   - Test utility functions (scoring, validation)
   - Test React hooks (useSession, useQuestion)
   - Test API route handlers

---

## Resources

- **Playwright Documentation**: https://playwright.dev/docs/intro
- **Artillery Documentation**: https://www.artillery.io/docs
- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **React Testing Library**: https://testing-library.com/docs/react-testing-library/intro

---

**Last Updated**: 2025-01-XX  
**Status**: E2E tests implemented, load testing pending
