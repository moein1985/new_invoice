import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixApproval() {
  const doc = await prisma.document.findFirst({
    where: { documentNumber: 'TMP-2025-000001' },
  });

  if (doc) {
    // حذف approval های قدیمی
    await prisma.approval.deleteMany({
      where: { documentId: doc.id },
    });

    // ایجاد approval جدید با status PENDING
    await prisma.approval.create({
      data: {
        documentId: doc.id,
        userId: doc.createdById,
        status: 'PENDING',
        comment: 'نیاز به تایید مجدد',
      },
    });

    console.log('✅ approval جدید با status PENDING ایجاد شد');
  }

  await prisma.$disconnect();
}

fixApproval();
