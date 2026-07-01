/**
 * Ticket Router Tests
 * Tests access control, role-based filtering, and business logic
 */

import { describe, it, expect, jest } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { ticketRouter } from '../server/api/routers/ticket';

const createCaller = createCallerFactory(ticketRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  employer: '33333333-3333-4333-8333-333333333333',
  employer2: '44444444-4444-4444-8444-444444444444',
  project: '55555555-5555-4555-8555-555555555555',
  project2: '66666666-6666-4666-8666-666666666666',
  ticket: '77777777-7777-4777-8777-777777777777',
  ticket2: '88888888-8888-4888-8888-888888888888',
  reply: '99999999-9999-4999-8999-999999999999',
  attachment: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' | 'EMPLOYER' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: {
      user: { id: userId, role },
    },
    prisma: {
      ticket: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
      ticketReply: {
        create: jest.fn(),
      },
      ticketAttachment: {
        create: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
    },
  } as any;
}

// ─── list ───────────────────────────────────────────────────────────────────

describe('ticketRouter.list', () => {
  it('filters by employerUserId for EMPLOYER role', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findMany.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20 });

    const arg = ctx.prisma.ticket.findMany.mock.calls[0][0];
    expect(arg.where.project).toEqual({ employerUserId: UUIDS.employer });
  });

  it('does NOT filter by employerUserId for ADMIN role', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.ticket.findMany.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20 });

    const arg = ctx.prisma.ticket.findMany.mock.calls[0][0];
    expect(arg.where.project).toBeUndefined();
  });

  it('applies status and priority filters', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findMany.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, status: 'OPEN', priority: 'HIGH' });

    const arg = ctx.prisma.ticket.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe('OPEN');
    expect(arg.where.priority).toBe('HIGH');
  });

  it('applies search OR filter on title, ticketNumber, description', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findMany.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, search: 'آزمایش' });

    const arg = ctx.prisma.ticket.findMany.mock.calls[0][0];
    expect(arg.where.OR).toHaveLength(3);
    expect(arg.where.OR[0].title).toBeDefined();
    expect(arg.where.OR[1].ticketNumber).toBeDefined();
    expect(arg.where.OR[2].description).toBeDefined();
  });

  it('computes pagination meta correctly', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findMany.mockResolvedValue([{ id: UUIDS.ticket }]);
    ctx.prisma.ticket.count.mockResolvedValue(25);

    const caller = createCaller(ctx);
    const result = await caller.list({ page: 2, limit: 10 });

    expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('applies projectId filter', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findMany.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, projectId: UUIDS.project });

    const arg = ctx.prisma.ticket.findMany.mock.calls[0][0];
    expect(arg.where.projectId).toBe(UUIDS.project);
  });
});

// ─── getById ────────────────────────────────────────────────────────────────

describe('ticketRouter.getById', () => {
  it('returns ticket for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      title: 'Test',
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    const result = await caller.getById({ id: UUIDS.ticket });
    expect(result.id).toBe(UUIDS.ticket);
  });

  it('returns ticket for EMPLOYER who owns the project', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      title: 'Test',
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    const result = await caller.getById({ id: UUIDS.ticket });
    expect(result.id).toBe(UUIDS.ticket);
  });

  it('throws FORBIDDEN for EMPLOYER who does NOT own the project', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      title: 'Test',
      project: { employerUserId: UUIDS.employer2 },
    });

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.ticket })).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws NOT_FOUND when ticket does not exist', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.ticket })).rejects.toThrow('تیکت یافت نشد');
  });
});

// ─── create ─────────────────────────────────────────────────────────────────

