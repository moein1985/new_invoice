import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingUsers() {
  console.log('🔄 به‌روزرسانی کاربران موجود...\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      phone: true,
    },
  });

  console.log(`📊 تعداد کاربران: ${users.length}\n`);

  let updated = 0;
  for (const user of users) {
    // فقط کاربرانی که email یا phone ندارند را به‌روزرسانی کن
    if (!user.email || !user.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.email || `${user.username}@example.com`,
          phone: user.phone || '09000000000',
        },
      });
      console.log(`✅ کاربر "${user.fullName}" به‌روزرسانی شد`);
      updated++;
    } else {
      console.log(`⏭️  کاربر "${user.fullName}" از قبل دارای email و phone است`);
    }
  }

  console.log(`\n📈 ${updated} کاربر به‌روزرسانی شد`);
  console.log('✅ به‌روزرسانی کامل شد!\n');

  await prisma.$disconnect();
}

updateExistingUsers().catch((error) => {
  console.error('❌ خطا:', error);
  process.exit(1);
});
