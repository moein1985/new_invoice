import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
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

      // Contractors only see projects they are members of
      if (role === 'CONTRACTOR') {
        where.members = { some: { userId } };
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
          _count: { select: { workReports: true } },
        },
      });

      if (!project) {
        throw new Error('پروژه یافت نشد');
      }

      // Contractors can only see their own projects
      if (role === 'CONTRACTOR') {
        const isMember = project.members.some((m: any) => m.userId === userId);
        if (!isMember) {
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

      return ctx.prisma.project.create({
        data: {
          name: input.name,
          code,
          description: input.description,
          address: input.address,
          employerName: input.employerName,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        },
      });
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
      return ctx.prisma.projectMember.create({
        data: {
          projectId: input.projectId,
          userId: input.userId,
        },
      });
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
      return ctx.prisma.projectMember.deleteMany({
        where: {
          projectId: input.projectId,
          userId: input.userId,
        },
      });
    }),

  // List contractors for member assignment
  listContractors: managerProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      where: { role: 'CONTRACTOR', isActive: true },
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

      if (role === 'CONTRACTOR') {
        const isMember = await ctx.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: input.id, userId } },
        });
        if (!isMember) {
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
});
