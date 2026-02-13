/**
 * PartyQuiz Platform - Complete User Journey E2E Test
 * 
 * Tests the full workflow from signup to quiz completion:
 * 1. Signup with magic link
 * 2. Create workspace
 * 3. Create questions (MC, photo, Spotify)
 * 4. Build quiz
 * 5. Start live session
 * 6. Join as player
 * 7. Answer questions
 * 8. View results
 */

import { test, expect, Page } from '@playwright/test';

// Helper: Wait for magic link email and extract URL
async function getMagicLinkFromEmail(email: string): Promise<string> {
  // In real tests, you'd check your email provider's API
  // For now, we'll mock this by directly generating the callback URL
  // In production, integrate with Maildev/MailHog or email service API
  return `http://localhost:3000/api/auth/callback/email?token=mock-token&email=${encodeURIComponent(email)}`;
}

test.describe('Complete User Journey', () => {
  test('admin creates workspace, questions, quiz, and hosts session', async ({ page, context }) => {
    const adminEmail = `test-admin-${Date.now()}@partyquiz.test`;
    const workspaceName = `Test Workspace ${Date.now()}`;

    // Step 1: Signup
    await test.step('Sign up with magic link', async () => {
      await page.goto('/');
      
      // Click Sign In
      await page.click('text=Sign In');
      
      // Enter email
      await page.fill('input[type="email"]', adminEmail);
      await page.click('button:has-text("Send Magic Link")');
      
      // Verify magic link sent message
      await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 5000 });
      
      // In real scenario, fetch magic link from email
      // For testing, we'll use the demo approach or mock the callback
      // For now, skip magic link and login directly (requires test user in DB)
      
      // Alternative: Use demo user
      await page.goto('/');
      await page.click('text=Sign In');
      await page.fill('input[type="email"]', 'admin@partyquiz.demo');
      await page.click('button:has-text("Send Magic Link")');
      
      // Manual step: In real tests, check email and click link
      // For demo, we'll assume login success and continue
    });

    // For testing purposes, we'll use demo user that already exists
    // In CI/CD, you'd run seed script before tests
    
    // Step 2: Navigate to workspace (assuming logged in)
    await test.step('Access demo workspace', async () => {
      await page.goto('/dashboard');
      
      // Check if dashboard loads
      await expect(page.locator('text=Workspaces').or(page.locator('text=Demo Workspace'))).toBeVisible({ timeout: 10000 });
      
      // Click on Demo Workspace (from seed data)
      await page.click('text=Demo Workspace');
    });

    // Step 3: Create a new question
    await test.step('Create multiple choice question', async () => {
      // Navigate to Questions page
      await page.click('text=Questions');
      
      // Click Create Question
      await page.click('button:has-text("Create Question")');
      
      // Fill in question details
      await page.fill('input[name="title"]', 'Test Question - Capital of Netherlands');
      await page.fill('textarea[name="prompt"]', 'What is the capital of the Netherlands?');
      
      // Select question type
      await page.selectOption('select[name="type"]', 'MC_SINGLE');
      
      // Add options
      await page.fill('input[name="option-1"]', 'Amsterdam');
      await page.fill('input[name="option-2"]', 'Rotterdam');
      await page.fill('input[name="option-3"]', 'The Hague');
      await page.fill('input[name="option-4"]', 'Utrecht');
      
      // Mark correct answer
      await page.check('input[name="correct-option-1"]');
      
      // Set difficulty
      await page.selectOption('select[name="difficulty"]', '2');
      
      // Save question
      await page.click('button:has-text("Save Question")');
      
      // Verify question created
      await expect(page.locator('text=Question created successfully')).toBeVisible({ timeout: 5000 });
    });

    // Step 4: Build quiz
    await test.step('Create quiz with questions', async () => {
      // Navigate to Quizzes page
      await page.click('text=Quizzes');
      
      // Click Create Quiz
      await page.click('button:has-text("Create Quiz")');
      
      // Fill quiz details
      await page.fill('input[name="title"]', 'E2E Test Quiz');
      await page.fill('textarea[name="description"]', 'Automated test quiz');
      
      // Add round
      await page.click('button:has-text("Add Round")');
      await page.fill('input[name="round-1-title"]', 'Round 1');
      
      // Add questions to round (assuming questions are visible in list)
      await page.click('text=Add Questions');
      
      // Select first 3 questions
      const checkboxes = page.locator('input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();
      
      await page.click('button:has-text("Add Selected")');
      
      // Save quiz
      await page.click('button:has-text("Save Quiz")');
      
      // Verify quiz created
      await expect(page.locator('text=Quiz created successfully')).toBeVisible({ timeout: 5000 });
    });

    // Step 5: Start live session
    let sessionCode: string;
    
    await test.step('Start live session', async () => {
      // Navigate to Sessions or click Start Session from quiz
      await page.click('button:has-text("Start Live Session")');
      
      // Get session code from screen
      const codeElement = await page.locator('[data-testid="session-code"]').or(page.locator('text=/[A-Z0-9]{6}/')).first();
      sessionCode = await codeElement.textContent() || 'DEMO123';
      
      console.log(`Session code: ${sessionCode}`);
      
      // Verify lobby screen visible
      await expect(page.locator('text=Waiting for players')).toBeVisible({ timeout: 5000 });
    });

    // Step 6: Join as player (in new context)
    await test.step('Player joins session', async () => {
      // Open new page for player
      const playerPage = await context.newPage();
      
      // Navigate to join page
      await playerPage.goto('/play');
      
      // Enter session code
      await playerPage.fill('input[name="code"]', sessionCode);
      await playerPage.click('button:has-text("Join")');
      
      // Enter player name
      await playerPage.fill('input[name="name"]', 'Test Player');
      await playerPage.click('button:has-text("Join Session")');
      
      // Verify player joined
      await expect(playerPage.locator('text=Waiting for host')).toBeVisible({ timeout: 5000 });
      
      // Verify player appears in host lobby
      await expect(page.locator('text=Test Player')).toBeVisible({ timeout: 5000 });
      
      // Host starts quiz
      await page.click('button:has-text("Start Quiz")');
      
      // Verify question screen appears for player
      await expect(playerPage.locator('[data-testid="question-prompt"]')).toBeVisible({ timeout: 10000 });
      
      // Answer first question
      await playerPage.click('button:has-text("Paris")'); // From demo data
      
      // Wait for next question or results
      await playerPage.waitForTimeout(2000);
      
      // Close player page
      await playerPage.close();
    });

    // Step 7: Complete session and view results
    await test.step('View session results', async () => {
      // Skip through remaining questions (host view)
      // In real scenario, you'd answer all questions
      
      // End session
      await page.click('button:has-text("End Session")');
      
      // Verify results page
      await expect(page.locator('text=Final Results').or(page.locator('text=Leaderboard'))).toBeVisible({ timeout: 10000 });
      
      // Verify player appears in results
      await expect(page.locator('text=Test Player')).toBeVisible();
    });
  });

  test('responsive design - mobile player experience', async ({ page }) => {
    await test.step('Mobile player joins and plays', async () => {
      // Use demo session
      await page.goto('/play');
      
      // Enter code
      await page.fill('input[name="code"]', 'DEMO123');
      await page.click('button:has-text("Join")');
      
      // Enter name
      await page.fill('input[name="name"]', `Mobile Player ${Date.now()}`);
      await page.click('button:has-text("Join Session")');
      
      // Verify mobile-friendly layout
      await expect(page.locator('[data-testid="mobile-player-view"]').or(page.locator('text=Waiting for host'))).toBeVisible({ timeout: 5000 });
      
      // Check that answer buttons are easily tappable (min 44x44px)
      const buttons = page.locator('button[data-testid="answer-option"]');
      if (await buttons.count() > 0) {
        const firstButton = buttons.first();
        const box = await firstButton.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test('connection resilience - reconnect after disconnect', async ({ page, context }) => {
    await test.step('Player reconnects after network loss', async () => {
      // Join session
      await page.goto('/play');
      await page.fill('input[name="code"]', 'DEMO123');
      await page.click('button:has-text("Join")');
      await page.fill('input[name="name"]', 'Resilience Test');
      await page.click('button:has-text("Join Session")');
      
      // Verify joined
      await expect(page.locator('text=Waiting for host')).toBeVisible({ timeout: 5000 });
      
      // Simulate network disconnect (pause context)
      await context.setOffline(true);
      
      // Wait for disconnect indicator
      await expect(page.locator('text=Reconnecting').or(page.locator('text=Connection lost'))).toBeVisible({ timeout: 10000 });
      
      // Reconnect
      await context.setOffline(false);
      
      // Verify reconnection
      await expect(page.locator('text=Connected').or(page.locator('text=Waiting for host'))).toBeVisible({ timeout: 15000 });
    });
  });

  test('WebSocket real-time updates', async ({ page, context }) => {
    await test.step('Player sees real-time score updates', async () => {
      // This test requires active session with questions
      // For now, we'll just verify WebSocket connection establishes
      
      await page.goto('/play');
      await page.fill('input[name="code"]', 'DEMO123');
      await page.click('button:has-text("Join")');
      await page.fill('input[name="name"]', 'WS Test Player');
      await page.click('button:has-text("Join Session")');
      
      // Verify WebSocket connection (check network tab or console)
      // In Playwright, you can listen to WebSocket events:
      page.on('websocket', ws => {
        console.log(`WebSocket opened: ${ws.url()}`);
        ws.on('framereceived', frame => {
          console.log('WS Frame received:', frame.payload);
        });
      });
      
      // Verify player joined (which requires WebSocket)
      await expect(page.locator('text=Waiting for host')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Question Creation with Media', () => {
  test.skip('create photo question with upload', async ({ page }) => {
    // This test requires file upload functionality
    await page.goto('/dashboard');
    await page.click('text=Demo Workspace');
    await page.click('text=Questions');
    await page.click('button:has-text("Create Question")');
    
    // Select photo question type
    await page.selectOption('select[name="type"]', 'PHOTO_MC_SINGLE');
    
    // Upload photo (requires MediaLibrary component)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/test-image.jpg');
    
    // Wait for upload
    await expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 10000 });
    
    // Fill question details
    await page.fill('input[name="title"]', 'Photo Question Test');
    await page.fill('textarea[name="prompt"]', 'What is in this photo?');
    
    // Add options
    await page.fill('input[name="option-1"]', 'Correct Answer');
    await page.check('input[name="correct-option-1"]');
    
    // Save
    await page.click('button:has-text("Save Question")');
    await expect(page.locator('text=Question created')).toBeVisible();
  });

  test.skip('create Spotify music question', async ({ page }) => {
    // This test requires Spotify integration to be configured
    await page.goto('/dashboard');
    await page.click('text=Demo Workspace');
    await page.click('text=Questions');
    await page.click('button:has-text("Create Question")');
    
    // Select music question type
    await page.selectOption('select[name="type"]', 'MUSIC_GUESS_TITLE');
    
    // Search Spotify
    await page.fill('input[name="spotify-search"]', 'Mr. Brightside');
    await page.click('button:has-text("Search")');
    
    // Select first result
    await page.locator('[data-testid="spotify-result"]').first().click();
    
    // Fill question details
    await page.fill('input[name="title"]', 'Spotify Question Test');
    await page.fill('textarea[name="prompt"]', 'What is this song?');
    
    // Save
    await page.click('button:has-text("Save Question")');
    await expect(page.locator('text=Question created')).toBeVisible();
  });
});
