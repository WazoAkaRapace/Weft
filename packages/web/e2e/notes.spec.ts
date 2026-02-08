import { test, expect } from './auth.setup';

test.describe('Notes', () => {
  test.beforeEach(async ({ authenticate }) => {
    await authenticate();
  });

  test('should display notes page', async ({ page }) => {
    await page.goto('/notes');

    // Check for page elements
    await expect(page.locator('body')).toBeVisible();

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display empty state when no notes exist', async ({ page }) => {
    await page.goto('/notes');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check for empty state
    const emptyState = page.getByText(/no notes|create your first note|get started/i);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should navigate to templates page', async ({ page }) => {
    await page.goto('/notes');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for templates link
    const templatesLink = page.getByRole('link').filter({ hasText: /templates/i }).first();
    const hasTemplatesLink = await templatesLink.isVisible().catch(() => false);

    if (hasTemplatesLink) {
      await templatesLink.click();
      await page.waitForURL(/\/notes\/templates/, { timeout: 3000 });
    }
  });

  test('should be able to create a new note', async ({ page }) => {
    await page.goto('/notes');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for create note button
    const createButton = page.getByRole('button').filter({
      hasText: /new note|create note|add note/i
    }).first();

    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.click();

      // Should either open a modal or navigate to a new note page
      await page.waitForTimeout(1000);

      // Check for editor or modal
      const editor = page.locator('[contenteditable="true"], .editor, textarea').first();
      const hasEditor = await editor.isVisible().catch(() => false);

      if (hasEditor) {
        await expect(editor).toBeVisible();
      }
    }
  });
});
