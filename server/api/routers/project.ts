import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
  getUserProjectIds,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const projectRouter = createTRPCRouter({
  // List all projects (managers see all, contractors see their own)
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional().nullable(),
        activeOnly: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {};

      if (input.activeOnly) {
        where.isActive = true;
      }

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { code: { contains: input.search, mode: 'insensitive' } },
          { employerName: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      // Project-scoped users only see their own projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          return { data: [], meta: { page: input.page, limit: input.limit, total: 0, totalPages: 0 } };
        }
        where.id = { in: projectIds };
      }

      const [projects, total] = await Promise.all([
        ctx.prisma.project.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            members: {
              include: {
                user: { select: { id: true, fullName: true, role: true } },
              },
            },
            _count: { select: { workReports: true } },
          },
        }),
        ctx.prisma.project.count({ where }),
      ]);

      return {
        data: projects,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get project by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, role: true, username: true } },
            },
          },
          employerUser: { select: { id: true, fullName: true, username: true } },
          _count: { select: { workReports: true } },
        },
      });

      if (!project) {
        throw new Error('پروژه یافت نشد');
      }

      // Project-scoped users can only see their own projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        const isMember = project.id && projectIds.includes(project.id);
        const isEmployer = project.employerUserId === userId;
        if (!isMember && !isEmployer) {
          throw new Error('شما دسترسی به این پروژه ندارید');
        }
      }

      return project;
    }),

  // Create project (manager/admin only)
  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(1, 'نام پروژه الزامی است'),
        description: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        employerName: z.string().optional().nullable(),
        employerUserId: z.string().uuid().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate project code: PRJ-YYYY-NNNN
      const year = new Date().getFullYear();
      const lastProject = await ctx.prisma.project.findFirst({
        where: { code: { startsWith: `PRJ-${year}-` } },
        orderBy: { code: 'desc' },
      });

      let seq = 1;
      if (lastProject) {
        const parts = lastProject.code.split('-');
        seq = parseInt(parts[2], 10) + 1;
      }
      const code = `PRJ-${year}-${seq.toString().padStart(4, '0')}`;

      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          code,
          description: input.description,
          address: input.address,
          employerName: input.employerName,
          employerUserId: input.employerUserId || undefined,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        },
      });

      await ctx.prisma.projectFlowItem.create({
        data: {
          projectId: project.id,
          type: 'PROJECT_CREATED',
          title: 'پروژه ایجاد شد',
          status: 'INFO',
          createdById: ctx.session.user.id,
        },
      });

      return project;
    }),

  // Update project (manager/admin only)
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        employerName: z.string().optional().nullable(),
        employerUserId: z.string().uuid().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, startDate, endDate, ...rest } = input;
      return ctx.prisma.project.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        },
      });
    }),

  // Add member to project (manager/admin only)
  addMember: managerProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
        },
        include: { user: { select: { fullName: true, role: true } } },
      });

      const roleLabels: Record<string, string> = {
        ADMIN: 'مدیر پروژه',
        TECHNICAL: 'فنی',
        CONTRACTOR: 'پیمانکار',
        USER: 'کاربر',
        MANAGER: 'مسئول سیستم',
        EMPLOYER: 'کارفرما',
      };

      await ctx.prisma.projectFlowItem.create({
        data: {
          projectId: input.projectId,
          type: 'MEMBER_ADDED',
          referenceId: input.userId,
          title: `عضو اضافه شد: ${member.user.fullName} (${roleLabels[member.user.role] || member.user.role})`,
          status: 'INFO',
          createdById: ctx.session.user.id,
        },
      });

      return member;
    }),

  // Remove member from project (manager/admin only)
  removeMember: managerProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.findFirst({
        where: { projectId: input.projectId, userId: input.userId },
        include: { user: { select: { fullName: true } } },
      });

      await ctx.prisma.projectMember.deleteMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
        },
      });

      if (member) {
        await ctx.prisma.projectFlowItem.create({
          data: {
            projectId: input.projectId,
            type: 'MEMBER_REMOVED',
            referenceId: input.userId,
            title: `عضو حذف شد: ${member.user.fullName}`,
            status: 'INFO',
            createdById: ctx.session.user.id,
          },
        });
      }

      return { success: true };
    }),

  // List contractors for member assignment
  listContractors: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'CONTRACTOR', isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }),

  // List technical staff for member assignment
  listTechnical: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'TECHNICAL', isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }),

  // List users for member assignment
  listUsers: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'USER', isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }),

  // List admins (project supervisors) for member assignment
  listAdmins: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }),

  // Delete project (manager/admin only)
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.delete({ where: { id: input.id } });
    }),

  // Get project financial summary
  getSummary: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'پروژه یافت نشد' });
      }

      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        const hasAccess = projectIds.includes(input.id);
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی ندارید' });
        }
      }

      const [workReports, contractorDocs, purchases] = await Promise.all([
        ctx.prisma.workReport.groupBy({
          by: ['approvalStatus'],
          where: { projectId: input.id },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        ctx.prisma.contractorDoc.groupBy({
          by: ['approvalStatus'],
          where: { projectId: input.id },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        ctx.prisma.purchaseRequest.groupBy({
          by: ['status'],
          where: { projectId: input.id },
          _count: { _all: true },
        }),
      ]);

      const approvedPurchases = await ctx.prisma.purchaseRequest.findMany({
        where: { projectId: input.id, status: { in: ['APPROVED', 'PURCHASED'] } },
        select: { approvedInquiry: { select: { totalPrice: true } } },
      });
      const totalPurchaseAmount = approvedPurchases.reduce(
        (sum, p) => sum + (p.approvedInquiry?.totalPrice || 0),
        0
      );

      return { workReports, contractorDocs, purchases, totalPurchaseAmount };
    }),

  // List employers for assignment (manager/admin only)
  listEmployers: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'EMPLOYER', isActive: true },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }),

  // Assign employer to project (manager/admin only)
  assignEmployer: managerProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { employerUserId: input.userId },
        include: { employerUser: { select: { fullName: true } } },
      });

      await ctx.prisma.projectFlowItem.create({
        data: {
          projectId: input.projectId,
          type: 'EMPLOYER_ASSIGNED',
          referenceId: input.userId,
          title: `کارفرما اختصاص یافت: ${result.employerUser?.fullName || ''}`,
          status: 'INFO',
          createdById: ctx.session.user.id,
        },
      });

      return result;
    }),

  // Remove employer from project (manager/admin only)
  removeEmployer: managerProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { employerUserId: null },
      });
    }),
});
