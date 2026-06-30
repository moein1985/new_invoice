import { describe, it, expect, jest } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { workReportRouter } from '../server/api/routers/workReport';

const createCaller = createCallerFactory(workReportRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  contractor: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
  report: '55555555-5555-4555-8555-555555555555',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: { user: { id: userId, role } },
    prisma: {
      workReport: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      workDescription: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      workReportItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      workReportAudit: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    },
  } as any;
}

describe('workReportRouter.list and listAll', () => {
  it('filters contractor list by createdById', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ projectId: UUIDS.project, page: 1, limit: 20 });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBe(UUIDS.contractor);
  });

  it('builds listAll filters for manager', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findMany.mockResolvedValue([{ id: UUIDS.report }]);
    ctx.prisma.workReport.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.listAll({ page: 1, limit: 10, search: 'wr', approvalStatus: 'PENDING' });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.approvalStatus).toBe('PENDING');
    expect(arg.where.OR).toHaveLength(3);
    expect(result.meta.total).toBe(1);
  });
});

describe('workReportRouter.create', () => {
  it('forbids contractor not in project membership', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.create({
        projectId: UUIDS.project,
        items: [{ description: 'desc', unit: 'h', quantity: 1 }],
      })
    ).rejects.toThrow('شما عضو این پروژه نیستید');
  });

  it('generates report number and persists descriptions', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findFirst.mockResolvedValue({ reportNumber: 'WR-2026-0010' });
    ctx.prisma.workReport.create.mockResolvedValue({ id: UUIDS.report, reportNumber: 'WR-2026-0011', project: { name: 'Test' } });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.admin }]);

    const caller = createCaller(ctx);
    await caller.create({
      projectId: UUIDS.project,
      items: [
        { description: 'desc 1', unit: 'h', quantity: 2 },
        { description: 'desc 2', unit: 'm', quantity: 1 },
      ],
    });

    expect(ctx.prisma.workDescription.upsert).toHaveBeenCalledTimes(2);
    const arg = ctx.prisma.workReport.create.mock.calls[0][0];
    expect(arg.data.reportNumber).toMatch(/^WR-\d{4}-0011$/);
  });
});

describe('workReportRouter.update/delete', () => {
  it('resets rejected status to pending on contractor edit and keeps zero prices', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.contractor,
      approvalStatus: 'REJECTED',
    });
    ctx.prisma.workReport.update.mockResolvedValue({ id: UUIDS.report, approvalStatus: 'PENDING' });

    const caller = createCaller(ctx);
    await caller.update({
      id: UUIDS.report,
      items: [{ description: 'x', unit: 'h', quantity: 2 }],
      notes: 'n',
    });

    const createManyArg = ctx.prisma.workReportItem.createMany.mock.calls[0][0];
    expect(createManyArg.data[0].unitPrice).toBe(0);

    const updateArg = ctx.prisma.workReport.update.mock.calls[0][0];
    expect(updateArg.data.approvalStatus).toBe('PENDING');
  });

  it('blocks contractor from deleting approved report', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.contractor,
      approvalStatus: 'APPROVED',
    });

    const caller = createCaller(ctx);
    await expect(caller.delete({ id: UUIDS.report })).rejects.toThrow('گزارش تایید شده قابل حذف نیست');
  });
});

describe('workReportRouter other endpoints', () => {
  it('approves/rejects as manager and supports suggestions/pendingCount', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({ id: UUIDS.report, approvalStatus: 'APPROVED' });
    ctx.prisma.workDescription.findMany.mockResolvedValue([{ text: 'desc' }]);
    ctx.prisma.workReport.count.mockResolvedValue(5);

    const caller = createCaller(ctx);
    const approved = await caller.approve({ id: UUIDS.report });
    await caller.reject({ id: UUIDS.report, comment: 'not ok' });
    const suggestions = await caller.searchDescriptions({ query: 'de' });
    const pending = await caller.pendingCount();

    expect(approved.approvalStatus).toBe('APPROVED');
    expect(Array.isArray(suggestions)).toBe(true);
    expect(pending).toBe(5);
  });
});
