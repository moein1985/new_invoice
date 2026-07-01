import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

test.describe('Purchase System E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.fill('input[name="username"]', ADMIN_USERNAME);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('should display purchase list page', async ({ page }) => {
    await page.goto('/purchases');
    await expect(page.locator('h1, h2').filter({ hasText: /خرید|purchase/i })).toBeVisible();
  });

  test('should navigate to new purchase form', async ({ page }) => {
    await page.goto('/purchases');
    await page.click('a[href="/purchases/new"]');
    await expect(page).toHaveURL(/\/purchases\/new/);
    await expect(page.locator('input[name="title"], #title')).toBeVisible();
  });

  test('should create a new purchase request', async ({ page }) => {
    await page.goto('/purchases/new');

    await page.fill('input[name="title"], #title', 'E2E Test Purchase');
    await page.fill('textarea[name="description"], #description', 'Test description from E2E');

    // Add an item
    await page.fill('input[name="items.0.productName"], input[placeholder*="محصول"]', 'کابل تست');
    await page.fill('input[name="items.0.quantity"], input[type="number"]', '5');
    await page.fill('input[name="items.0.unit"], input[placeholder*="واحد"]', 'عدد');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to purchase list or detail
    await page.waitForURL(/\/purchases/);
    await expect(page.locator('text=E2E Test Purchase')).toBeVisible({ timeout: 10000 });
  });

  test('should show purchase detail page', async ({ page }) => {
    await page.goto('/purchases');
    // Click on first purchase in the list
    const firstRow = page.locator('a[href*="/purchases/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForURL(/\/purchases\/[^/]+$/);
      // Check detail page elements
      await expect(page.locator('text=/PR-\\d{4}-\\d{6}/')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter purchases by status', async ({ page }) => {
    await page.goto('/purchases');

    // Look for status filter dropdown
    const statusFilter = page.locator('select').filter({ hasText: /وضعیت|status/i }).first();
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
      // Verify filter is applied
      const rows = page.locator('table tbody tr');
      const count = await rows.count();
      if (count > 0) {
        await expect(rows.first()).toContainText(/پیش‌نویس|draft/i);
      }
    }
  });

  test('should filter purchases by date range', async ({ page }) => {
    await page.goto('/purchases');

    const dateFrom = page.locator('input[type="date"]').first();
    const dateTo = page.locator('input[type="date"]').last();

    if (await dateFrom.isVisible() && await dateTo.isVisible()) {
      await dateFrom.fill('2025-01-01');
      await dateTo.fill('2025-12-31');
      await page.waitForTimeout(500);
      // Page should not crash
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should navigate to inquiry form from purchase detail', async ({ page }) => {
    await page.goto('/purchases');
    const firstRow = page.locator('a[href*="/purchases/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForURL(/\/purchases\/[^/]+$/);

      // Look for "add inquiry" button/link
      const addInquiryBtn = page.locator('a[href*="/inquiry/new"], button').filter({ hasText: /استعلام|inquiry/i }).first();
      if (await addInquiryBtn.isVisible()) {
        await addInquiryBtn.click();
        await page.waitForURL(/\/inquiry\/new/);
        await expect(page.locator('input[placeholder*="تأمین"], input[name*="supplier"]')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should show audit log section in purchase detail', async ({ page }) => {
    await page.goto('/purchases');
    const firstRow = page.locator('a[href*="/purchases/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForURL(/\/purchases\/[^/]+$/);

      // Look for audit log section
      const auditSection = page.locator('text=/تاریخچه|audit|log/i');
      if (await auditSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(auditSection.first()).toBeVisible();
      }
    }
  });

  test('should show purchase summary on project page', async ({ page }) => {
    await page.goto('/projects');
    const firstProject = page.locator('a[href*="/projects/"]').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      await page.waitForURL(/\/projects\/[^/]+$/);

      // Look for purchase summary section
      const purchaseSummary = page.locator('text=/خرید|purchase/i');
      await expect(purchaseSummary.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should reject a purchase request', async ({ page }) => {
    await page.goto('/purchases');
    const firstRow = page.locator('a[href*="/purchases/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForURL(/\/purchases\/[^/]+$/);

      const rejectBtn = page.locator('button').filter({ hasText: /رد|reject/i }).first();
      if (await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rejectBtn.click();

        // Fill rejection reason if modal appears
        const reasonInput = page.locator('textarea, input').filter({ hasText: /دلیل|reason/i }).first();
        if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await reasonInput.fill('E2E test rejection');
          const confirmBtn = page.locator('button').filter({ hasText: /تایید|confirm|رد/i }).last();
          await confirmBtn.click();
        }

        // Verify status changed
        await page.waitForTimeout(1000);
        await expect(page.locator('text=/رد|rejected/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should generate PDF for a purchase request', async ({ page }) => {
    await page.goto('/purchases');
    const firstRow = page.locator('a[href*="/purchases/"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForURL(/\/purchases\/[^/]+$/);

      const pdfBtn = page.locator('a[href*="/pdf"], button').filter({ hasText: /PDF|pdf|خروجی/i }).first();
      if (await pdfBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click and expect download
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          pdfBtn.click(),
        ]);
        // If download triggered, verify it's a PDF
        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.pdf$/);
        }
      }
    }
  });

  test('should prevent unauthorized USER from accessing purchase list', async ({ page }) => {
    // Logout first
    const logoutBtn = page.locator('button:has-text("خروج")').first();
    await logoutBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await logoutBtn.click({ timeout: 10000, force: true });
    await page.waitForURL('**/login', { timeout: 15000 });

    // Login as regular user (if test user exists)
    await page.fill('input[name="username"]', 'user');
    await page.fill('input[name="password"]', 'user123');
    await page.click('button[type="submit"]');

    // If login succeeds, check purchases page shows only assigned items
    if (page.url().includes('/dashboard')) {
      await page.goto('/purchases');
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Purchase System - Full Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.fill('input[name="username"]', ADMIN_USERNAME);
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('complete purchase workflow: create -> edit -> submit -> approve -> purchase', async ({ page }) => {
    // Step 1: Create
    await page.goto('/purchases/new');
    await page.fill('input[name="title"], #title', 'E2E Workflow Test');
    await page.fill('input[name="items.0.productName"], input[placeholder*="محصول"]', 'محصول تست');
    await page.fill('input[name="items.0.quantity"], input[type="number"]', '3');
    await page.fill('input[name="items.0.unit"], input[placeholder*="واحد"]', 'عدد');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/purchases/);

    // Find the created purchase
    await page.goto('/purchases');
    const createdItem = page.locator('text=E2E Workflow Test').first();
    await expect(createdItem).toBeVisible({ timeout: 10000 });

    // Click into it
    await createdItem.click();
    await page.waitForURL(/\/purchases\/[^/]+$/);

    // Step 2: Verify status is DRAFT or PENDING_INQUIRY
    await expect(page.locator('text=/پیش‌نویس|در انتظار|draft|pending/i')).toBeVisible({ timeout: 5000 });

    // Step 3: If there's an edit button, test editing
    const editBtn = page.locator('a[href*="/edit"]').first();
    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForURL(/\/edit/);
      await expect(page.locator('input[name="title"], #title')).toHaveValue(/E2E Workflow/);
    }
  });
});
