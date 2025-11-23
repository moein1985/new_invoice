// Script برای ایجاد approval برای document های PENDING بدون approval
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPendingApprovals() {
  console.log('🔧 بررسی و اصلاح approval های PENDING...\n');

  try {
    // پیدا کردن TEMP_PROFORMA های PENDING
    const pendingDocs = await prisma.document.findMany({
      where: {
        documentType: 'TEMP_PROFORMA',
        approvalStatus: 'PENDING',
      },
      include: {
        approvals: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    console.log(`📊 تعداد TEMP_PROFORMA های PENDING: ${pendingDocs.length}\n`);

    if (pendingDocs.length === 0) {
      console.log('✅ هیچ TEMP_PROFORMA ی PENDING وجود ندارد!\n');
      return;
    }

    // بررسی هر سند
    let fixedCount = 0;
    for (const doc of pendingDocs) {
      console.log(`📋 ${doc.documentNumber}:`);
      console.log(`   - تعداد approval ها: ${doc.approvals.length}`);
      
      if (doc.approvals.length === 0) {
        console.log(`   ⚠️  بدون approval! ایجاد approval جدید...`);
        
        // ایجاد approval جدید
        await prisma.approval.create({
          data: {
            documentId: doc.id,
            userId: doc.createdBy.id,
            status: 'PENDING',
            comment: 'سند نیاز به تایید دارد',
          },
        });
        
        fixedCount++;
        console.log(`   ✅ approval ایجاد شد`);
      } else {
        console.log(`   ✅ approval وجود دارد`);
      }
      console.log('');
    }

    if (fixedCount > 0) {
      console.log(`✅ ${fixedCount} approval جدید ایجاد شد!\n`);
    } else {
      console.log('✅ همه اسناد PENDING دارای approval هستند!\n');
    }

    // نمایش وضعیت نهایی
    const finalCheck = await prisma.document.findMany({
      where: {
        documentType: 'TEMP_PROFORMA',
        approvalStatus: 'PENDING',
      },
      include: {
        _count: {
          select: { approvals: true },
        },
      },
    });

    console.log('📈 وضعیت نهایی:');
    for (const doc of finalCheck) {
      console.log(`   ${doc.documentNumber}: ${doc._count.approvals} approval`);
    }

    console.log('\n✅ اصلاح تمام شد!');
  } catch (error) {
    console.error('❌ خطا:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixPendingApprovals().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
