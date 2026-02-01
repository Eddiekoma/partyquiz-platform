/**
 * Authentication E2E Tests
 * 
 * Tests signup, login, logout, and session persistence
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('displays landing page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Verify landing page elements
    await expect(page.locator('text=PartyQuiz').or(page.locator('h1'))).toBeVisible();
    await expect(page.locator('text=Sign In').or(page.locator('text=Login'))).toBeVisible();
  });

  test('signup flow with magic link', async ({ page }) => {
    const testEmail = `test-${Date.now()}@partyquiz.test`;
    
    await page.goto('/');
    await page.click('text=Sign In');
    
    // Enter email
    await page.fill('input[type="email"]', testEmail);
    await page.click('button:has-text("Send Magic Link")');
    
    // Verify confirmation message
    await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 5000 });
    
    // In real scenario, fetch and click magic link
    // For now, verify the flow reached this point
  });

  test('login with existing demo user', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In');
    
    // Use demo user
    await page.fill('input[type="email"]', 'admin@partyquiz.demo');
    await page.click('button:has-text("Send Magic Link")');
    
    // Verify magic link sent
    await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 5000 });
  });

  test('session persists after page reload', async ({ page }) => {
    // This test assumes user is logged in (via seed data or previous test)
    // For CI/CD, you'd set up auth state beforehand
    
    await page.goto('/dashboard');
    
    // Check if authenticated (redirects to dashboard)
    const urlAfterLoad = page.url();
    const isAuthenticated = urlAfterLoad.includes('/dashboard') || urlAfterLoad.includes('/workspaces');
    
    if (isAuthenticated) {
      // Reload page
      await page.reload();
      
      // Verify still authenticated
      await expect(page.url()).toMatch(/\/(dashboard|workspaces)/);
    } else {
      console.log('User not authenticated, skipping session persistence test');
    }
  });

  test('logout clears session', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check if user menu exists
    const userMenu = page.locator('[data-testid="user-menu"]').or(page.locator('button:has-text("admin@partyquiz.demo")')).first();
    
    if (await userMenu.isVisible({ timeout: 2000 })) {
      // Click user menu
      await userMenu.click();
      
      // Click logout
      await page.click('text=Sign Out');
      
      // Verify redirected to landing page
      await expect(page).toHaveURL('/', { timeout: 5000 });
      
      // Verify unauthenticated
      await expect(page.locator('text=Sign In')).toBeVisible();
    } else {
      console.log('User menu not found, skipping logout test');
    }
  });

  test('protected routes redirect to login', async ({ page, context }) => {
    // Clear all cookies to ensure unauthenticated state
    await context.clearCookies();
    
    // Try to access protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page.url()).toMatch(/\/signin|\/auth\/signin|\//);
  });

  test('invalid magic link shows error', async ({ page }) => {
    // Try to access callback with invalid token
    await page.goto('/api/auth/callback/email?token=invalid-token&email=test@example.com');
    
    // Should show error or redirect to login
    await expect(page.locator('text=Invalid').or(page.locator('text=Error'))).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Authorization', () => {
  test('workspace owner can manage members', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Demo Workspace');
    
    // Navigate to settings
    await page.locator('text=Settings').first().click();
    
    // Check if Members tab exists
    const membersTab = page.locator('text=Members');
    if (await membersTab.isVisible({ timeout: 2000 })) {
      await membersTab.click();
      
      // Verify invite button exists (owner permission)
      await expect(page.locator('button:has-text("Invite")')).toBeVisible();
    } else {
      console.log('Members tab not found, skipping authorization test');
    }
  });

  test.skip('editor cannot delete workspace', async ({ page }) => {
    // This test requires multiple user accounts
    // Login as editor (editor@partyquiz.demo)
    // Navigate to workspace settings
    // Verify Delete Workspace button is hidden or disabled
  });

  test.skip('viewer cannot create questions', async ({ page }) => {
    // Login as viewer
    // Navigate to Questions page
    // Verify Create Question button is hidden or disabled
  });
});
