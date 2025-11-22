import { test, expect } from '@playwright/test';

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Navigate to customers
    await page.goto('/customers');
    await expect(page.locator('text=مشتریان')).toBeVisible();
  });

  test('should display customers list', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible();
  });

  test('should search customers', async ({ page }) => {
    await page.fill('input[placeholder*="جستجو"]', 'تست');
    await page.waitForTimeout(1000); // Wait for debounce
    
    // Table should still be visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('should open create customer modal', async ({ page }) => {
    await page.click('button:has-text("مشتری جدید")');
    await expect(page.locator('text=افزودن مشتری')).toBeVisible();
    await expect(page.locator('input[name="code"]')).toBeVisible();
  });

  test('should create a new customer', async ({ page }) => {
    const randomCode = `TEST${Date.now()}`;
    
    await page.click('button:has-text("مشتری جدید")');
    
    await page.fill('input[name="code"]', randomCode);
    await page.fill('input[name="name"]', 'مشتری تستی');
    await page.fill('input[name="phone"]', '09121234567');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('textarea[name="address"]', 'آدرس تستی');
    
    await page.click('button[type="submit"]:has-text("افزودن")');
    
    // Should see success toast
    await expect(page.locator('text=مشتری با موفقیت اضافه شد')).toBeVisible({ timeout: 5000 });
    
    // Modal should close
    await expect(page.locator('text=افزودن مشتری')).not.toBeVisible();
  });

  test('should show error for duplicate customer code', async ({ page }) => {
    // Create first customer
    const code = `DUP${Date.now()}`;
    await page.click('button:has-text("مشتری جدید")');
    await page.fill('input[name="code"]', code);
    await page.fill('input[name="name"]', 'مشتری اول');
    await page.fill('input[name="phone"]', '09121234567');
    await page.click('button[type="submit"]:has-text("افزودن")');
    await expect(page.locator('text=مشتری با موفقیت اضافه شد')).toBeVisible({ timeout: 5000 });
    
    await page.waitForTimeout(3500); // Wait for toast to disappear
    
    // Try to create duplicate
    await page.click('button:has-text("مشتری جدید")');
    await page.fill('input[name="code"]', code);
    await page.fill('input[name="name"]', 'مشتری دوم');
    await page.fill('input[name="phone"]', '09127654321');
    await page.click('button[type="submit"]:has-text("افزودن")');
    
    // Should see error toast
    await expect(page.locator('text=کد مشتری قبلاً استفاده شده است')).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("مشتری جدید")');
    
    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("افزودن")');
    
    // Form should still be visible (browser validation prevents submit)
    await expect(page.locator('text=افزودن مشتری')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.click('button:has-text("مشتری جدید")');
    
    await page.fill('input[name="code"]', 'TEST001');
    await page.fill('input[name="name"]', 'تست');
    await page.fill('input[name="phone"]', '09121234567');
    await page.fill('input[name="email"]', 'invalid-email');
    
    await page.click('button[type="submit"]:has-text("افزودن")');
    
    // Browser validation should prevent submit
    await expect(page.locator('text=افزودن مشتری')).toBeVisible();
  });

  test('should edit existing customer', async ({ page }) => {
    // Find first edit button
    const editButton = page.locator('button:has-text("ویرایش")').first();
    await editButton.click();
    
    await expect(page.locator('text=ویرایش مشتری')).toBeVisible();
    
    // Update name
    await page.fill('input[name="name"]', `نام جدید ${Date.now()}`);
    await page.click('button[type="submit"]:has-text("ذخیره تغییرات")');
    
    // Should see success toast
    await expect(page.locator('text=مشتری با موفقیت ویرایش شد')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel customer creation', async ({ page }) => {
    await page.click('button:has-text("مشتری جدید")');
    await page.fill('input[name="code"]', 'CANCEL001');
    
    await page.click('button:has-text("انصراف")');
    
    // Modal should close
    await expect(page.locator('text=افزودن مشتری')).not.toBeVisible();
  });
});
