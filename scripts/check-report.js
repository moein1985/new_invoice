const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const r = await p.workReport.findUnique({
    where: { id: "06264d7e-5798-404a-a152-808a7050bfc5" },
    include: {
      project: true,
      createdBy: { select: { id: true, fullName: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  console.log(JSON.stringify({
    id: r?.id,
    approvalStatus: r?.approvalStatus,
    projectName: r?.project?.name,
    createdById: r?.createdById,
    createdBy: r?.createdBy?.fullName,
    itemCount: r?.items?.length,
    items: r?.items,
  }, null, 2));
  await p.$disconnect();
})();
