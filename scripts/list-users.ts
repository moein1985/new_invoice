import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

prisma.user.findMany({
  select: {
    username: true,
    fullName: true,
    email: true,
    phone: true,
    role: true,
  },
}).then((users) => {
  console.log('\n📋 کاربران سیستم:\n');
  users.forEach((user) => {
    console.log(`👤 ${user.fullName}`);
    console.log(`   نام کاربری: ${user.username}`);
    console.log(`   ایمیل: ${user.email}`);
    console.log(`   تلفن: ${user.phone}`);
    console.log(`   نقش: ${user.role}`);
    console.log('');
  });
  prisma.$disconnect();
});
