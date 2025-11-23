// Script برای اصلاح وضعیت اسناد غیر TEMP_PROFORMA
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDocumentStatuses() {
  console.log('🔧 اصلاح وضعیت اسناد...\n');

  try {
    // پیدا کردن اسناد غیر TEMP_PROFORMA که PENDING هستند
    const wrongStatusDocs = await prisma.document.findMany({
      where: {
        approvalStatus: 'PENDING',
        documentType: {
          not: 'TEMP_PROFORMA',
        },
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        approvalStatus: true,
      },
    });

    console.log(`📊 اسناد با وضعیت نادرست: ${wrongStatusDocs.length}\n`);

    if (wrongStatusDocs.length > 0) {
      console.log('📋 اسناد قبل از اصلاح:');
      for (const doc of wrongStatusDocs) {
        console.log(`   - ${doc.documentNumber} (${doc.documentType}) - ${doc.approvalStatus}`);
      }
      console.log('');

      // تغییر وضعیت به APPROVED (چون این اسناد نباید workflow تایید داشته باشند)
      const updated = await prisma.document.updateMany({
        where: {
          id: {
            in: wrongStatusDocs.map((d) => d.id),
          },
        },
        data: {
          approvalStatus: 'APPROVED',
        },
      });

      console.log(`✅ ${updated.count} سند به وضعیت APPROVED تغییر یافت\n`);
    } else {
      console.log('✅ همه اسناد وضعیت صحیح دارند!\n');
    }

    // نمایش وضعیت نهایی
    const stats = await prisma.document.groupBy({
      by: ['documentType', 'approvalStatus'],
      _count: { id: true },
    });

    console.log('📊 وضعیت نهایی اسناد:');
    for (const stat of stats) {
      console.log(`   ${stat.documentType}: ${stat.approvalStatus} = ${stat._count.id}`);
    }

    console.log('\n✅ اصلاح با موفقیت انجام شد!');
  } catch (error) {
    console.error('❌ خطا:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixDocumentStatuses().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
