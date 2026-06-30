import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { getHolidaysForJalaliMonth } from '@/lib/services/holidays';

export const calendarRouter = createTRPCRouter({
  // Get events for a date range
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await prisma.calendarEvent.findMany({
        where: {
          userId: ctx.session.user.id,
          startDate: {
            lte: input.endDate,
          },
          OR: [
            { endDate: { gte: input.startDate } },
            { endDate: null, startDate: { gte: input.startDate } },
          ],
        },
        orderBy: { startDate: 'asc' },
      });
      return events;
    }),

  // Get single event
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const event = await prisma.calendarEvent.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
      });
      if (!event) throw new Error('رویداد یافت نشد');
      return event;
    }),

  // Create event
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'عنوان الزامی است'),
        description: z.string().optional().nullable(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().optional().nullable(),
        allDay: z.boolean().default(true),
        color: z.string().default('#3b82f6'),
        reminderMinutes: z.number().int().min(0).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.calendarEvent.create({
        data: {
          userId: ctx.session.user.id,
          title: input.title,
          description: input.description,
          startDate: input.startDate,
          endDate: input.endDate,
          allDay: input.allDay,
          color: input.color,
          reminderMinutes: input.reminderMinutes,
        },
      });
      return event;
    }),

  // Update event
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional().nullable(),
        allDay: z.boolean().optional(),
        color: z.string().optional(),
        reminderMinutes: z.number().int().min(0).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.calendarEvent.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!existing) throw new Error('رویداد یافت نشد');

      const { id, ...data } = input;

      // If reminder changed, reset reminderSent
      const resetReminder =
        input.reminderMinutes !== undefined &&
        input.reminderMinutes !== existing.reminderMinutes;

      const event = await prisma.calendarEvent.update({
        where: { id },
        data: {
          ...data,
          ...(resetReminder ? { reminderSent: false } : {}),
        },
      });
      return event;
    }),

  // Delete event
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.calendarEvent.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!existing) throw new Error('رویداد یافت نشد');

      await prisma.calendarEvent.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Check and send reminders (called periodically)
  processReminders: protectedProcedure.mutation(async () => {
    const now = new Date();

    // Find events that need reminders
    const events = await prisma.calendarEvent.findMany({
      where: {
        reminderSent: false,
        reminderMinutes: { not: null },
      },
      include: { user: true },
    });

    let sentCount = 0;

    for (const event of events) {
      if (event.reminderMinutes === null) continue;

      const reminderTime = new Date(
        event.startDate.getTime() - event.reminderMinutes * 60 * 1000
      );

      if (now >= reminderTime) {
        // Create notification
        await prisma.notification.create({
          data: {
            userId: event.userId,
            type: 'CALENDAR_REMINDER',
            title: `یادآوری: ${event.title}`,
            message: event.description || `رویداد "${event.title}" به زودی شروع می‌شود`,
            link: '/calendar',
          },
        });

        // Mark as sent
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { reminderSent: true },
        });

        sentCount++;
      }
    }

    return { sent: sentCount };
  }),

  // Get Iranian holidays for a Jalali month
  holidays: protectedProcedure
    .input(
      z.object({
        jYear: z.number().int().min(1300).max(1500),
        jMonth: z.number().int().min(0).max(11),
      })
    )
    .query(({ input }) => {
      return getHolidaysForJalaliMonth(input.jYear, input.jMonth);
    }),
});
