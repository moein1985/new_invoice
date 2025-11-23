import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 جستجوی اسناد بدون approval...');

  // پیدا کردن تمام اسناد TEMP_PROFORMA که approval ندارند
  const documents = await prisma.document.findMany({
    where: {
      documentType: 'TEMP_PROFORMA',
      approvalStatus: 'PENDING',
    },
    include: {
      approvals: true,
    },
  });

  console.log(`📄 ${documents.length} سند TEMP_PROFORMA با وضعیت PENDING پیدا شد`);

  let createdCount = 0;

  for (const doc of documents) {
    // اگر قبلاً approval داره، رد کن
    if (doc.approvals && doc.approvals.length > 0) {
      console.log(`⏭️  سند ${doc.documentNumber} قبلاً approval داره`);
      continue;
    }

    // ایجاد approval record
    await prisma.approval.create({
      data: {
        documentId: doc.id,
        userId: doc.createdById,
        status: 'PENDING',
      },
    });

    createdCount++;
    console.log(`✅ Approval برای سند ${doc.documentNumber} ساخته شد`);
  }

  console.log(`\n✨ در مجموع ${createdCount} approval ساخته شد`);
}

main()
  .catch((e) => {
    console.error('❌ خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
