import { test, expect } from './auth.setup';

test.describe('Navigation', () => {
  test.beforeEach(async ({ authenticate }) => {
    await authenticate();
  });

  test('should navigate to all main pages', async ({ page }) => {
    // Start on dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Navigate to history
    await page.goto('/history');
    await expect(page).toHaveURL('/history');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');

    // Navigate to notes
    await page.goto('/notes');
    await expect(page).toHaveURL('/notes');
  });

  test('should redirect to login when accessing protected routes without auth', async ({ page, context }) => {
    // Clear all cookies and storage
    await context.clearCookies();

    // Try to access dashboard
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/login|\/onboarding/, { timeout: 5000 });
    const url = page.url();
    expect(url).toMatch(/\/login|\/onboarding/);
  });

  test('should navigate from root to dashboard', async ({ page }) => {
    await page.goto('/');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page).toHaveURL('/dashboard');
  });
});
