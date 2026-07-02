import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, projectAdminProcedure, protectedProcedure, getUserProjectIds, isSuperuser } from '@/server/api/trpc';
import path from 'path';
import { existsSync } from 'fs';
import { readdir, unlink } from 'fs/promises';

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

const contractorDocItemSchema = z.object({
  description: z.string().min(1, 'شرح قلم الزامی است'),
  unit: z.string().min(1, 'واحد الزامی است'),
  quantity: z.number().min(0, 'مقدار نامعتبر است'),
  unitPrice: z.number().min(0).optional(),
  totalPrice: z.number().min(0).optional(),
});

const contractorDocAttachmentSchema = z.object({
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileSize: z.number().int().min(1),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
});

function normalizeNumber(value?: number, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeItems(items: Array<z.infer<typeof contractorDocItemSchema>>) {
  return items.map((item) => {
    const unitPrice = normalizeNumber(item.unitPrice, 0);
    const totalPrice = normalizeNumber(item.totalPrice, unitPrice * item.quantity);
    return {
      description: item.description.trim(),
      unit: item.unit.trim(),
      quantity: item.quantity,
      unitPrice,
      totalPrice,
    };
  });
}

async function assertProjectAccess(ctx: any, role: string, userId: string, projectId: string, username?: string | null) {
  // MANAGER and superuser have full access
  if (role === 'MANAGER' || isSuperuser(username)) {
    return;
  }

  // Check ProjectMember for CONTRACTOR, TECHNICAL, ADMIN, USER
  const membership = await ctx.prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (membership) return;

  // Check employer access
  const employerProject = await ctx.prisma.project.findFirst({
    where: { id: projectId, employerUserId: userId },
  });

  if (employerProject) return;

  throw new TRPCError({ code: 'FORBIDDEN', message: 'شما عضو این پروژه نیستید' });
}

async function generateDocNumber(ctx: any) {
  const year = new Date().getFullYear();
  const prefix = `CD-${year}-`;

  const lastDoc = await ctx.prisma.contractorDoc.findFirst({
    where: { docNumber: { startsWith: prefix } },
    orderBy: { docNumber: 'desc' },
    select: { docNumber: true },
  });

  let sequence = 1;
  if (lastDoc?.docNumber) {
    const parts = lastDoc.docNumber.split('-');
    sequence = parseInt(parts[2] ?? '0', 10) + 1;
  }

  return `CD-${year}-${sequence.toString().padStart(4, '0')}`;
}

async function resolveAttachmentAbsolutePath(filePathOrId: string) {
  const baseDir = path.join(process.cwd(), 'uploads', 'contractor-docs');

  if (!existsSync(baseDir)) {
    return null;
  }

  const safeValue = path.basename(filePathOrId);

  if (safeValue.includes('.')) {
    return path.join(baseDir, safeValue);
  }

  const entries = await readdir(baseDir);
  const matched = entries.find((entry) => entry.startsWith(`${safeValue}.`));
  return matched ? path.join(baseDir, matched) : null;
}

export const contractorDocRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        type: z.enum(['RECEIPT', 'EXPENSE', 'GENERAL']).optional().nullable(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        search: z.string().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {
        projectId: input.projectId,
      };

      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        where.createdById = userId;
      }
      if (input.type) {
        where.type = input.type;
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.search) {
        where.OR = [
          { docNumber: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
          { notes: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const [docs, total] = await Promise.all([
        ctx.prisma.contractorDoc.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { docDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            _count: { select: { items: true, attachments: true } },
          },
        }),
        ctx.prisma.contractorDoc.count({ where }),
      ]);

      return {
        data: docs,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  // List docs for the current user (contractor sees own, manager sees all)
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const where: any = {};
      // Contractors and Technical only see their own docs
      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        where.createdById = userId;
      }
      // Project-scoped users (ADMIN, USER) only see docs for their projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          return { data: [], meta: { page: input.page, limit: input.limit, total: 0, totalPages: 0 } };
        }
        where.projectId = { in: projectIds };
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }

      const [docs, total] = await Promise.all([
        ctx.prisma.contractorDoc.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { docDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            _count: { select: { items: true, attachments: true } },
          },
        }),
        ctx.prisma.contractorDoc.count({ where }),
      ]);

      return {
        data: docs,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  listAll: projectAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        type: z.enum(['RECEIPT', 'EXPENSE', 'GENERAL']).optional().nullable(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        createdById: z.string().uuid().optional().nullable(),
        search: z.string().optional().nullable(),
        dateFrom: z.string().optional().nullable(),
        dateTo: z.string().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const where: any = {};
      // Project-scoped users only see docs for their projects
      const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
      if (projectIds !== null) {
        if (projectIds.length === 0) {
          return { data: [], meta: { page: input.page, limit: input.limit, total: 0, totalPages: 0 } };
        }
        where.projectId = { in: projectIds };
      }
      if (input.type) {
        where.type = input.type;
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }
      if (input.createdById) {
        where.createdById = input.createdById;
      }
      if (input.dateFrom || input.dateTo) {
        where.docDate = {};
        if (input.dateFrom) {
          where.docDate.gte = new Date(input.dateFrom);
        }
        if (input.dateTo) {
          where.docDate.lte = new Date(input.dateTo);
        }
      }
      if (input.search) {
        where.OR = [
          { docNumber: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
          { project: { name: { contains: input.search, mode: 'insensitive' } } },
          { createdBy: { fullName: { contains: input.search, mode: 'insensitive' } } },
        ];
      }

      const [docs, total] = await Promise.all([
        ctx.prisma.contractorDoc.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { docDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            _count: { select: { items: true, attachments: true } },
          },
        }),
        ctx.prisma.contractorDoc.count({ where }),
      ]);

      return {
        data: docs,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const doc = await ctx.prisma.contractorDoc.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true, username: true } },
          items: { orderBy: { createdAt: 'asc' } },
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'سند پیمانکار یافت نشد' });
      }

      if ((role === 'CONTRACTOR' || role === 'TECHNICAL') && doc.createdById !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
      }

      // Project-scoped users: check project access
      if (role !== 'MANAGER' && !isSuperuser(ctx.session.user.username) && role !== 'CONTRACTOR' && role !== 'TECHNICAL') {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null && !projectIds.includes(doc.projectId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
        }
      }

      return doc;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        type: z.enum(['RECEIPT', 'EXPENSE', 'GENERAL']),
        direction: z.enum(['RECEIVED', 'DELIVERED']).optional().nullable(),
        description: z.string().min(1, 'شرح سند الزامی است'),
        totalAmount: z.number().min(0).optional().nullable(),
        docDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        items: z.array(contractorDocItemSchema).default([]),
        attachments: z.array(contractorDocAttachmentSchema).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      await assertProjectAccess(ctx, role, userId, input.projectId, ctx.session.user.username);

      if (input.type === 'RECEIPT' && !input.direction) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'جهت برای سند نوع رسید الزامی است' });
      }
      if (input.type !== 'RECEIPT' && input.direction) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'جهت فقط برای سند نوع رسید مجاز است' });
      }

      const normalizedItems = normalizeItems(input.items);
      const computedTotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const finalTotalAmount = input.totalAmount ?? computedTotal;

      if (input.type === 'EXPENSE' && finalTotalAmount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'برای سند هزینه، مبلغ کل باید بیشتر از صفر باشد' });
      }

      const docNumber = await generateDocNumber(ctx);

      const created = await ctx.prisma.contractorDoc.create({
        data: {
          docNumber,
          type: input.type,
          direction: input.type === 'RECEIPT' ? input.direction ?? null : null,
          projectId: input.projectId,
          createdById: userId,
          description: input.description.trim(),
          totalAmount: finalTotalAmount,
          approvalStatus: 'PENDING',
          docDate: input.docDate ? new Date(input.docDate) : new Date(),
          notes: input.notes,
          items: {
            create: normalizedItems,
          },
          attachments: {
            create: input.attachments,
          },
        },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      const managers = await ctx.prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['MANAGER', 'ADMIN'] },
        },
        select: { id: true },
      });

      if (managers.length > 0) {
        await ctx.prisma.notification.createMany({
          data: managers.map((manager) => ({
            userId: manager.id,
            type: 'INFO',
            title: 'سند پیمانکار جدید',
            message: `سند ${docNumber} برای بررسی ثبت شد`,
            link: `/projects/${input.projectId}/contractor-docs/${created.id}`,
          })),
        });
      }

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: z.enum(['RECEIPT', 'EXPENSE', 'GENERAL']).optional(),
        direction: z.enum(['RECEIVED', 'DELIVERED']).optional().nullable(),
        description: z.string().min(1).optional(),
        totalAmount: z.number().min(0).optional().nullable(),
        docDate: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        items: z.array(contractorDocItemSchema).optional(),
        attachments: z.array(contractorDocAttachmentSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const existing = await ctx.prisma.contractorDoc.findUnique({
        where: { id: input.id },
        include: { attachments: true },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'سند پیمانکار یافت نشد' });
      }

      if (existing.approvalStatus !== 'PENDING') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط سندهای در انتظار تایید قابل ویرایش هستند' });
      }

      if ((role === 'CONTRACTOR' || role === 'TECHNICAL') && existing.createdById !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
      }

      // Project-scoped ADMIN: verify project access
      if (role === 'ADMIN' && !isSuperuser(ctx.session.user.username)) {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null && !projectIds.includes(existing.projectId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
        }
      }

      const nextType = input.type ?? existing.type;
      const nextDirection = input.direction !== undefined ? input.direction : existing.direction;

      if (nextType === 'RECEIPT' && !nextDirection) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'جهت برای سند نوع رسید الزامی است' });
      }
      if (nextType !== 'RECEIPT' && nextDirection) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'جهت فقط برای سند نوع رسید مجاز است' });
      }

      const normalizedItems = input.items ? normalizeItems(input.items) : null;
      const computedTotal = normalizedItems
        ? normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0)
        : existing.totalAmount;

      const finalTotalAmount = input.totalAmount ?? computedTotal;
      if (nextType === 'EXPENSE' && finalTotalAmount <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'برای سند هزینه، مبلغ کل باید بیشتر از صفر باشد' });
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        if (normalizedItems) {
          await tx.contractorDocItem.deleteMany({ where: { contractorDocId: input.id } });
          if (normalizedItems.length > 0) {
            await tx.contractorDocItem.createMany({
              data: normalizedItems.map((item) => ({
                contractorDocId: input.id,
                ...item,
              })),
            });
          }
        }

        if (input.attachments) {
          await tx.contractorDocAttachment.deleteMany({ where: { contractorDocId: input.id } });
          if (input.attachments.length > 0) {
            await tx.contractorDocAttachment.createMany({
              data: input.attachments.map((attachment) => ({
                contractorDocId: input.id,
                ...attachment,
              })),
            });
          }
        }

        return tx.contractorDoc.update({
          where: { id: input.id },
          data: {
            type: nextType,
            direction: nextType === 'RECEIPT' ? nextDirection ?? null : null,
            description: input.description?.trim() ?? existing.description,
            totalAmount: finalTotalAmount,
            docDate: input.docDate ? new Date(input.docDate) : existing.docDate,
            notes: input.notes !== undefined ? input.notes : existing.notes,
          },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            items: { orderBy: { createdAt: 'asc' } },
            attachments: { orderBy: { createdAt: 'asc' } },
          },
        });
      });

      return updated;
    }),

  approve: projectAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.contractorDoc.findUnique({ where: { id: input.id } });
      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'سند پیمانکار یافت نشد' });
      }

      const updated = await ctx.prisma.contractorDoc.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'APPROVED',
          rejectionReason: null,
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: doc.createdById,
          type: 'SUCCESS',
          title: 'سند پیمانکار تایید شد',
          message: `سند ${doc.docNumber} تایید شد`,
          link: `/projects/${doc.projectId}/contractor-docs/${doc.id}`,
        },
      });

      return updated;
    }),

  reject: projectAdminProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().min(1, 'دلیل رد الزامی است') }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.contractorDoc.findUnique({ where: { id: input.id } });
      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'سند پیمانکار یافت نشد' });
      }

      const updated = await ctx.prisma.contractorDoc.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: input.reason.trim(),
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: doc.createdById,
          type: 'WARNING',
          title: 'سند پیمانکار رد شد',
          message: `سند ${doc.docNumber} رد شد`,
          link: `/projects/${doc.projectId}/contractor-docs/${doc.id}`,
        },
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const doc = await ctx.prisma.contractorDoc.findUnique({
        where: { id: input.id },
        include: {
          attachments: true,
        },
      });

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'سند پیمانکار یافت نشد' });
      }

      if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
        if (doc.createdById !== userId) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
        }
        if (doc.approvalStatus !== 'PENDING') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط سندهای در انتظار قابل حذف هستند' });
        }
      }

      // Project-scoped ADMIN: verify project access
      if (role === 'ADMIN' && !isSuperuser(ctx.session.user.username)) {
        const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
        if (projectIds !== null && !projectIds.includes(doc.projectId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'شما دسترسی به این سند ندارید' });
        }
      }

      await ctx.prisma.contractorDoc.delete({ where: { id: input.id } });

      for (const attachment of doc.attachments) {
        const absolutePath = await resolveAttachmentAbsolutePath(attachment.filePath);
        if (absolutePath && existsSync(absolutePath)) {
          try {
            await unlink(absolutePath);
          } catch {
            // Ignore file deletion errors after DB delete
          }
        }
      }

      return { success: true };
    }),

  summary: projectAdminProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    const projectFilter = await getUserProjectIds(userId, role, ctx.session.user.username);
    const projectWhere = projectFilter !== null ? { projectId: { in: projectFilter } } : {};

    const [pendingCount, approvedTotalsByProject, approvedTotalsByContractor] = await Promise.all([
      ctx.prisma.contractorDoc.count({ where: { approvalStatus: 'PENDING', ...projectWhere } }),
      ctx.prisma.contractorDoc.groupBy({
        by: ['projectId'],
        where: { approvalStatus: 'APPROVED', ...projectWhere },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      ctx.prisma.contractorDoc.groupBy({
        by: ['createdById'],
        where: { approvalStatus: 'APPROVED', ...projectWhere },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const [projectMap, contractorMap] = await Promise.all([
      ctx.prisma.project.findMany({
        where: { id: { in: approvedTotalsByProject.map((row) => row.projectId) } },
        select: { id: true, name: true, code: true },
      }),
      ctx.prisma.user.findMany({
        where: { id: { in: approvedTotalsByContractor.map((row) => row.createdById) } },
        select: { id: true, fullName: true },
      }),
    ]);

    const projectsById = new Map(projectMap.map((project) => [project.id, project]));
    const contractorsById = new Map(contractorMap.map((contractor) => [contractor.id, contractor]));

    return {
      pendingCount,
      approvedExpenseTotal: approvedTotalsByProject.reduce((sum, row) => sum + (row._sum.totalAmount ?? 0), 0),
      byProject: approvedTotalsByProject.map((row) => ({
        projectId: row.projectId,
        projectName: projectsById.get(row.projectId)?.name ?? 'نامشخص',
        projectCode: projectsById.get(row.projectId)?.code ?? '',
        docCount: row._count._all,
        totalAmount: row._sum.totalAmount ?? 0,
      })),
      byContractor: approvedTotalsByContractor.map((row) => ({
        createdById: row.createdById,
        contractorName: contractorsById.get(row.createdById)?.fullName ?? 'نامشخص',
        docCount: row._count._all,
        totalAmount: row._sum.totalAmount ?? 0,
      })),
    };
  }),

  pendingCount: projectAdminProcedure.query(async ({ ctx }) => {
    const role = ctx.session.user.role;
    const userId = ctx.session.user.id;

    const where: any = { approvalStatus: 'PENDING' };
    // Contractors and Technical only count their own
    if (role === 'CONTRACTOR' || role === 'TECHNICAL') {
      where.createdById = userId;
    }
    // Project-scoped users only count for their projects
    const projectIds = await getUserProjectIds(userId, role, ctx.session.user.username);
    if (projectIds !== null) {
      if (projectIds.length === 0) return 0;
      where.projectId = { in: projectIds };
    }

    return ctx.prisma.contractorDoc.count({ where });
  }),
});
