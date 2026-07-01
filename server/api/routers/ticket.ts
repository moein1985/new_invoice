import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const ticketRouter = createTRPCRouter({
  // List tickets (role-based filtering)
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional().nullable(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {};

      if (input.status) where.status = input.status;
      if (input.priority) where.priority = input.priority;
      if (input.projectId) where.projectId = input.projectId;

      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: 'insensitive' } },
          { ticketNumber: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      // EMPLOYER: only tickets for their projects
      if (role === 'EMPLOYER') {
        where.project = { employerUserId: userId };
      }

      const [tickets, total] = await Promise.all([
        ctx.prisma.ticket.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true, role: true } },
            _count: { select: { replies: true, attachments: true } },
          },
        }),
        ctx.prisma.ticket.count({ where }),
      ]);

      return {
        data: tickets,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get ticket by ID (with access control)
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { id: true, name: true, code: true, employerUserId: true } },
          createdBy: { select: { id: true, fullName: true, role: true } },
          closedBy: { select: { id: true, fullName: true, role: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, fullName: true, role: true } },
            },
          },
          attachments: {
            orderBy: { createdAt: 'asc' },
            include: {
              uploadedBy: { select: { id: true, fullName: true } },
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'تیکت یافت نشد' });
      }

      // EMPLOYER: only their own projects
      if (role === 'EMPLOYER' && ticket.project.employerUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      return ticket;
    }),

  // Create ticket
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'عنوان الزامی است'),
        description: z.string().min(1, 'توضیحات الزامی است'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        projectId: z.string().uuid(),
        attachments: z.array(
          z.object({
            fileName: z.string(),
            filePath: z.string(),
            fileType: z.string(),
            fileSize: z.number(),
          })
        ).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, employerUserId: true, isActive: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'پروژه یافت نشد' });
      }

      // EMPLOYER: only their own projects
      if (role === 'EMPLOYER' && project.employerUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'شما فقط می‌توانید برای پروژه‌های خود تیکت ثبت کنید' });
      }

      // Generate ticket number: TKT-1405-000001
      const now = new Date();
      const jYear = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric' }).format(now);
      const lastTicket = await ctx.prisma.ticket.findFirst({
        where: { ticketNumber: { startsWith: `TKT-${jYear}` } },
        orderBy: { ticketNumber: 'desc' },
      });
      let seq = 1;
      if (lastTicket) {
        const parts = lastTicket.ticketNumber.split('-');
        seq = parseInt(parts[2], 10) + 1;
      }
      const ticketNumber = `TKT-${jYear}-${String(seq).padStart(6, '0')}`;

      const ticket = await ctx.prisma.ticket.create({
        data: {
          ticketNumber,
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: 'OPEN',
          projectId: input.projectId,
          createdById: userId,
          attachments: input.attachments.length > 0 ? {
            create: input.attachments.map((att) => ({
              fileName: att.fileName,
              filePath: att.filePath,
              fileType: att.fileType,
              fileSize: att.fileSize,
              uploadedById: userId,
            })),
          } : undefined,
        },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      // Non-blocking notification to managers
      try {
        const managers = await ctx.prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
          select: { id: true },
        });
        if (managers.length > 0) {
          await ctx.prisma.notification.createMany({
            data: managers.map((m) => ({
              userId: m.id,
              title: `تیکت جدید: ${input.title}`,
              message: `تیکت ${ticketNumber} برای پروژه ${ticket.project.name} ثبت شد`,
              type: 'TICKET_CREATED',
              link: `/tickets/${ticket.id}`,
            })),
          });
        }
      } catch (notifError) {
        console.error('[ticket.create] Notification failed (non-blocking):', notifError);
      }

      return ticket;
    }),

  // Add reply to ticket
  addReply: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1, 'متن پاسخ الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, status: true, createdById: true },
        include: { project: { select: { employerUserId: true } } },
      });

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'تیکت یافت نشد' });
      }

      // EMPLOYER: only their own projects
      if (role === 'EMPLOYER' && ticket.project.employerUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      if (ticket.status === 'CLOSED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'تیکت بسته شده است' });
      }

      const reply = await ctx.prisma.ticketReply.create({
        data: {
          ticketId: input.ticketId,
          content: input.content,
          userId,
        },
        include: {
          user: { select: { id: true, fullName: true, role: true } },
        },
      });

      // Non-blocking notification
      try {
        const notifyUserId = role === 'EMPLOYER' ? null : ticket.createdById;
        if (role !== 'EMPLOYER' && notifyUserId) {
          await ctx.prisma.notification.create({
            data: {
              userId: notifyUserId,
              title: 'پاسخ جدید به تیکت',
              message: `پاسخ جدید به تیکت ثبت شد`,
              type: 'TICKET_REPLY',
              link: `/tickets/${ticket.id}`,
            },
          });
        } else if (role === 'EMPLOYER') {
          const managers = await ctx.prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
            select: { id: true },
          });
          if (managers.length > 0) {
            await ctx.prisma.notification.createMany({
              data: managers.map((m) => ({
                userId: m.id,
                title: 'پاسخ جدید به تیکت',
                message: `کارفرما به تیکت پاسخ داد`,
                type: 'TICKET_REPLY',
                link: `/tickets/${ticket.id}`,
              })),
            });
          }
        }
      } catch (notifError) {
        console.error('[ticket.addReply] Notification failed (non-blocking):', notifError);
      }

      return reply;
    }),

  // Add attachment to ticket
  addAttachment: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        fileName: z.string(),
        filePath: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: input.ticketId },
        select: { id: true, status: true },
        include: { project: { select: { employerUserId: true } } },
      });

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'تیکت یافت نشد' });
      }

      if (role === 'EMPLOYER' && ticket.project.employerUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      if (ticket.status === 'CLOSED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'تیکت بسته شده است' });
      }

      return ctx.prisma.ticketAttachment.create({
        data: {
          ticketId: input.ticketId,
          fileName: input.fileName,
          filePath: input.filePath,
          fileType: input.fileType,
          fileSize: input.fileSize,
          uploadedById: userId,
        },
      });
    }),

  // Update ticket status (manager/admin only)
  updateStatus: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const updateData: any = {
        status: input.status,
      };

      if (input.status === 'CLOSED') {
        updateData.closedById = userId;
        updateData.closedAt = new Date();
      }

      const updated = await ctx.prisma.ticket.update({
        where: { id: input.id },
        data: updateData,
      });

      // Non-blocking notification to employer
      try {
        const ticket = await ctx.prisma.ticket.findUnique({
          where: { id: input.id },
          select: { id: true, createdById: true, project: { select: { employerUserId: true } } },
        });
        if (ticket?.project.employerUserId) {
          const statusLabels: Record<string, string> = {
            OPEN: 'باز',
            IN_PROGRESS: 'در حال بررسی',
            RESOLVED: 'حل‌شده',
            CLOSED: 'بسته‌شده',
          };
          await ctx.prisma.notification.create({
            data: {
              userId: ticket.project.employerUserId,
              title: 'تغییر وضعیت تیکت',
              message: `وضعیت تیکت به «${statusLabels[input.status]}» تغییر یافت`,
              type: 'TICKET_STATUS_CHANGED',
              link: `/tickets/${ticket.id}`,
            },
          });
        }
      } catch (notifError) {
        console.error('[ticket.updateStatus] Notification failed (non-blocking):', notifError);
      }

      return updated;
    }),

  // Close ticket (employer or manager/admin)
  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
        include: { project: { select: { employerUserId: true } } },
      });

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'تیکت یافت نشد' });
      }

      // EMPLOYER: only their own projects
      if (role === 'EMPLOYER' && ticket.project.employerUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      if (ticket.status === 'CLOSED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'تیکت قبلاً بسته شده است' });
      }

      return ctx.prisma.ticket.update({
        where: { id: input.id },
        data: {
          status: 'CLOSED',
          closedById: userId,
          closedAt: new Date(),
        },
      });
    }),

  // Delete ticket (manager/admin only)
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ticket.delete({ where: { id: input.id } });
    }),

  // Ticket stats for dashboard
  stats: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    const where: any = {};
    if (role === 'EMPLOYER') {
      where.project = { employerUserId: userId };
    }

    const [byStatus, total, recent] = await Promise.all([
      ctx.prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      ctx.prisma.ticket.count({ where }),
      ctx.prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return { byStatus, total, recent };
    }),

  // List employer's projects (for employer role)
  myProjects: protectedProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    if (role !== 'EMPLOYER') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط کارفرما' });
    }

    return ctx.prisma.project.findMany({
      where: { employerUserId: userId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }),
});
