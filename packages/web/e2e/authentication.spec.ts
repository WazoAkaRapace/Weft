import { test, expect } from './auth.setup';

test.describe('Authentication Flow', () => {
  test('should complete onboarding for first-time user', async ({ page, authenticate }) => {
    // Go to the root URL
    await page.goto('/');

    // Should redirect to onboarding or dashboard
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    const isOnboarding = currentUrl.includes('/onboarding');

    if (isOnboarding) {
      // Complete onboarding
      await expect(page.getByText('Create your account')).toBeVisible();
      await expect(page.getByText('Welcome to Weft')).toBeVisible();

      await page.fill('input[type="text"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.fill('input[type="password"]', 'password123'); // Confirm password
      await page.click('button[type="submit"]');

      // Should redirect to dashboard after onboarding
      await page.waitForURL('/dashboard', { timeout: 5000 });
    } else {
      // User already exists, go to login
      await page.goto('/login');
      await expect(page.getByText('Welcome to Weft')).toBeVisible();
      await expect(page.getByText('Sign in to your account')).toBeVisible();
    }
  });

  test('should display validation errors for invalid login', async ({ page }) => {
    await page.goto('/login');

    // Check for onboarding redirect
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();

    if (currentUrl.includes('/onboarding')) {
      test.skip(); // Skip if on onboarding page
      return;
    }

    // Try to login with empty credentials
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeFocused();

    // Try with short password
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'short');
    await page.click('button[type="submit"]');

    // Should show validation for minimum length
    const passwordInput = page.locator('input[type="password"]');
    const minLength = await passwordInput.getAttribute('minLength');
    expect(minLength).toBe('8');
  });

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/login');

    // Check for onboarding redirect
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();

    if (currentUrl.includes('/onboarding')) {
      test.skip(); // Skip if on onboarding page
      return;
    }

    // Click on sign up link
    await page.click('text=Sign up');

    // Should navigate to register page
    await page.waitForURL('/register');
    await expect(page.getByText('Create your account')).toBeVisible();

    // Click on sign in link
    await page.click('text=Sign in');

    // Should navigate back to login page
    await page.waitForURL('/login');
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page, authenticate }) => {
    await authenticate({ username: 'test@example.com', password: 'password123' });

    // Should be on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Should show dashboard content
    await expect(page.locator('h1, h2').filter({ hasText: /dashboard|welcome|your journals/i })).toBeVisible();
  });
});
