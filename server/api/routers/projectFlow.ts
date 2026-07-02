import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
  getUserProjectIds,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const projectFlowRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        type: z.enum([
          'PROJECT_CREATED',
          'MEMBER_ADDED',
          'MEMBER_REMOVED',
          'EMPLOYER_ASSIGNED',
          'WORK_REPORT',
          'CONTRACTOR_DOC',
          'PURCHASE_REQUEST',
          'DOCUMENT',
          'TICKET',
        ]).optional(),
        status: z.enum(['IN_PROGRESS', 'COMPLETED', 'REJECTED', 'INFO']).optional(),
        includeHidden: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      // Check project access
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null && !projectIds.includes(input.projectId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی به این پروژه ندارید' });
      }

      const where: any = { projectId: input.projectId };

      if (input.type) {
        where.type = input.type;
      }

      if (input.status) {
        where.status = input.status;
      }

      // Non-managers never see hidden items
      const isManager = role === 'ADMIN' || role === 'MANAGER';
      if (!isManager || !input.includeHidden) {
        where.hidden = false;
      }

      return ctx.prisma.projectFlowItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, fullName: true, username: true } },
          hiddenBy: { select: { id: true, fullName: true } },
        },
      });
    }),

  stats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null && !projectIds.includes(input.projectId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی به این پروژه ندارید' });
      }

      const isManager = role === 'ADMIN' || role === 'MANAGER';

      const where = isManager ? { projectId: input.projectId } : { projectId: input.projectId, hidden: false };

      const [total, inProgress, completed, rejected, info] = await Promise.all([
        ctx.prisma.projectFlowItem.count({ where }),
        ctx.prisma.projectFlowItem.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        ctx.prisma.projectFlowItem.count({ where: { ...where, status: 'COMPLETED' } }),
        ctx.prisma.projectFlowItem.count({ where: { ...where, status: 'REJECTED' } }),
        ctx.prisma.projectFlowItem.count({ where: { ...where, status: 'INFO' } }),
      ]);

      const trackable = total - info;
      const progressPercent = trackable > 0 ? Math.round((completed / trackable) * 100) : 0;

      return { total, inProgress, completed, rejected, info, progressPercent };
    }),

  toggleHidden: managerProcedure
    .input(
      z.object({
        itemId: z.string().uuid(),
        hidden: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectFlowItem.update({
        where: { id: input.itemId },
        data: {
          hidden: input.hidden,
          hiddenById: input.hidden ? ctx.session.user.id : null,
          hiddenAt: input.hidden ? new Date() : null,
        },
      });
    }),
});
