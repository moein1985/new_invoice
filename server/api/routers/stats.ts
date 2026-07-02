import { createTRPCRouter, protectedProcedure, getUserProjectIds, isSuperuser } from '@/server/api/trpc';

export const statsRouter = createTRPCRouter({
  // آمار کلی داشبورد
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    // Project-scoped users get filtered stats
    const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
    const isGlobal = projectIds === null;

    // For project-scoped users, we filter work reports and contractor docs by project
    // Documents remain global (no projectId on Document model)
    const projectFilter = projectIds !== null && projectIds.length > 0
      ? { projectId: { in: projectIds } }
      : null;

    const [
      totalCustomers,
      totalDocuments,
      pendingApprovals,
      totalUsers,
      recentDocuments,
      documentsByType,
      documentsByStatus,
      monthlyRevenue,
      projectStats,
    ] = await Promise.all([
      ctx.prisma.customer.count({ where: { isActive: true } }),

      ctx.prisma.document.count(),

      ctx.prisma.document.count({
        where: {
          approvalStatus: 'PENDING',
          documentType: 'TEMP_PROFORMA',
        },
      }),

      // Only superuser and MANAGER see user count
      (role === 'MANAGER' || isSuperuser(ctx.session.user.username))
        ? ctx.prisma.user.count({ where: { isActive: true } })
        : 0,

      ctx.prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          createdBy: { select: { fullName: true } },
        },
      }),

      ctx.prisma.document.groupBy({
        by: ['documentType'],
        _count: { id: true },
      }),

      ctx.prisma.document.groupBy({
        by: ['approvalStatus'],
        _count: { id: true },
      }),

      ctx.prisma.$queryRaw<
        Array<{ month: string; total: number; count: number }>
      >`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "issueDate"), 'YYYY-MM') as month,
          SUM("finalAmount")::numeric as total,
          COUNT(*)::integer as count
        FROM documents
        WHERE "issueDate" >= NOW() - INTERVAL '6 months'
          AND "documentType" IN ('INVOICE', 'PROFORMA')
        GROUP BY DATE_TRUNC('month', "issueDate")
        ORDER BY month DESC
        LIMIT 6
      `,

      // Project-scoped stats for non-global users
      !isGlobal && projectFilter
        ? Promise.all([
            ctx.prisma.workReport.count({ where: { ...projectFilter, approvalStatus: 'PENDING' } }),
            ctx.prisma.workReport.count({ where: projectFilter }),
            ctx.prisma.contractorDoc.count({ where: { ...projectFilter, approvalStatus: 'PENDING' } }),
            ctx.prisma.contractorDoc.count({ where: projectFilter }),
            ctx.prisma.purchaseRequest.count({ where: { ...projectFilter, status: 'INQUIRED' } }),
            ctx.prisma.purchaseRequest.count({ where: projectFilter }),
            ctx.prisma.project.count({ where: { id: { in: projectIds! } } }),
          ])
        : null,
    ]);

    return {
      summary: {
        totalCustomers,
        totalDocuments,
        pendingApprovals,
        totalUsers: (role === 'MANAGER' || isSuperuser(ctx.session.user.username)) ? totalUsers : undefined,
        // Project-scoped stats
        pendingWorkReports: projectStats?.[0] ?? undefined,
        totalWorkReports: projectStats?.[1] ?? undefined,
        pendingContractorDocs: projectStats?.[2] ?? undefined,
        totalContractorDocs: projectStats?.[3] ?? undefined,
        pendingPurchases: projectStats?.[4] ?? undefined,
        totalPurchases: projectStats?.[5] ?? undefined,
        totalProjects: projectStats?.[6] ?? undefined,
      },
      recentDocuments: recentDocuments.map((doc) => ({
        id: doc.id,
        documentNumber: doc.documentNumber,
        documentType: doc.documentType,
        customerName: doc.customer.name,
        finalAmount: doc.finalAmount,
        approvalStatus: doc.approvalStatus,
        issueDate: doc.issueDate,
        createdBy: doc.createdBy.fullName,
      })),
      charts: {
        documentsByType: documentsByType.map((item) => ({
          type: item.documentType,
          count: item._count.id,
        })),
        documentsByStatus: documentsByStatus.map((item) => ({
          status: item.approvalStatus,
          count: item._count.id,
        })),
        monthlyRevenue: monthlyRevenue.map((item) => ({
          month: item.month,
          total: Number(item.total),
          count: item.count,
        })),
      },
    };
  }),

  // آمار مشتریان برتر
  getTopCustomers: protectedProcedure.query(async ({ ctx }) => {
    const topCustomers = await ctx.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        code: string;
        totalAmount: number;
        documentCount: number;
      }>
    >`
      SELECT 
        c.id,
        c.name,
        c.code,
        COALESCE(SUM(d."finalAmount"), 0)::numeric as "totalAmount",
        COUNT(d.id)::integer as "documentCount"
      FROM customers c
      LEFT JOIN documents d ON d."customerId" = c.id
      WHERE c."isActive" = true
      GROUP BY c.id, c.name, c.code
      ORDER BY "totalAmount" DESC
      LIMIT 10
    `;

    return topCustomers.map((customer) => ({
      ...customer,
      totalAmount: Number(customer.totalAmount),
    }));
  }),
});
