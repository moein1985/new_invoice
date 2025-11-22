-- Update user names to English temporarily
UPDATE users SET "fullName" = 'System Administrator' WHERE username = 'admin';
UPDATE users SET "fullName" = 'Manager' WHERE username = 'manager';
UPDATE users SET "fullName" = 'Regular User' WHERE username = 'user';
