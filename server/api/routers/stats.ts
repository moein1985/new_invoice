import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

export const statsRouter = createTRPCRouter({
  // آمار کلی داشبورد
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const [
      totalCustomers,
      totalDocuments,
      pendingApprovals,
      totalUsers,
      recentDocuments,
      documentsByType,
      documentsByStatus,
      monthlyRevenue,
    ] = await Promise.all([
      // تعداد کل مشتریان
      ctx.prisma.customer.count({ where: { isActive: true } }),

      // تعداد کل اسناد
      ctx.prisma.document.count(),

      // تعداد تاییدیه‌های در انتظار (فقط پیش‌فاکتورهای موقت)
      ctx.prisma.document.count({
        where: { 
          approvalStatus: 'PENDING',
          documentType: 'TEMP_PROFORMA',
        },
      }),

      // تعداد کاربران (فقط برای Admin)
      ctx.session.user.role === 'ADMIN'
        ? ctx.prisma.user.count({ where: { isActive: true } })
        : 0,

      // آخرین اسناد
      ctx.prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          createdBy: { select: { fullName: true } },
        },
      }),

      // اسناد بر اساس نوع
      ctx.prisma.document.groupBy({
        by: ['documentType'],
        _count: { id: true },
      }),

      // اسناد بر اساس وضعیت تایید
      ctx.prisma.document.groupBy({
        by: ['approvalStatus'],
        _count: { id: true },
      }),

      // درآمد ماهانه (6 ماه اخیر)
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
    ]);

    return {
      summary: {
        totalCustomers,
        totalDocuments,
        pendingApprovals,
        totalUsers: ctx.session.user.role === 'ADMIN' ? totalUsers : undefined,
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
