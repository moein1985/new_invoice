import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuery() {
  try {
    console.log('🧪 تست کوئری customers...\n');

    // دقیقاً همان کوئری که router استفاده می‌کند
    const skip = (1 - 1) * 10; // page=1, limit=10
    const where = {}; // بدون search

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    console.log('📊 نتیجه:');
    console.log('Total:', total);
    console.log('Customers:', JSON.stringify(customers, null, 2));

    // تست بدون include
    const simpleCustomers = await prisma.customer.findMany({
      where,
      skip,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    console.log('\n📊 بدون include:');
    console.log('Count:', simpleCustomers.length);
    console.log('Data:', JSON.stringify(simpleCustomers, null, 2));

  } catch (error) {
    console.error('❌ خطا:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
