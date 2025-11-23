// Script برای پاکسازی approval های یتیم و نادرست
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupApprovals() {
  console.log('🔍 شروع بررسی و پاکسازی approval ها...\n');

  try {
    // 1. پیدا کردن تمام approval ها
    const allApprovals = await prisma.approval.findMany({
      include: {
        document: {
          select: {
            id: true,
            documentNumber: true,
            approvalStatus: true,
            documentType: true,
          },
        },
      },
    });

    console.log(`📊 تعداد کل approval ها: ${allApprovals.length}`);

    // 2. approval های یتیم (بدون document)
    const orphanedApprovals = allApprovals.filter((a) => !a.document);
    console.log(`🗑️  approval های یتیم (بدون document): ${orphanedApprovals.length}`);

    if (orphanedApprovals.length > 0) {
      const deletedOrphaned = await prisma.approval.deleteMany({
        where: {
          id: {
            in: orphanedApprovals.map((a) => a.id),
          },
        },
      });
      console.log(`✅ ${deletedOrphaned.count} approval یتیم حذف شد\n`);
    }

    // 3. approval های مربوط به document هایی که APPROVED یا REJECTED هستند
    const mismatchedApprovals = allApprovals.filter(
      (a) =>
        a.document &&
        a.document.approvalStatus !== 'PENDING' &&
        a.document.documentType === 'TEMP_PROFORMA'
    );

    console.log(
      `⚠️  approval های نادرست (document APPROVED/REJECTED): ${mismatchedApprovals.length}`
    );

    if (mismatchedApprovals.length > 0) {
      for (const approval of mismatchedApprovals) {
        console.log(
          `   - Document ${approval.document?.documentNumber} (${approval.document?.approvalStatus})`
        );
      }

      const deletedMismatched = await prisma.approval.deleteMany({
        where: {
          id: {
            in: mismatchedApprovals.map((a) => a.id),
          },
        },
      });
      console.log(`✅ ${deletedMismatched.count} approval نادرست حذف شد\n`);
    }

    // 4. نمایش وضعیت نهایی
    const remainingApprovals = await prisma.approval.count();
    const pendingDocuments = await prisma.document.count({
      where: {
        approvalStatus: 'PENDING',
        documentType: 'TEMP_PROFORMA',
      },
    });

    console.log('\n📈 وضعیت نهایی:');
    console.log(`   - تعداد approval های باقی‌مانده: ${remainingApprovals}`);
    console.log(`   - تعداد document های PENDING: ${pendingDocuments}`);

    // 5. لیست document های PENDING
    const pendingDocs = await prisma.document.findMany({
      where: {
        approvalStatus: 'PENDING',
        documentType: 'TEMP_PROFORMA',
      },
      select: {
        id: true,
        documentNumber: true,
        approvalStatus: true,
        _count: {
          select: { approvals: true },
        },
      },
    });

    if (pendingDocs.length > 0) {
      console.log('\n📋 لیست document های PENDING:');
      for (const doc of pendingDocs) {
        console.log(
          `   - ${doc.documentNumber} (${doc._count.approvals} approval)`
        );
      }
    }

    console.log('\n✅ پاکسازی با موفقیت انجام شد!');
  } catch (error) {
    console.error('❌ خطا در پاکسازی:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// اجرای script
cleanupApprovals()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
