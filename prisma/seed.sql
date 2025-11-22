-- Seed data for new_invoice system

-- Users (all passwords: admin123, manager123, user123)
INSERT INTO users (id, username, password, "fullName", role, "isActive", "createdAt", "updatedAt")
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin', '$2b$10$gGQagQZzGhjUP8IWIkuClepG.mwPRkufebLU.bi5MvjmibUa8OeGq', 'مدیر سیستم', 'ADMIN', true, now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'manager', '$2b$10$gGQagQZzGhjUP8IWIkuClepG.mwPRkufebLU.bi5MvjmibUa8OeGq', 'مدیر اجرایی', 'MANAGER', true, now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'user', '$2b$10$gGQagQZzGhjUP8IWIkuClepG.mwPRkufebLU.bi5MvjmibUa8OeGq', 'کاربر عادی', 'USER', true, now(), now())
ON CONFLICT (username) DO NOTHING;

-- Sample customers
INSERT INTO customers (id, code, name, phone, email, address, "isActive", "createdAt", "updatedAt")
VALUES
  ('aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CUST001', 'شرکت تجارت الکترونیک پارس', '02177665544', 'info@pars-trade.com', 'تهران، میدان ونک، برج سپهر', true, now(), now()),
  ('bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CUST002', 'فروشگاه زنجیره‌ای آپادانا', '02188990011', 'contact@apadana.com', 'تهران، خیابان آزادی، نبش کوچه پانزده', true, now(), now())
ON CONFLICT (code) DO NOTHING;
