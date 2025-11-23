import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from '@/server/api/trpc';
import bcrypt from 'bcryptjs';

export const userRouter = createTRPCRouter({
  // Get all users (admin only)
  list: adminProcedure
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
              { username: { contains: input.search, mode: 'insensitive' as const } },
              { fullName: { contains: input.search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }),

  // Get single user by ID (admin only)
  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              createdDocuments: true,
              approvals: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('کاربر یافت نشد');
      }

      return user;
    }),

  // Create user (admin only)
  create: adminProcedure
    .input(
      z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(6),
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().regex(/^[0-9]{11}$/, 'شماره تلفن باید 11 رقم باشد'),
        role: z.enum(['ADMIN', 'MANAGER', 'USER']),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if username exists
      const existing = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      });

      if (existing) {
        throw new Error('نام کاربری قبلاً استفاده شده است');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      return ctx.prisma.user.create({
        data: {
          ...input,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });
    }),

  // Update user (admin only)
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        fullName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().regex(/^[0-9]{11}$/, 'شماره تلفن باید 11 رقم باشد').optional(),
        role: z.enum(['ADMIN', 'MANAGER', 'USER']).optional(),
        isActive: z.boolean().optional(),
        password: z.string().min(6).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;

      const updateData: {
        fullName?: string;
        email?: string;
        phone?: string;
        role?: 'ADMIN' | 'MANAGER' | 'USER';
        isActive?: boolean;
        password?: string;
      } = data;

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      return ctx.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });
    }),

  // Delete user (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Don't allow deleting yourself
      if (input.id === ctx.session.user.id) {
        throw new Error('نمی‌توانید خودتان را حذف کنید');
      }

      return ctx.prisma.user.delete({
        where: { id: input.id },
      });
    }),
});
