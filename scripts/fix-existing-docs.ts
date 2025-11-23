import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixExistingDocs() {
  console.log('\n🔧 اصلاح اسناد موجود\n');
  console.log('='.repeat(70));

  // حذف اسناد تست
  await prisma.document.deleteMany({
    where: {
      OR: [
        { documentNumber: { startsWith: 'TMP-TEST' } },
        { documentNumber: { startsWith: 'PRF-TEST' } },
        { documentNumber: { startsWith: 'INV-TEST' } },
      ],
    },
  });
  console.log('✅ اسناد تست حذف شدند\n');

  // لیست اسناد واقعی
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'asc' },
    include: { customer: true },
  });

  console.log(`📋 تعداد اسناد واقعی: ${docs.length}\n`);

  for (const doc of docs) {
    console.log(`\n📄 ${doc.documentNumber} (${doc.documentType})`);
    console.log(`   وضعیت فعلی: ${doc.approvalStatus}`);

    // اصلاح وضعیت بر اساس نوع
    if (doc.documentType !== 'TEMP_PROFORMA' && doc.approvalStatus === 'PENDING') {
      await prisma.document.update({
        where: { id: doc.id },
        data: { approvalStatus: 'APPROVED' },
      });
      console.log(`   ✅ تغییر به: APPROVED`);
    } else if (doc.documentType === 'TEMP_PROFORMA' && doc.approvalStatus === 'APPROVED') {
      console.log(`   ✅ درست است: APPROVED (تایید شده)`);
    } else if (doc.documentType === 'TEMP_PROFORMA' && doc.approvalStatus === 'PENDING') {
      console.log(`   ✅ درست است: PENDING (در انتظار تایید)`);
    } else {
      console.log(`   ✅ بدون تغییر`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ اصلاح اسناد تکمیل شد!\n');

  await prisma.$disconnect();
}

fixExistingDocs().catch((error) => {
  console.error(error);
  process.exit(1);
});
