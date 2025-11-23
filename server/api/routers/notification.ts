import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const notificationRouter = createTRPCRouter({
  // Get user's notifications
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input.unreadOnly ? { isRead: false } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: input.limit,
      });

      return notifications;
    }),

  // Get unread count
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await prisma.notification.count({
      where: {
        userId: ctx.session.user.id,
        isRead: false,
      },
    });

    return { count };
  }),

  // Mark as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await prisma.notification.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!notification) {
        throw new Error('نوتیفیکیشن یافت نشد');
      }

      await prisma.notification.update({
        where: { id: input.id },
        data: { isRead: true },
      });

      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({
      where: {
        userId: ctx.session.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }),

  // Delete notification
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await prisma.notification.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });

      if (!notification) {
        throw new Error('نوتیفیکیشن یافت نشد');
      }

      await prisma.notification.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // Create notification (admin only or system)
  create: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        type: z.enum([
          'INFO',
          'SUCCESS',
          'WARNING',
          'ERROR',
          'APPROVAL_REQUEST',
          'APPROVAL_APPROVED',
          'APPROVAL_REJECTED',
          'DOCUMENT_CREATED',
          'DOCUMENT_UPDATED',
          'SYSTEM',
        ]),
        title: z.string(),
        message: z.string(),
        link: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const notification = await prisma.notification.create({
        data: input,
      });

      return notification;
    }),
});
