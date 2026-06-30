import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const purchaseRouter = createTRPCRouter({
  // List purchase requests
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['DRAFT', 'PENDING_INQUIRY', 'INQUIRED', 'APPROVED', 'REJECTED', 'PURCHASED']).optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().nullable(),
        search: z.string().optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {};

      // USER only sees assigned requests
      if (role === 'USER') {
        where.assignedToId = userId;
      }

      if (input.status) where.status = input.status;
      if (input.priority) where.priority = input.priority;
      if (input.projectId) where.projectId = input.projectId;

      if (input.search) {
        where.OR = [
          { requestNumber: { contains: input.search, mode: 'insensitive' } },
          { title: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const [requests, total] = await Promise.all([
        ctx.prisma.purchaseRequest.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            assignedTo: { select: { id: true, fullName: true } },
            _count: { select: { items: true, inquiries: true } },
          },
        }),
        ctx.prisma.purchaseRequest.count({ where }),
      ]);

      return {
        data: requests,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get single purchase request with all details
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
          items: { orderBy: { createdAt: 'asc' } },
          inquiries: {
            orderBy: { createdAt: 'desc' },
            include: {
              createdBy: { select: { id: true, fullName: true } },
              items: {
                include: {
                  purchaseItem: { select: { id: true, productName: true, quantity: true, unit: true } },
                },
              },
              attachments: true,
            },
          },
          approvedInquiry: {
            select: { id: true, supplierName: true, totalPrice: true },
          },
        },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      // USER can only view assigned requests
      if (role === 'USER' && request.assignedToId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      return request;
    }),

  // Create purchase request (ADMIN/MANAGER only)
  create: managerProcedure
    .input(
      z.object({
        title: z.string().min(1, 'عنوان الزامی است'),
        description: z.string().optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        projectId: z.string().uuid().optional().nullable(),
        assignedToId: z.string().uuid().optional().nullable(),
        deadline: z.string().optional().nullable(),
        voiceNote: z.string().optional().nullable(),
        items: z.array(
          z.object({
            productName: z.string().min(1),
            description: z.string().optional().nullable(),
            quantity: z.number().positive(),
            unit: z.string().min(1),
            estimatedPrice: z.number().optional().nullable(),
          })
        ).min(1, 'حداقل یک قلم الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Generate request number: PR-1405-000001
      const now = new Date();
      const jYear = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric' }).format(now);
      const lastReq = await ctx.prisma.purchaseRequest.findFirst({
        where: { requestNumber: { startsWith: `PR-${jYear}` } },
        orderBy: { requestNumber: 'desc' },
      });
      let seq = 1;
      if (lastReq) {
        const parts = lastReq.requestNumber.split('-');
        seq = parseInt(parts[2], 10) + 1;
      }
      const requestNumber = `PR-${jYear}-${String(seq).padStart(6, '0')}`;

      const status = input.assignedToId ? 'PENDING_INQUIRY' : 'DRAFT';

      const request = await ctx.prisma.purchaseRequest.create({
        data: {
          requestNumber,
          title: input.title,
          description: input.description,
          priority: input.priority,
          status,
          projectId: input.projectId || undefined,
          createdById: userId,
          assignedToId: input.assignedToId || undefined,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          voiceNote: input.voiceNote || undefined,
          items: {
            create: input.items.map((item) => ({
              productName: item.productName,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              estimatedPrice: item.estimatedPrice,
            })),
          },
        },
        include: {
          items: true,
          project: { select: { id: true, name: true } },
        },
      });

      // Notify assigned user
      if (input.assignedToId) {
        await ctx.prisma.notification.create({
          data: {
            userId: input.assignedToId,
            type: 'PURCHASE_CREATED',
            title: 'درخواست خرید جدید',
            message: `درخواست خرید "${input.title}" به شما اختصاص داده شد`,
            link: `/purchases/${request.id}`,
          },
        });
      }

      return request;
    }),

  // Update purchase request
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        projectId: z.string().uuid().optional().nullable(),
        assignedToId: z.string().uuid().optional().nullable(),
        deadline: z.string().optional().nullable(),
        voiceNote: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.prisma.purchaseRequest.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      if (existing.status === 'APPROVED' || existing.status === 'PURCHASED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'امکان ویرایش درخواست تایید‌شده/خریداری‌شده وجود ندارد' });
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.projectId !== undefined) updateData.projectId = data.projectId;
      if (data.voiceNote !== undefined) updateData.voiceNote = data.voiceNote;
      if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
      
      if (data.assignedToId !== undefined) {
        updateData.assignedToId = data.assignedToId;
        if (data.assignedToId && existing.status === 'DRAFT') {
          updateData.status = 'PENDING_INQUIRY';
        }
      }

      const updated = await ctx.prisma.purchaseRequest.update({
        where: { id },
        data: updateData,
      });

      // Notify newly assigned user
      if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
        await ctx.prisma.notification.create({
          data: {
            userId: data.assignedToId,
            type: 'PURCHASE_CREATED',
            title: 'درخواست خرید جدید',
            message: `درخواست خرید "${updated.title}" به شما اختصاص داده شد`,
            link: `/purchases/${id}`,
          },
        });
      }

      return updated;
    }),

  // Add inquiry to a purchase request
  addInquiry: protectedProcedure
    .input(
      z.object({
        purchaseRequestId: z.string().uuid(),
        supplierName: z.string().min(1, 'نام تأمین‌کننده الزامی است'),
        supplierPhone: z.string().optional(),
        supplierAddress: z.string().optional(),
        paymentMethod: z.string().optional(),
        paymentDays: z.number().int().min(0).optional().nullable(),
        notes: z.string().optional(),
        items: z.array(
          z.object({
            purchaseItemId: z.string().uuid(),
            unitPrice: z.number().min(0),
            totalPrice: z.number().min(0),
            availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'PARTIAL']).default('AVAILABLE'),
            deliveryDays: z.number().int().min(0).optional().nullable(),
            notes: z.string().optional(),
          })
        ).min(1, 'حداقل یک قلم الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.purchaseRequestId },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      // USER can only add to assigned requests
      if (role === 'USER' && request.assignedToId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      if (request.status === 'APPROVED' || request.status === 'PURCHASED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'امکان افزودن استعلام به درخواست تایید‌شده/خریداری‌شده وجود ندارد' });
      }

      const totalPrice = input.items.reduce((sum, item) => sum + item.totalPrice, 0);

      const inquiry = await ctx.prisma.purchaseInquiry.create({
        data: {
          purchaseRequestId: input.purchaseRequestId,
          supplierName: input.supplierName,
          supplierPhone: input.supplierPhone,
          supplierAddress: input.supplierAddress,
          paymentMethod: input.paymentMethod,
          paymentDays: input.paymentDays,
          totalPrice,
          notes: input.notes,
          createdById: userId,
          items: {
            create: input.items.map((item) => ({
              purchaseItemId: item.purchaseItemId,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              availability: item.availability,
              deliveryDays: item.deliveryDays,
              notes: item.notes,
            })),
          },
        },
        include: {
          items: true,
          attachments: true,
        },
      });

      return inquiry;
    }),

  // Submit for approval (USER only)
  submit: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.id },
        include: { _count: { select: { inquiries: true } }, createdBy: true },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      if (request.assignedToId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط کاربر تخصیص‌یافته می‌تواند ارسال کند' });
      }

      if (request._count.inquiries === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'حداقل یک استعلام باید ثبت شده باشد' });
      }

      const updated = await ctx.prisma.purchaseRequest.update({
        where: { id: input.id },
        data: { status: 'INQUIRED' },
      });

      // Notify creator
      await ctx.prisma.notification.create({
        data: {
          userId: request.createdById,
          type: 'PURCHASE_SUBMITTED',
          title: 'استعلام‌ها ارسال شد',
          message: `استعلام‌های درخواست "${request.title}" برای بررسی ارسال شد`,
          link: `/purchases/${input.id}`,
        },
      });

      return updated;
    }),

  // Approve an inquiry (ADMIN/MANAGER)
  approveInquiry: managerProcedure
    .input(
      z.object({
        purchaseRequestId: z.string().uuid(),
        inquiryId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.purchaseRequestId },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      const inquiry = await ctx.prisma.purchaseInquiry.findUnique({
        where: { id: input.inquiryId },
      });

      if (!inquiry || inquiry.purchaseRequestId !== input.purchaseRequestId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'استعلام یافت نشد' });
      }

      const updated = await ctx.prisma.purchaseRequest.update({
        where: { id: input.purchaseRequestId },
        data: {
          status: 'APPROVED',
          approvedInquiryId: input.inquiryId,
        },
      });

      // Notify assigned user
      if (request.assignedToId) {
        await ctx.prisma.notification.create({
          data: {
            userId: request.assignedToId,
            type: 'PURCHASE_APPROVED',
            title: 'درخواست خرید تایید شد',
            message: `درخواست خرید "${request.title}" تایید شد`,
            link: `/purchases/${input.purchaseRequestId}`,
          },
        });
      }

      return updated;
    }),

  // Reject purchase request (ADMIN/MANAGER)
  reject: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, 'دلیل رد الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.id },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      const updated = await ctx.prisma.purchaseRequest.update({
        where: { id: input.id },
        data: {
          status: 'REJECTED',
          rejectionReason: input.reason,
        },
      });

      // Notify assigned user
      if (request.assignedToId) {
        await ctx.prisma.notification.create({
          data: {
            userId: request.assignedToId,
            type: 'PURCHASE_REJECTED',
            title: 'درخواست خرید رد شد',
            message: `درخواست خرید "${request.title}" رد شد: ${input.reason}`,
            link: `/purchases/${input.id}`,
          },
        });
      }

      return updated;
    }),

  // Mark as purchased (ADMIN/MANAGER)
  markPurchased: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.id },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      if (request.status !== 'APPROVED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'فقط درخواست‌های تایید‌شده قابل علامت‌گذاری هستند' });
      }

      return ctx.prisma.purchaseRequest.update({
        where: { id: input.id },
        data: { status: 'PURCHASED' },
      });
    }),

  // Delete purchase request
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.prisma.purchaseRequest.findUnique({
        where: { id: input.id },
      });

      if (!request) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'درخواست خرید یافت نشد' });
      }

      if (request.status === 'PURCHASED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'امکان حذف درخواست خریداری‌شده وجود ندارد' });
      }

      await ctx.prisma.purchaseRequest.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Pending count for badge
  pendingCount: managerProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.purchaseRequest.count({
        where: { status: 'INQUIRED' },
      });
    }),

  // Delete an inquiry
  deleteInquiry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const inquiry = await ctx.prisma.purchaseInquiry.findUnique({
        where: { id: input.id },
        include: { purchaseRequest: true },
      });

      if (!inquiry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'استعلام یافت نشد' });
      }

      // Only creator or ADMIN/MANAGER can delete
      if (role === 'USER' && inquiry.createdById !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی غیرمجاز' });
      }

      if (inquiry.purchaseRequest.status === 'APPROVED' || inquiry.purchaseRequest.status === 'PURCHASED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'امکان حذف استعلام درخواست تایید‌شده وجود ندارد' });
      }

      await ctx.prisma.purchaseInquiry.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Get users for assignment dropdown
  getUsers: managerProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.user.findMany({
        where: { isActive: true, role: 'USER' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      });
    }),
});
