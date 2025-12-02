import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';

const documentItemSchema = z.object({
  productName: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  purchasePrice: z.number().min(0),
  sellPrice: z.number().min(0),
  profitPercentage: z.number().optional().nullable(),
  supplier: z.string().min(1),
  isManualPrice: z.boolean().default(false),
});

export const documentRouter = createTRPCRouter({
  // List documents with filters
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        documentType: z.enum(['TEMP_PROFORMA', 'PROFORMA', 'INVOICE', 'RETURN_INVOICE', 'RECEIPT', 'OTHER']).optional().nullable(),
        approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        customerId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const where: any = {};
      if (input.documentType) where.documentType = input.documentType;
      if (input.approvalStatus) where.approvalStatus = input.approvalStatus;
      if (input.customerId) where.customerId = input.customerId;

      const [documents, total] = await Promise.all([
        ctx.prisma.document.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { name: true } },
            createdBy: { select: { fullName: true } },
            items: true,
          },
        }),
        ctx.prisma.document.count({ where }),
      ]);

      return {
        data: documents.map((doc) => ({
          ...doc,
          customerName: doc.customer.name,
          createdByName: doc.createdBy.fullName,
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get single document
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.prisma.document.findUnique({
        where: { id: input.id },
        include: {
          customer: true,
          createdBy: { select: { id: true, fullName: true } },
          items: true,
          approvals: {
            include: {
              user: { select: { fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          convertedFrom: {
            select: {
              id: true,
              documentNumber: true,
              documentType: true,
            },
          },
          convertedTo: {
            select: {
              id: true,
              documentNumber: true,
              documentType: true,
            },
          },
        },
      });

      if (!document) {
        throw new Error('سند یافت نشد');
      }

      return document;
    }),

  // Create document
  create: protectedProcedure
    .input(
      z.object({
        documentType: z.enum(['TEMP_PROFORMA', 'PROFORMA', 'INVOICE', 'RETURN_INVOICE', 'RECEIPT', 'OTHER']),
        customerId: z.string().uuid(),
        projectName: z.string().optional().nullable(),
        issueDate: z.coerce.date(),
        dueDate: z.coerce.date().optional().nullable(),
        discountAmount: z.number().min(0).default(0),
        notes: z.string().optional().nullable(),
        attachment: z.string().optional().nullable(),
        defaultProfitPercentage: z.number().default(20),
        items: z.array(documentItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, ...documentData } = input;

      // Generate document number
      const prefix = {
        TEMP_PROFORMA: 'TMP',
        PROFORMA: 'PRF',
        INVOICE: 'INV',
        RETURN_INVOICE: 'RET',
        RECEIPT: 'RCP',
        OTHER: 'OTH',
      }[input.documentType];

      const year = new Date().getFullYear();
      
      // Get the last document number to avoid duplicates
      const lastDocument = await ctx.prisma.document.findFirst({
        where: {
          documentNumber: { startsWith: `${prefix}-${year}` },
        },
        orderBy: { documentNumber: 'desc' },
        select: { documentNumber: true },
      });

      let nextNumber = 1;
      if (lastDocument?.documentNumber) {
        const lastNumberStr = lastDocument.documentNumber.split('-').pop();
        if (lastNumberStr) {
          nextNumber = parseInt(lastNumberStr, 10) + 1;
        }
      }

      const documentNumber = `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;

      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
      const finalAmount = totalAmount - input.discountAmount;

      // تعیین وضعیت تایید: فقط TEMP_PROFORMA نیاز به تایید دارد
      const approvalStatus = input.documentType === 'TEMP_PROFORMA' ? 'PENDING' : 'APPROVED';

      return ctx.prisma.$transaction(async (tx) => {
        // ایجاد سند
        const document = await tx.document.create({
          data: {
            ...documentData,
            documentNumber,
            totalAmount,
            finalAmount,
            approvalStatus,
            createdById: ctx.session.user.id,
            items: {
              create: items,
            },
          },
          include: {
            items: true,
            customer: true,
          },
        });

        // اگر TEMP_PROFORMA است، approval ایجاد کن
        if (input.documentType === 'TEMP_PROFORMA') {
          await tx.approval.create({
            data: {
              documentId: document.id,
              userId: ctx.session.user.id,
              status: 'PENDING',
              comment: 'در انتظار تایید',
            },
          });
        }

        return document;
      });
    }),

  // Update document
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        projectName: z.string().optional().nullable(),
        issueDate: z.date().optional(),
        dueDate: z.date().optional().nullable(),
        discountAmount: z.number().min(0).optional(),
        notes: z.string().optional().nullable(),
        attachment: z.string().optional().nullable(),
        items: z.array(documentItemSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...data } = input;

      return ctx.prisma.$transaction(async (tx) => {
        // بررسی اینکه آیا این پیش‌فاکتور موقت تایید شده است
        const document = await tx.document.findUnique({
          where: { id },
          select: {
            documentType: true,
            approvalStatus: true,
            convertedTo: true,
          },
        });

        // اگر پیش‌فاکتور موقت تایید شده ویرایش شود، اسناد مرتبط (پیش‌فاکتور و فاکتور) حذف می‌شوند
        if (document?.documentType === 'TEMP_PROFORMA' && document?.approvalStatus === 'APPROVED') {
          // پیدا کردن تمام اسناد مرتبط
          const relatedDocs = await tx.document.findMany({
            where: {
              convertedFromId: id,
            },
            select: {
              id: true,
              convertedTo: true,
            },
          });

          // حذف اسناد مرتبط به صورت بازگشتی
          for (const relatedDoc of relatedDocs) {
            // اگر این سند هم سند دیگری از روی خودش ساخته باشد، آن را هم حذف کن
            if (relatedDoc.convertedTo) {
              await tx.document.delete({
                where: { id: relatedDoc.convertedTo.id },
              });
            }
            // حذف خود سند
            await tx.document.delete({
              where: { id: relatedDoc.id },
            });
          }

          // حذف تمام approval های قبلی این سند
          await tx.approval.deleteMany({
            where: {
              documentId: id,
            },
          });

          // بازگشت به حالت در انتظار تایید
          await tx.document.update({
            where: { id },
            data: {
              approvalStatus: 'PENDING',
            },
          });

          // ایجاد approval جدید برای تایید مجدد
          await tx.approval.create({
            data: {
              documentId: id,
              userId: ctx.session.user.id,
              status: 'PENDING',
              comment: 'سند ویرایش شد و نیاز به تایید مجدد دارد',
            },
          });
        }

        // Recalculate if items changed
        if (items) {
          const totalAmount = items.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
          const finalAmount = totalAmount - (data.discountAmount ?? 0);

          return tx.document.update({
            where: { id },
            data: {
              ...data,
              totalAmount,
              finalAmount,
              items: {
                deleteMany: {},
                create: items,
              },
            },
            include: {
              items: true,
            },
          });
        }

        return tx.document.update({
          where: { id },
          data,
        });
      });
    }),

  // Delete document
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.document.delete({
        where: { id: input.id },
      });
    }),

  // Approve document (manager/admin only)
  approve: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(), // document ID
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // Update document
        const document = await tx.document.update({
          where: { id: input.id },
          data: { approvalStatus: 'APPROVED' },
        });

        // Create approval record
        await tx.approval.create({
          data: {
            documentId: input.id,
            userId: ctx.session.user.id,
            status: 'APPROVED',
            comment: input.comment,
          },
        });

        return document;
      });
    }),

  // Reject document (manager/admin only)
  reject: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(), // document ID
        comment: z.string().min(1, 'دلیل رد الزامی است'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const document = await tx.document.update({
          where: { id: input.id },
          data: { approvalStatus: 'REJECTED' },
        });

        await tx.approval.create({
          data: {
            documentId: input.id,
            userId: ctx.session.user.id,
            status: 'REJECTED',
            comment: input.comment,
          },
        });

        return document;
      });
    }),

  // Convert document to another type
  convert: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        toType: z.enum(['TEMP_PROFORMA', 'PROFORMA', 'INVOICE', 'RETURN_INVOICE', 'RECEIPT', 'OTHER']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sourceDoc = await ctx.prisma.document.findUnique({
        where: { id: input.id },
        include: { items: true },
      });

      if (!sourceDoc) {
        throw new Error('سند مبدأ یافت نشد');
      }

      // Validate conversion path
      const validConversions: Record<string, string[]> = {
        TEMP_PROFORMA: ['PROFORMA'],
        PROFORMA: ['INVOICE'],
        INVOICE: ['RETURN_INVOICE'],
      };

      if (!validConversions[sourceDoc.documentType]?.includes(input.toType)) {
        throw new Error('تبدیل این نوع سند مجاز نیست');
      }

      // حذف document قبلی که از این سند ساخته شده (اگر وجود داشته باشد)
      await ctx.prisma.document.deleteMany({
        where: { convertedFromId: sourceDoc.id },
      });

      // Generate new document number
      const prefix = {
        TEMP_PROFORMA: 'TMP',
        PROFORMA: 'PRF',
        INVOICE: 'INV',
        RETURN_INVOICE: 'RET',
        RECEIPT: 'RCP',
        OTHER: 'OTH',
      }[input.toType];

      const year = new Date().getFullYear();
      
      // Get the last document number to avoid duplicates
      const lastDocument = await ctx.prisma.document.findFirst({
        where: {
          documentNumber: { startsWith: `${prefix}-${year}` },
        },
        orderBy: { documentNumber: 'desc' },
        select: { documentNumber: true },
      });

      let nextNumber = 1;
      if (lastDocument?.documentNumber) {
        const lastNumberStr = lastDocument.documentNumber.split('-').pop();
        if (lastNumberStr) {
          nextNumber = parseInt(lastNumberStr, 10) + 1;
        }
      }

      const documentNumber = `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;

      // تعیین وضعیت تایید: فقط TEMP_PROFORMA نیاز به تایید دارد
      // بقیه اسناد (PROFORMA, INVOICE, ...) خودکار APPROVED هستند
      const approvalStatus = input.toType === 'TEMP_PROFORMA' ? 'PENDING' : 'APPROVED';

      return ctx.prisma.document.create({
        data: {
          documentNumber,
          documentType: input.toType,
          customerId: sourceDoc.customerId,
          issueDate: new Date(),
          dueDate: sourceDoc.dueDate,
          totalAmount: sourceDoc.totalAmount,
          discountAmount: sourceDoc.discountAmount,
          finalAmount: sourceDoc.finalAmount,
          notes: sourceDoc.notes,
          defaultProfitPercentage: sourceDoc.defaultProfitPercentage,
          approvalStatus,
          convertedFromId: sourceDoc.id,
          createdById: ctx.session.user.id,
          items: {
            create: sourceDoc.items.map((item) => ({
              productName: item.productName,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              purchasePrice: item.purchasePrice,
              sellPrice: item.sellPrice,
              profitPercentage: item.profitPercentage,
              supplier: item.supplier,
              isManualPrice: item.isManualPrice,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });
    }),

  // Get pending approvals (for managers/admins)
  pendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    // Only admins and managers can see approvals
    if (ctx.session.user.role !== 'ADMIN' && ctx.session.user.role !== 'MANAGER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'شما دسترسی به این بخش ندارید',
      });
    }

    const approvals = await ctx.prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
        },
      },
      include: {
        document: {
          include: {
            customer: true,
            createdBy: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return approvals;
  }),
});
