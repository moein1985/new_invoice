import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkApproval() {
  const approval = await prisma.approval.findFirst({
    include: {
      document: true,
      user: true,
    },
  });

  console.log('📋 Approval:');
  console.log(JSON.stringify(approval, null, 2));

  await prisma.$disconnect();
}

checkApproval();
