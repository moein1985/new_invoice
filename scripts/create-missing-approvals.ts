import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createMissingApprovals() {
  // پیدا کردن TEMP_PROFORMA های PENDING بدون approval
  const docs = await prisma.document.findMany({
    where: {
      documentType: 'TEMP_PROFORMA',
      approvalStatus: 'PENDING',
    },
    include: {
      approvals: true,
      createdBy: true,
    },
  });

  console.log(`📊 ${docs.length} TEMP_PROFORMA با وضعیت PENDING`);

  for (const doc of docs) {
    if (doc.approvals.length === 0) {
      console.log(`✅ ایجاد approval برای ${doc.documentNumber}`);
      await prisma.approval.create({
        data: {
          documentId: doc.id,
          userId: doc.createdById,
          status: 'PENDING',
          comment: 'نیاز به تایید',
        },
      });
    }
  }

  console.log('✅ تمام!');
  await prisma.$disconnect();
}

createMissingApprovals();
