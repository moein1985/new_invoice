import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 بررسی دیتابیس...\n');

    const users = await prisma.user.count();
    console.log('👥 تعداد کاربران:', users);

    const customers = await prisma.customer.count();
    console.log('🏢 تعداد مشتریان:', customers);

    const documents = await prisma.document.count();
    console.log('📄 تعداد اسناد:', documents);

    const approvals = await prisma.approval.count();
    console.log('✅ تعداد تاییدیه‌ها:', approvals);

    console.log('\n📊 نمونه دیتاها:\n');

    // نمایش اولین کاربر
    const firstUser = await prisma.user.findFirst({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
    console.log('اولین کاربر:', firstUser);

    // نمایش اولین مشتری
    const firstCustomer = await prisma.customer.findFirst({
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });
    console.log('اولین مشتری:', firstCustomer);

    // نمایش اولین سند
    const firstDocument = await prisma.document.findFirst({
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        totalAmount: true,
        approvalStatus: true,
      },
    });
    console.log('اولین سند:', firstDocument);

    // بررسی رکوردهای غیرفعال
    const inactiveCustomers = await prisma.customer.count({
      where: { isActive: false },
    });
    console.log('\n⚠️ مشتریان غیرفعال:', inactiveCustomers);

    const inactiveUsers = await prisma.user.count({
      where: { isActive: false },
    });
    console.log('⚠️ کاربران غیرفعال:', inactiveUsers);

  } catch (error) {
    console.error('❌ خطا در بررسی دیتابیس:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