describe('ticketRouter.create', () => {
  it('creates ticket for ADMIN on any project', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: UUIDS.employer,
      isActive: true,
    });
    ctx.prisma.ticket.findFirst.mockResolvedValue(null);
    ctx.prisma.ticket.create.mockResolvedValue({
      id: UUIDS.ticket,
      ticketNumber: 'TKT-1405-000001',
      project: { id: UUIDS.project, name: 'Project A' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.admin }]);

    const caller = createCaller(ctx);
    const result = await caller.create({
      title: 'تیکت جدید',
      description: 'توضیحات',
      projectId: UUIDS.project,
    });

    expect(result.id).toBe(UUIDS.ticket);
    expect(ctx.prisma.ticket.create).toHaveBeenCalled();
  });

  it('creates ticket for EMPLOYER on their own project', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: UUIDS.employer,
      isActive: true,
    });
    ctx.prisma.ticket.findFirst.mockResolvedValue(null);
    ctx.prisma.ticket.create.mockResolvedValue({
      id: UUIDS.ticket,
      ticketNumber: 'TKT-1405-000001',
      project: { id: UUIDS.project, name: 'Project A' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    const result = await caller.create({
      title: 'تیکت کارفرما',
      description: 'توضیحات',
      projectId: UUIDS.project,
    });

    expect(result.id).toBe(UUIDS.ticket);
  });

  it('throws FORBIDDEN for EMPLOYER on another employer project', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: UUIDS.employer2,
      isActive: true,
    });

    const caller = createCaller(ctx);
    await expect(
      caller.create({
        title: 'تیکت',
        description: 'توضیحات',
        projectId: UUIDS.project,
      })
    ).rejects.toThrow('شما فقط می‌توانید برای پروژه‌های خود تیکت ثبت کنید');
  });

  it('throws NOT_FOUND when project does not exist', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.project.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.create({
        title: 'تیکت',
        description: 'توضیحات',
        projectId: UUIDS.project,
      })
    ).rejects.toThrow('پروژه یافت نشد');
  });

  it('generates sequential ticket number', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: null,
      isActive: true,
    });
    ctx.prisma.ticket.findFirst.mockResolvedValue({ ticketNumber: 'TKT-1405-000005' });
    ctx.prisma.ticket.create.mockResolvedValue({
      id: UUIDS.ticket,
      ticketNumber: 'TKT-1405-000006',
      project: { id: UUIDS.project, name: 'P' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.create({
      title: 'تیکت',
      description: 'توضیحات',
      projectId: UUIDS.project,
    });

    const createArg = ctx.prisma.ticket.create.mock.calls[0][0];
    expect(createArg.data.ticketNumber).toMatch(/^TKT-\d{4}-000006$/);
  });

  it('creates attachments along with ticket', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: null,
      isActive: true,
    });
    ctx.prisma.ticket.findFirst.mockResolvedValue(null);
    ctx.prisma.ticket.create.mockResolvedValue({
      id: UUIDS.ticket,
      ticketNumber: 'TKT-1405-000001',
      project: { id: UUIDS.project, name: 'P' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.create({
      title: 'تیکت',
      description: 'توضیحات',
      projectId: UUIDS.project,
      attachments: [
        { fileName: 'a.pdf', filePath: '/a.pdf', fileType: 'application/pdf', fileSize: 100 },
      ],
    });

    const createArg = ctx.prisma.ticket.create.mock.calls[0][0];
    expect(createArg.data.attachments).toBeDefined();
    expect(createArg.data.attachments.create).toHaveLength(1);
  });

  it('sends notifications to managers on create', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      employerUserId: UUIDS.employer,
      isActive: true,
    });
    ctx.prisma.ticket.findFirst.mockResolvedValue(null);
    ctx.prisma.ticket.create.mockResolvedValue({
      id: UUIDS.ticket,
      ticketNumber: 'TKT-1405-000001',
      project: { id: UUIDS.project, name: 'Project A' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.admin }, { id: UUIDS.manager }]);

    const caller = createCaller(ctx);
    await caller.create({
      title: 'تیکت',
      description: 'توضیحات',
      projectId: UUIDS.project,
    });

    expect(ctx.prisma.notification.createMany).toHaveBeenCalled();
    const notifArg = ctx.prisma.notification.createMany.mock.calls[0][0];
    expect(notifArg.data).toHaveLength(2);
    expect(notifArg.data[0].type).toBe('TICKET_CREATED');
  });
});

// ─── addReply ───────────────────────────────────────────────────────────────

