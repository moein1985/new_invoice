import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createTRPCRouter,
  protectedProcedure,
  managerProcedure,
} from '@/server/api/trpc';

export const contactRouter = createTRPCRouter({
  // List contacts with pagination and search
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional().nullable(),
        category: z.enum(['COLLEAGUE', 'CLIENT', 'VENDOR', 'PERSONAL', 'OTHER']).optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const where: any = {};

      if (input.search) {
        where.OR = [
          { firstName: { contains: input.search, mode: 'insensitive' } },
          { lastName: { contains: input.search, mode: 'insensitive' } },
          { company: { contains: input.search, mode: 'insensitive' } },
          { phone: { contains: input.search, mode: 'insensitive' } },
          { mobile: { contains: input.search, mode: 'insensitive' } },
          { code: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.category) {
        where.category = input.category;
      }

      const [contacts, total] = await Promise.all([
        ctx.prisma.contact.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          include: {
            createdBy: {
              select: { fullName: true },
            },
          },
        }),
        ctx.prisma.contact.count({ where }),
      ]);

      return {
        data: contacts,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Get single contact
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const contact = await ctx.prisma.contact.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: { fullName: true },
          },
        },
      });

      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'مخاطب یافت نشد',
        });
      }

      return contact;
    }),

  // Get all contacts (for dropdown/autocomplete)
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.contact.findMany({
      where: { isActive: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        company: true,
      },
    });
  }),

  // Create contact
  create: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1, 'نام الزامی است'),
        lastName: z.string().min(1, 'نام خانوادگی الزامی است'),
        company: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        mobile: z.string().optional().nullable(),
        email: z.string().email('ایمیل نامعتبر است').optional().nullable().or(z.literal('')),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        category: z.enum(['COLLEAGUE', 'CLIENT', 'VENDOR', 'PERSONAL', 'OTHER']).default('OTHER'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-generate contact code
      const lastContact = await ctx.prisma.contact.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true },
      });

      let newCode: string;
      if (lastContact && lastContact.code.startsWith('CON-')) {
        const lastNumber = parseInt(lastContact.code.split('-')[1]);
        newCode = `CON-${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        newCode = 'CON-0001';
      }

      return ctx.prisma.contact.create({
        data: {
          ...input,
          email: input.email || null,
          code: newCode,
          createdById: ctx.session.user.id,
        },
      });
    }),

  // Update contact
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        company: z.string().optional().nullable(),
        position: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        mobile: z.string().optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal('')),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        category: z.enum(['COLLEAGUE', 'CLIENT', 'VENDOR', 'PERSONAL', 'OTHER']).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.prisma.contact.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'مخاطب یافت نشد',
        });
      }

      return ctx.prisma.contact.update({
        where: { id },
        data: {
          ...data,
          email: data.email || null,
        },
      });
    }),

  // Delete contact (manager/admin only)
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.contact.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'مخاطب یافت نشد',
        });
      }

      return ctx.prisma.contact.delete({
        where: { id: input.id },
      });
    }),

  // Quick search (for autocomplete)
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.contact.findMany({
        where: {
          isActive: true,
          OR: [
            { firstName: { contains: input.query, mode: 'insensitive' } },
            { lastName: { contains: input.query, mode: 'insensitive' } },
            { phone: { contains: input.query, mode: 'insensitive' } },
            { mobile: { contains: input.query, mode: 'insensitive' } },
            { company: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          phone: true,
          mobile: true,
          company: true,
        },
      });
    }),
});
