import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
  projectAdminProcedure,
  getUserProjectIds,
  isSuperuser,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const workReportRouter = createTRPCRouter({
  // List work reports for a project
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = { projectId: input.projectId };

      // Contractors and Technical only see their own reports
      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        where.createdById = userId;
      }

      const [reports, total] = await Promise.all([
        ctx.prisma.workReport.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { reportDate: 'desc' },
          include: {
            createdBy: { select: { id: true, fullName: true } },
            project: { select: { id: true, name: true, code: true } },
            _count: { select: { items: true } },
          },
        }),
        ctx.prisma.workReport.count({ where }),
      ]);

      return {
        data: reports,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // List work reports for the current user (contractor sees own, manager sees all)
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        dateFrom: z.string().optional().nullable(),
        dateTo: z.string().optional().nullable(),
        search: z.string().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const where: any = {};
      // Contractors and Technical only see their own reports
      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        where.createdById = userId;
      }
      // Project-scoped users (ADMIN, USER) only see reports for their projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          return { data: [], meta: { page: input.page, limit: input.limit, total: 0, totalPages: 0 } };
        }
        where.projectId = { in: projectIds };
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }
      if (input.dateFrom || input.dateTo) {
        where.reportDate = {} as any;
        if (input.dateFrom) (where.reportDate as any).gte = new Date(input.dateFrom);
        if (input.dateTo) (where.reportDate as any).lte = new Date(input.dateTo);
      }
      if (input.search) {
        where.items = { some: { description: { contains: input.search, mode: 'insensitive' } } } as any;
      }

      const [reports, total] = await Promise.all([
        ctx.prisma.workReport.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { reportDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            items: { select: { totalPrice: true } },
          },
        }),
        ctx.prisma.workReport.count({ where }),
      ]);

      return {
        data: reports.map((r) => ({
          ...r,
          totalAmount: r.items.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // List all work reports across all projects (managers, project admins, superuser)
  listAll: projectAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional().nullable(),
        approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {};
      if (input.approvalStatus) {
        where.approvalStatus = input.approvalStatus;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }
      // Project-scoped users only see reports for their projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          return { data: [], meta: { page: input.page, limit: input.limit, total: 0, totalPages: 0 } };
        }
        where.projectId = { in: projectIds };
      }
      if (input.search) {
        where.OR = [
          { reportNumber: { contains: input.search, mode: 'insensitive' } },
          { project: { name: { contains: input.search, mode: 'insensitive' } } },
          { createdBy: { fullName: { contains: input.search, mode: 'insensitive' } } },
        ];
      }

      const [reports, total] = await Promise.all([
        ctx.prisma.workReport.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { reportDate: 'desc' },
          include: {
            createdBy: { select: { id: true, fullName: true } },
            project: { select: { id: true, name: true, code: true } },
            _count: { select: { items: true } },
          },
        }),
        ctx.prisma.workReport.count({ where }),
      ]);

      return {
        data: reports,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get a single work report by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const report = await ctx.prisma.workReport.findUnique({
        where: { id: input.id },
        include: {
          project: true,
          createdBy: { select: { id: true, fullName: true } },
          items: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      // Project-scoped users: check access via project membership
      if (role !== 'MANAGER' && !isSuperuser(ctx.session.user.username)) {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null) {
          if (!projectIds.includes(report.projectId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این گزارش ندارید' });
          }
        }
      }
      // Contractors and Technical can only see their own reports
      if ((role === 'CONTRACTOR' || role === 'TECHNICAL') && report.createdById !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این گزارش ندارید' });
      }

      return report;
    }),

  // Create a new work report (any authenticated user who is project member)
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z.array(
          z.object({
            description: z.string().min(1, 'شرح الزامی است'),
            unit: z.string().min(1),
            quantity: z.number().min(0),
          })
        ).min(1, 'حداقل یک آیتم الزامی است'),
        notes: z.string().optional().nullable(),
        reportDate: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      // Verify user is member of project (for project-scoped roles) or is manager/superuser
      if (role !== 'MANAGER' && !isSuperuser(ctx.session.user.username)) {
        const membership = await ctx.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: input.projectId, userId } },
        });
        const isEmployer = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, employerUserId: userId },
        });
        if (!membership && !isEmployer) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما عضو این پروژه نیستید' });
        }
      }

      // Generate report number: WR-YYYY-NNNN
      const year = new Date().getFullYear();
      const lastReport = await ctx.prisma.workReport.findFirst({
        where: { reportNumber: { startsWith: `WR-${year}-` } },
        orderBy: { reportNumber: 'desc' },
      });

      let seq = 1;
      if (lastReport) {
        const parts = lastReport.reportNumber.split('-');
        seq = parseInt(parts[2], 10) + 1;
      }
      const reportNumber = `WR-${year}-${seq.toString().padStart(4, '0')}`;

      // Save new description texts to the suggestions table
      for (const item of input.items) {
        await ctx.prisma.workDescription.upsert({
          where: { text: item.description },
          update: { usageCount: { increment: 1 } },
          create: { text: item.description },
        });
      }

      const created = await ctx.prisma.workReport.create({
        data: {
          reportNumber,
          projectId: input.projectId,
          createdById: userId,
          notes: input.notes,
          reportDate: input.reportDate ? new Date(input.reportDate) : new Date(),
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: 0,
              totalPrice: 0,
            })),
          },
        },
        include: {
          items: true,
          project: { select: { name: true } },
        },
      });

      // Notify managers and project admins about new work report
      const managers = await ctx.prisma.user.findMany({
        where: { isActive: true, role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true },
      });

      if (managers.length > 0) {
        await ctx.prisma.notification.createMany({
          data: managers.map((manager) => ({
            userId: manager.id,
            type: 'WORK_REPORT_SUBMITTED',
            title: 'گزارش کار جدید',
            message: `گزارش ${reportNumber} برای پروژه ${created.project.name} ثبت شد`,
            link: `/projects/${input.projectId}/reports/${created.id}`,
          })),
        });
      }

      // Audit log
      await ctx.prisma.workReportAudit.create({
        data: {
          workReportId: created.id,
          userId,
          action: 'CREATED',
        },
      });

      return created;
    }),

  // Update work report (contractor can update before approval, manager can always update)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        items: z.array(
          z.object({
            id: z.string().uuid().optional().nullable(), // existing item or null for new
            description: z.string().min(1),
            unit: z.string().min(1),
            quantity: z.number().min(0),
            unitPrice: z.number().min(0).optional(),
          })
        ).min(1),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const report = await ctx.prisma.workReport.findUnique({
        where: { id: input.id },
      });

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      // Contractors and Technical can only edit their own reports that are not yet approved
      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        if (report.createdById !== userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این گزارش ندارید' });
        }
        if (report.approvalStatus === 'APPROVED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'گزارش تایید شده قابل ویرایش نیست' });
        }
      }

      // Project-scoped ADMIN: verify project access
      if (role === 'ADMIN' && !isSuperuser(ctx.session.user.username)) {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null && !projectIds.includes(report.projectId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این گزارش ندارید' });
        }
      }

      // Save new description texts
      for (const item of input.items) {
        await ctx.prisma.workDescription.upsert({
          where: { text: item.description },
          update: { usageCount: { increment: 1 } },
          create: { text: item.description },
        });
      }

      // Determine if manager/superuser is setting prices
      const isManager = role === 'MANAGER' || isSuperuser(ctx.session.user.username) || role === 'ADMIN';

      // Delete old items and recreate
      await ctx.prisma.workReportItem.deleteMany({ where: { workReportId: input.id } });

      const items = input.items.map((item) => {
        const unitPrice = isManager && item.unitPrice !== undefined ? item.unitPrice : 0;
        return {
          workReportId: input.id,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        };
      });

      await ctx.prisma.workReportItem.createMany({ data: items });

      // Recalculate total
      const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);

      // If contractor/technical edits a rejected report, reset to PENDING
      const newStatus = (role === 'CONTRACTOR' || role === 'TECHNICAL') && report.approvalStatus === 'REJECTED'
        ? 'PENDING' as const
        : report.approvalStatus;

      return ctx.prisma.workReport.update({
        where: { id: input.id },
        data: {
          totalAmount,
          notes: input.notes,
          approvalStatus: newStatus,
        },
        include: { items: true, project: true },
      }).then(async (updated) => {
        await ctx.prisma.workReportAudit.create({
          data: {
            workReportId: input.id,
            userId,
            action: isManager ? 'PRICED' : 'UPDATED',
          },
        });
        return updated;
      });
    }),

  // Approve work report (manager, project admin, or superuser)
  approve: projectAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.prisma.workReport.findUnique({ where: { id: input.id } });
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      const updated = await ctx.prisma.workReport.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'APPROVED',
          rejectionReason: null,
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'WORK_REPORT_APPROVED',
          title: 'گزارش کار تایید شد',
          message: `گزارش ${report.reportNumber} تایید شد`,
          link: `/projects/${report.projectId}/reports/${report.id}`,
        },
      });

      await ctx.prisma.workReportAudit.create({
        data: {
          workReportId: input.id,
          userId: ctx.session.user.id,
          action: 'APPROVED',
        },
      });

      return updated;
    }),

  // Reject work report (manager, project admin, or superuser)
  reject: projectAdminProcedure
    .input(z.object({ id: z.string().uuid(), comment: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.prisma.workReport.findUnique({ where: { id: input.id } });
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      const updated = await ctx.prisma.workReport.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: input.comment || null,
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'WORK_REPORT_REJECTED',
          title: 'گزارش کار رد شد',
          message: `گزارش ${report.reportNumber} رد شد${input.comment ? `: ${input.comment}` : ''}`,
          link: `/projects/${report.projectId}/reports/${report.id}`,
        },
      });

      await ctx.prisma.workReportAudit.create({
        data: {
          workReportId: input.id,
          userId: ctx.session.user.id,
          action: 'REJECTED',
          changes: input.comment || null,
        },
      });

      return updated;
    }),

  // Delete work report
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const report = await ctx.prisma.workReport.findUnique({ where: { id: input.id } });
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      // Contractors and Technical can only delete their own non-approved reports
      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        if (report.createdById !== userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی ندارید' });
        }
        if (report.approvalStatus === 'APPROVED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'گزارش تایید شده قابل حذف نیست' });
        }
      }

      // Project-scoped ADMIN: verify project access
      if (role === 'ADMIN' && !isSuperuser(ctx.session.user.username)) {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null && !projectIds.includes(report.projectId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی ندارید' });
        }
      }

      return ctx.prisma.workReport.delete({ where: { id: input.id } });
    }),

  // Search work description suggestions
  searchDescriptions: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workDescription.findMany({
        where: { text: { contains: input.query, mode: 'insensitive' } },
        orderBy: { usageCount: 'desc' },
        take: 10,
      });
    }),

  // Pending work reports count for badge (manager, project admin, superuser)
  pendingCount: projectAdminProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    const where: any = { approvalStatus: 'PENDING' };
    // Project-scoped users only count pending for their projects
    const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
    if (projectIds !== null) {
      if (projectIds.length === 0) return 0;
      where.projectId = { in: projectIds };
    }
    return ctx.prisma.workReport.count({ where });
  }),

  // List audit log for a work report
  listAudit: protectedProcedure
    .input(z.object({ workReportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;
      if (role !== 'MANAGER' && !isSuperuser(ctx.session.user.username) && role !== 'ADMIN') {
        const report = await ctx.prisma.workReport.findUnique({
          where: { id: input.workReportId },
          select: { createdById: true },
        });
        if (report?.createdById !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
      }
      return ctx.prisma.workReportAudit.findMany({
        where: { workReportId: input.workReportId },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }),
});
