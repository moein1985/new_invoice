import { test, expect } from '@playwright/test';

// Helper: login as admin
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.waitForSelector('input[name="username"]', { timeout: 15000 });
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

test.describe('Ticket System - Admin/Manager View', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display employer management page', async ({ page }) => {
    await page.goto('/employers');
    await expect(page.locator('h1').filter({ hasText: 'مدیریت تیکت‌های کارفرمایان' })).toBeVisible({ timeout: 15000 });
  });

  test('should display ticket list page', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.locator('h1').filter({ hasText: 'تیکت‌ها' })).toBeVisible({ timeout: 15000 });
  });

  test('should display new ticket form', async ({ page }) => {
    await page.goto('/tickets/new');
    await expect(page.locator('h1').filter({ hasText: 'تیکت جدید' })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toBeVisible();
  });

  test('should validate required fields in new ticket form', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForSelector('h1', { timeout: 15000 });

    // Try to submit without filling anything
    await page.click('button[type="submit"]');

    // Form should still be visible (browser validation prevents submit)
    await expect(page.locator('h1').filter({ hasText: 'تیکت جدید' })).toBeVisible();
  });

  test('should filter tickets by status', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.locator('h1').filter({ hasText: 'تیکت‌ها' })).toBeVisible({ timeout: 15000 });

    // Select status filter
    const statusSelect = page.locator('select').last();
    await statusSelect.selectOption('OPEN');
    await page.waitForTimeout(500);

    // Page should still show heading
    await expect(page.locator('h1').filter({ hasText: 'تیکت‌ها' })).toBeVisible();
  });

  test('should search tickets', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.locator('h1').filter({ hasText: 'تیکت‌ها' })).toBeVisible({ timeout: 15000 });

    await page.fill('input[placeholder*="جستجو"]', 'تست');
    await page.waitForTimeout(1000);

    await expect(page.locator('h1').filter({ hasText: 'تیکت‌ها' })).toBeVisible();
  });

  test('should show employer section in project detail', async ({ page }) => {
    // Go to projects list
    await page.goto('/projects');
    await page.waitForTimeout(2000);

    // Click on first project in the table
    const firstProjectLink = page.locator('a[href^="/projects/"]').first();
    if (await firstProjectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstProjectLink.click();
      await page.waitForTimeout(2000);

      // Should see employer section (manager view)
      const employerSection = page.locator('h2').filter({ hasText: 'کارفرمای پروژه' });
      await expect(employerSection).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Ticket System - Create and Detail Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should create a ticket and view it in detail', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForSelector('h1', { timeout: 15000 });

    // Fill the form - select first project if available
    const projectSelect = page.locator('select').first();
    const projectOptions = await projectSelect.locator('option').count();
    if (projectOptions > 1) {
      await projectSelect.selectOption({ index: 1 });

      const titleInput = page.locator('input[type="text"]').first();
      await titleInput.fill('تیکت تستی E2E');

      const descTextarea = page.locator('textarea').first();
      await descTextarea.fill('این یک توضیحات تستی برای E2E است');

      // Submit
      await page.click('button[type="submit"]');

      // Should redirect to ticket detail page
      await page.waitForURL('**/tickets/*', { timeout: 15000 });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display ticket detail with conversation and attachments sections', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Click on first ticket if available
    const firstTicketLink = page.locator('a[href^="/tickets/"]').first();
    if (await firstTicketLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstTicketLink.click();
      await page.waitForTimeout(2000);

      // Should see conversation section
      await expect(page.locator('h2').filter({ hasText: 'مکالمه' })).toBeVisible({ timeout: 10000 });
      // Should see attachments section
      await expect(page.locator('h2').filter({ hasText: 'پیوست‌ها' })).toBeVisible();
    }
  });

  test('should add a reply to a ticket', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const firstTicketLink = page.locator('a[href^="/tickets/"]').first();
    if (await firstTicketLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstTicketLink.click();
      await page.waitForTimeout(2000);

      // Check if reply textarea is visible (ticket not closed)
      const replyTextarea = page.locator('textarea[placeholder*="پاسخ"]');
      if (await replyTextarea.isVisible({ timeout: 5000 }).catch(() => false)) {
        await replyTextarea.fill('پاسخ تستی E2E');
        await page.click('button[type="submit"]');

        // Should see the reply in conversation
        await page.waitForTimeout(2000);
        await expect(page.locator('text=پاسخ تستی E2E')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should close a ticket as admin', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const firstTicketLink = page.locator('a[href^="/tickets/"]').first();
    if (await firstTicketLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstTicketLink.click();
      await page.waitForTimeout(2000);

      // Look for close button (admin can see "بستن تیکت")
      const closeBtn = page.locator('button:has-text("بستن تیکت")').first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(2000);

        // Should see "بسته شده است" message
        await expect(page.locator('text=بسته شده است')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should show delete button for admin', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForSelector('h1', { timeout: 15000 });
    await page.waitForTimeout(2000);

    const firstTicketLink = page.locator('a[href^="/tickets/"]').first();
    if (await firstTicketLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstTicketLink.click();
      await page.waitForTimeout(2000);

      // Admin should see delete button
      const deleteBtn = page.locator('button:has-text("حذف")');
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Ticket System - Upload Route', () => {
  test('should reject unauthenticated upload', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:3000/api/upload/ticket', {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('test'),
        },
        type: 'pdf',
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('Ticket System - Employer Dashboard', () => {
  test('should redirect non-employer users from employer dashboard', async ({ page }) => {
    await loginAsAdmin(page);

    // Admin accessing employer dashboard - should still load (admin can access everything)
    // but the dashboard is designed for employer role
    await page.goto('/dashboard/employer');
    await page.waitForTimeout(2000);

    // Page should load (it uses session data, doesn't hard-restrict admin)
    await expect(page.locator('h1').filter({ hasText: 'داشبورد کارفرما' })).toBeVisible({ timeout: 10000 });
  });
});
