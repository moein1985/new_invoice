// Script برای بررسی document های PENDING
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPendingDocuments() {
  console.log('🔍 بررسی document های PENDING...\n');

  try {
    // همه document های PENDING
    const allPending = await prisma.document.findMany({
      where: {
        approvalStatus: 'PENDING',
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        approvalStatus: true,
        _count: {
          select: { approvals: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📊 تعداد کل document های PENDING: ${allPending.length}\n`);

    if (allPending.length > 0) {
      console.log('📋 لیست document های PENDING:');
      for (const doc of allPending) {
        console.log(
          `   ${doc.documentType === 'TEMP_PROFORMA' ? '✅' : '⚠️ '} ${doc.documentNumber} (${doc.documentType}) - ${doc._count.approvals} approval`
        );
      }
      console.log('');
    }

    // فقط TEMP_PROFORMA های PENDING
    const tempProformaPending = await prisma.document.count({
      where: {
        approvalStatus: 'PENDING',
        documentType: 'TEMP_PROFORMA',
      },
    });

    console.log(`✅ تعداد TEMP_PROFORMA های PENDING: ${tempProformaPending}`);

    // سایر انواع document که PENDING هستند
    const otherPending = allPending.filter((d) => d.documentType !== 'TEMP_PROFORMA');
    if (otherPending.length > 0) {
      console.log(`\n⚠️  اسناد غیر TEMP_PROFORMA که PENDING هستند:`);
      for (const doc of otherPending) {
        console.log(`   - ${doc.documentNumber} (${doc.documentType})`);
      }
      
      console.log('\n💡 این اسناد باید وضعیت‌شان تغییر کند چون فقط TEMP_PROFORMA نیاز به تایید دارد.');
    }

    console.log('\n✅ بررسی تمام شد!');
  } catch (error) {
    console.error('❌ خطا:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPendingDocuments().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
