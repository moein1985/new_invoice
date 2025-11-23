import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetUsers() {
  console.log('🗑️  حذف تمام کاربران...\n');

  // حذف تمام کاربران
  await prisma.user.deleteMany();
  console.log('✅ تمام کاربران حذف شدند\n');

  console.log('👤 ایجاد کاربر admin...\n');

  // ایجاد کاربر admin جدید
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      fullName: 'مدیر سیستم',
      email: 'admin@system.com',
      phone: '09123456789',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✅ کاربر admin ایجاد شد:');
  console.log('   نام کاربری: admin');
  console.log('   رمز عبور: admin123');
  console.log('   نام کامل:', admin.fullName);
  console.log('   ایمیل:', admin.email);
  console.log('   تلفن:', admin.phone);
  console.log('\n✅ عملیات با موفقیت انجام شد!\n');

  await prisma.$disconnect();
}

resetUsers().catch((error) => {
  console.error('❌ خطا:', error);
  process.exit(1);
});