describe('ticketRouter.addReply', () => {
  it('creates reply for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticketReply.create.mockResolvedValue({
      id: UUIDS.reply,
      content: 'پاسخ',
      user: { id: UUIDS.admin, fullName: 'Admin' },
    });

    const caller = createCaller(ctx);
    const result = await caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ' });

    expect(result.id).toBe(UUIDS.reply);
  });

  it('creates reply for EMPLOYER on their own ticket', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticketReply.create.mockResolvedValue({
      id: UUIDS.reply,
      content: 'پاسخ کارفرما',
      user: { id: UUIDS.employer, fullName: 'Employer' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    const result = await caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ کارفرما' });

    expect(result.id).toBe(UUIDS.reply);
  });

  it('throws FORBIDDEN for EMPLOYER on another employer ticket', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      createdById: UUIDS.employer2,
      project: { employerUserId: UUIDS.employer2 },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ' })
    ).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws BAD_REQUEST when ticket is CLOSED', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'CLOSED',
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ' })
    ).rejects.toThrow('تیکت بسته شده است');
  });

  it('throws NOT_FOUND when ticket does not exist', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ' })
    ).rejects.toThrow('تیکت یافت نشد');
  });

  it('sends notification to ticket creator when manager replies', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticketReply.create.mockResolvedValue({ id: UUIDS.reply });

    const caller = createCaller(ctx);
    await caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ مدیر' });

    expect(ctx.prisma.notification.create).toHaveBeenCalled();
    const notifArg = ctx.prisma.notification.create.mock.calls[0][0];
    expect(notifArg.data.userId).toBe(UUIDS.employer);
    expect(notifArg.data.type).toBe('TICKET_REPLY');
  });

  it('sends notifications to managers when employer replies', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticketReply.create.mockResolvedValue({ id: UUIDS.reply });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.admin }]);

    const caller = createCaller(ctx);
    await caller.addReply({ ticketId: UUIDS.ticket, content: 'پاسخ کارفرما' });

    expect(ctx.prisma.notification.createMany).toHaveBeenCalled();
  });
});

// ─── addAttachment ──────────────────────────────────────────────────────────

describe('ticketRouter.addAttachment', () => {
  it('creates attachment for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticketAttachment.create.mockResolvedValue({ id: UUIDS.attachment });

    const caller = createCaller(ctx);
    const result = await caller.addAttachment({
      ticketId: UUIDS.ticket,
      fileName: 'doc.pdf',
      filePath: '/uploads/tickets/pdf/doc.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
    });

    expect(result.id).toBe(UUIDS.attachment);
  });

  it('throws FORBIDDEN for EMPLOYER on another employer ticket', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      project: { employerUserId: UUIDS.employer2 },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addAttachment({
        ticketId: UUIDS.ticket,
        fileName: 'doc.pdf',
        filePath: '/doc.pdf',
        fileType: 'application/pdf',
        fileSize: 100,
      })
    ).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws BAD_REQUEST when ticket is CLOSED', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'CLOSED',
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addAttachment({
        ticketId: UUIDS.ticket,
        fileName: 'doc.pdf',
        filePath: '/doc.pdf',
        fileType: 'application/pdf',
        fileSize: 100,
      })
    ).rejects.toThrow('تیکت بسته شده است');
  });
});

// ─── updateStatus ───────────────────────────────────────────────────────────

describe('ticketRouter.updateStatus', () => {
  it('updates status for MANAGER', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.ticket.update.mockResolvedValue({ id: UUIDS.ticket, status: 'IN_PROGRESS' });
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    const result = await caller.updateStatus({ id: UUIDS.ticket, status: 'IN_PROGRESS' });

    expect(result.status).toBe('IN_PROGRESS');
  });

  it('sets closedById and closedAt when status is CLOSED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.ticket.update.mockResolvedValue({ id: UUIDS.ticket, status: 'CLOSED' });
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    await caller.updateStatus({ id: UUIDS.ticket, status: 'CLOSED' });

    const updateArg = ctx.prisma.ticket.update.mock.calls[0][0];
    expect(updateArg.data.closedById).toBe(UUIDS.manager);
    expect(updateArg.data.closedAt).toBeDefined();
  });

  it('sends notification to employer on status change', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.ticket.update.mockResolvedValue({ id: UUIDS.ticket });
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      createdById: UUIDS.employer,
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    await caller.updateStatus({ id: UUIDS.ticket, status: 'RESOLVED' });

    expect(ctx.prisma.notification.create).toHaveBeenCalled();
    const notifArg = ctx.prisma.notification.create.mock.calls[0][0];
    expect(notifArg.data.userId).toBe(UUIDS.employer);
    expect(notifArg.data.type).toBe('TICKET_STATUS_CHANGED');
  });
});

// ─── close ──────────────────────────────────────────────────────────────────

