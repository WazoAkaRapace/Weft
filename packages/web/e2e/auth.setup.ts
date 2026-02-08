import { test as base } from '@playwright/test';

export type AuthOptions = {
  username?: string;
  password?: string;
};

export const test = base.extend<{
  authenticate: (options?: AuthOptions) => Promise<void>;
}>({
  authenticate: async ({ page }, use) => {
    const authFn = async (options: AuthOptions = {}) => {
      const { username = 'test@example.com', password = 'password123' } = options;

      // Go to login page
      await page.goto('/login');

      // Check if we're on the onboarding page (no users exist)
      const onboardingTitle = page.getByText('Create your account');
      const isOnboarding = await onboardingTitle.isVisible().catch(() => false);

      if (isOnboarding) {
        // Complete onboarding
        await page.fill('input[type="text"]', username);
        await page.fill('input[type="password"]', password);
        await page.fill('input[type="password"]', password, { timeout: 1000 }); // Confirm password
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard', { timeout: 5000 });
      } else {
        // Normal login flow
        await page.fill('input[type="email"]', username);
        await page.fill('input[type="password"]', password);
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard', { timeout: 5000 });
      }
    };

    await use(authFn);
  },
});

export const expect = test.expect;
