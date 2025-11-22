import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  protectedProcedure,
} from '@/server/api/trpc';

export const customerRouter = createTRPCRouter({
  // List customers with pagination and search
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional(),
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

      const [customers, total] = await Promise.all([
        ctx.prisma.customer.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { documents: true },
            },
          },
        }),
        ctx.prisma.customer.count({ where }),
      ]);

      return {
        data: customers.map((c) => ({
          ...c,
          documentCount: c._count.documents,
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get single customer
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findUnique({
        where: { id: input.id },
        include: {
          documents: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }),

  // Create customer
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-generate customer code
      const lastCustomer = await ctx.prisma.customer.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { code: true },
      });

      let newCode: string;
      if (lastCustomer && lastCustomer.code.startsWith('CUST-')) {
        // Extract number and increment
        const lastNumber = parseInt(lastCustomer.code.split('-')[1]);
        newCode = `CUST-${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        // Start from 0001
        newCode = 'CUST-0001';
      }

      return ctx.prisma.customer.create({
        data: {
          ...input,
          code: newCode,
        },
      });
    }),

  // Update customer
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if code exists for other customer
      if (data.code) {
        const existing = await ctx.prisma.customer.findFirst({
          where: {
            code: data.code,
            id: { not: id },
          },
        });

        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'کد مشتری قبلاً استفاده شده است',
          });
        }
      }

      return ctx.prisma.customer.update({
        where: { id },
        data,
      });
    }),

  // Delete customer
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if customer has documents
      const documentCount = await ctx.prisma.document.count({
        where: { customerId: input.id },
      });

      if (documentCount > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `این مشتری دارای ${documentCount} سند است و نمی‌توان آن را حذف کرد`,
        });
      }

      return ctx.prisma.customer.delete({
        where: { id: input.id },
      });
    }),
});
