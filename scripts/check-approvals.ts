import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 بررسی وضعیت approvals...\n');

  // تمام approvals
  const allApprovals = await prisma.approval.findMany({
    include: {
      document: {
        select: {
          documentNumber: true,
          approvalStatus: true,
          documentType: true,
        },
      },
      user: {
        select: {
          fullName: true,
        },
      },
    },
  });

  console.log(`📊 مجموع ${allApprovals.length} approval در سیستم:\n`);

  for (const approval of allApprovals) {
    console.log(`Approval ID: ${approval.id}`);
    console.log(`  سند: ${approval.document.documentNumber} (${approval.document.documentType})`);
    console.log(`  وضعیت Approval: ${approval.status}`);
    console.log(`  وضعیت Document: ${approval.document.approvalStatus}`);
    console.log(`  کاربر: ${approval.user.fullName}`);
    console.log(`  تاریخ: ${approval.createdAt.toLocaleDateString('fa-IR')}\n`);
  }

  // Pending approvals
  const pendingApprovals = await prisma.approval.findMany({
    where: {
      status: 'PENDING',
    },
  });

  console.log(`\n⏳ ${pendingApprovals.length} approval با وضعیت PENDING`);
}

main()
  .catch((e) => {
    console.error('❌ خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
