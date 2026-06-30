import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  protectedProcedure,
} from '@/server/api/trpc';

export const supplierRouter = createTRPCRouter({
  // List suppliers with pagination and search
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const where = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' as const } },
              { code: { contains: input.search, mode: 'insensitive' as const } },
              { phone: { contains: input.search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [suppliers, total] = await Promise.all([
        ctx.prisma.supplier.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { inquiries: true },
            },
          },
        }),
        ctx.prisma.supplier.count({ where }),
      ]);

      return {
        data: suppliers.map((s) => ({
          ...s,
          inquiryCount: s._count.inquiries,
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get all suppliers (for dropdown select)
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.supplier.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          address: true,
        },
      });
    }),

  // Get single supplier
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.supplier.findUnique({
        where: { id: input.id },
        include: {
          inquiries: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              purchaseRequest: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  requestNumber: true,
                },
              },
            },
          },
        },
      });
    }),

  // Create supplier
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-generate supplier code
      const lastSupplier = await ctx.prisma.supplier.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });

      let newCode: string;
      if (lastSupplier && lastSupplier.code.startsWith('SUP-')) {
        const lastNumber = parseInt(lastSupplier.code.split('-')[1]);
        newCode = `SUP-${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        newCode = 'SUP-0001';
      }

      return ctx.prisma.supplier.create({
        data: {
          ...input,
          code: newCode,
        },
      });
    }),

  // Update supplier
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if code exists for other supplier
      if (data.code) {
        const existing = await ctx.prisma.supplier.findFirst({
          where: {
            code: data.code,
            id: { not: id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'کد تامین‌کننده قبلاً استفاده شده است',
          });
        }
      }

      return ctx.prisma.supplier.update({
        where: { id },
        data,
      });
    }),

  // Delete supplier
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if supplier has inquiries
      const inquiryCount = await ctx.prisma.purchaseInquiry.count({
        where: { supplierId: input.id },
      });

      if (inquiryCount > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `این تامین‌کننده دارای ${inquiryCount} استعلام است و نمی‌توان آن را حذف کرد`,
        });
      }

      return ctx.prisma.supplier.delete({
        where: { id: input.id },
      });
    }),
});
