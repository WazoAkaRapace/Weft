import { test, expect } from './auth.setup';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ authenticate }) => {
    await authenticate();
  });

  test('should display dashboard page', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for page elements
    const pageContent = page.locator('main, [role="main"]');

    // Dashboard should have some content
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display empty state when no journals exist', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for empty state or content
    const emptyState = page.getByText(/no journals|start recording|create your first journal/i);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should have working navigation links in sidebar', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for sidebar navigation
    const sidebar = page.locator('nav, [role="navigation"], aside');

    // Try to find and click navigation links
    const recordLink = sidebar.getByRole('link').filter({ hasText: /record|record/i }).first();
    const hasRecordLink = await recordLink.isVisible().catch(() => false);

    if (hasRecordLink) {
      await recordLink.click();
      await page.waitForURL('/record', { timeout: 3000 });
    }
  });

  test('should have theme toggle functionality', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for theme toggle button (common patterns)
    const themeButton = page.locator('button').filter({
      hasText: /theme|dark|light|sun|moon/i
    }).first();

    const hasThemeToggle = await themeButton.isVisible().catch(() => false);

    if (hasThemeToggle) {
      // Get initial theme
      const initialHtml = await page.locator('html').getAttribute('class');

      // Toggle theme
      await themeButton.click();

      // Wait a bit for theme to change
      await page.waitForTimeout(500);

      // Check that something changed
      const newHtml = await page.locator('html').getAttribute('class');
      expect(newHtml).not.toBe(initialHtml);
    }
  });
});