describe('ticketRouter.close', () => {
  it('closes ticket for EMPLOYER who owns the project', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticket.update.mockResolvedValue({ id: UUIDS.ticket, status: 'CLOSED' });

    const caller = createCaller(ctx);
    const result = await caller.close({ id: UUIDS.ticket });

    expect(result.status).toBe('CLOSED');
    const updateArg = ctx.prisma.ticket.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe('CLOSED');
    expect(updateArg.data.closedById).toBe(UUIDS.employer);
  });

  it('closes ticket for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      project: { employerUserId: UUIDS.employer },
    });
    ctx.prisma.ticket.update.mockResolvedValue({ id: UUIDS.ticket, status: 'CLOSED' });

    const caller = createCaller(ctx);
    const result = await caller.close({ id: UUIDS.ticket });
    expect(result.status).toBe('CLOSED');
  });

  it('throws FORBIDDEN for EMPLOYER on another employer ticket', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'OPEN',
      project: { employerUserId: UUIDS.employer2 },
    });

    const caller = createCaller(ctx);
    await expect(caller.close({ id: UUIDS.ticket })).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws BAD_REQUEST when ticket is already CLOSED', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue({
      id: UUIDS.ticket,
      status: 'CLOSED',
      project: { employerUserId: UUIDS.employer },
    });

    const caller = createCaller(ctx);
    await expect(caller.close({ id: UUIDS.ticket })).rejects.toThrow('تیکت قبلاً بسته شده است');
  });

  it('throws NOT_FOUND when ticket does not exist', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(caller.close({ id: UUIDS.ticket })).rejects.toThrow('تیکت یافت نشد');
  });
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe('ticketRouter.delete', () => {
  it('deletes ticket for MANAGER', async () => {
    const ctx = makeCtx('MANAGER');
    ctx.prisma.ticket.delete.mockResolvedValue({ id: UUIDS.ticket });

    const caller = createCaller(ctx);
    const result = await caller.delete({ id: UUIDS.ticket });
    expect(result.id).toBe(UUIDS.ticket);
  });

  it('deletes ticket for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.delete.mockResolvedValue({ id: UUIDS.ticket });

    const caller = createCaller(ctx);
    const result = await caller.delete({ id: UUIDS.ticket });
    expect(result.id).toBe(UUIDS.ticket);
  });
});

// ─── stats ──────────────────────────────────────────────────────────────────

describe('ticketRouter.stats', () => {
  it('returns stats for ADMIN (all tickets)', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.ticket.groupBy.mockResolvedValue([
      { status: 'OPEN', _count: { _all: 5 } },
      { status: 'CLOSED', _count: { _all: 3 } },
    ]);
    ctx.prisma.ticket.count.mockResolvedValue(8);
    ctx.prisma.ticket.findMany.mockResolvedValue([{ id: UUIDS.ticket }]);

    const caller = createCaller(ctx);
    const result = await caller.stats();

    expect(result.total).toBe(8);
    expect(result.byStatus).toHaveLength(2);
    expect(result.recent).toHaveLength(1);
  });

  it('filters stats by employerUserId for EMPLOYER', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.ticket.groupBy.mockResolvedValue([]);
    ctx.prisma.ticket.count.mockResolvedValue(0);
    ctx.prisma.ticket.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.stats();

    const groupByArg = ctx.prisma.ticket.groupBy.mock.calls[0][0];
    expect(groupByArg.where.project).toEqual({ employerUserId: UUIDS.employer });
  });
});

// ─── myProjects ─────────────────────────────────────────────────────────────

describe('ticketRouter.myProjects', () => {
  it('returns projects for EMPLOYER', async () => {
    const ctx = makeCtx('EMPLOYER', UUIDS.employer);
    ctx.prisma.project.findMany.mockResolvedValue([
      { id: UUIDS.project, name: 'Project A', code: 'PRJ-2026-0001' },
    ]);

    const caller = createCaller(ctx);
    const result = await caller.myProjects();

    expect(result).toHaveLength(1);
    const arg = ctx.prisma.project.findMany.mock.calls[0][0];
    expect(arg.where.employerUserId).toBe(UUIDS.employer);
    expect(arg.where.isActive).toBe(true);
  });

  it('throws FORBIDDEN for non-EMPLOYER role', async () => {
    const ctx = makeCtx('ADMIN');

    const caller = createCaller(ctx);
    await expect(caller.myProjects()).rejects.toThrow('فقط کارفرما');
  });

  it('throws FORBIDDEN for CONTRACTOR role', async () => {
    const ctx = makeCtx('CONTRACTOR');

    const caller = createCaller(ctx);
    await expect(caller.myProjects()).rejects.toThrow('فقط کارفرما');
  });
});
