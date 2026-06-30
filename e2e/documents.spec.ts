// @ts-nocheck
import { test, expect } from '@playwright/test';

test.describe('Documents List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    await page.goto('/documents');
    await expect(page.locator('h1:has-text("اسناد")')).toBeVisible();
  });

  test('shows documents filters and supports search/url sync', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="جستجو در اسناد"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('INV');
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/search=INV/);
    await expect(page.locator('text=جستجو: INV')).toBeVisible();
  });

  test('supports page size and date filters in URL', async ({ page }) => {
    await page.selectOption('select', '20');

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-01-01');
    await dateInputs.nth(1).fill('2026-01-31');

    await expect(page).toHaveURL(/limit=20/);
    await expect(page).toHaveURL(/from=2026-01-01/);
    await expect(page).toHaveURL(/to=2026-01-31/);
  });

  test('shows export actions for current page and filtered results', async ({ page }) => {
    await expect(page.locator('button:has-text("خروجی صفحه جاری")')).toBeVisible();
    await expect(page.locator('button:has-text("خروجی همه نتایج")')).toBeVisible();
  });
});
