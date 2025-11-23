import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCurrentDoc() {
  console.log('\n🔧 اصلاح سند فعلی\n');

  // پیدا کردن سند بدون approval
  const doc = await prisma.document.findFirst({
    where: {
      documentType: 'TEMP_PROFORMA',
      approvalStatus: 'PENDING',
    },
    include: {
      approvals: true,
    },
  });

  if (!doc) {
    console.log('❌ سند TEMP_PROFORMA با وضعیت PENDING یافت نشد!');
    return;
  }

  console.log(`📄 سند یافت شد: ${doc.documentNumber}`);
  console.log(`   تعداد approvals: ${doc.approvals.length}`);

  if (doc.approvals.length === 0) {
    // ایجاد approval
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('❌ کاربری یافت نشد!');
      return;
    }

    await prisma.approval.create({
      data: {
        documentId: doc.id,
        userId: user.id,
        status: 'PENDING',
        comment: 'در انتظار تایید',
      },
    });

    console.log('✅ Approval ایجاد شد!');
    console.log('\n🎉 حالا به کارتابل تاییدیه‌ها بروید، سند باید ظاهر شود.\n');
  } else {
    console.log('✅ سند قبلاً approval دارد\n');
  }

  await prisma.$disconnect();
}

fixCurrentDoc().catch((error) => {
  console.error(error);
  process.exit(1);
});
