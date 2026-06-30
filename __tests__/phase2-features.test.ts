import { describe, it, expect, jest } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { workReportRouter } from '../server/api/routers/workReport';
import { contractorDocRouter } from '../server/api/routers/contractorDoc';

const createWorkReportCaller = createCallerFactory(workReportRouter);
const createContractorDocCaller = createCallerFactory(contractorDocRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  contractor: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
  report: '55555555-5555-4555-8555-555555555555',
  doc: '66666666-6666-4666-8666-666666666666',
};

function makeWorkReportCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
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
      projectMember: { findUnique: jest.fn() },
      workDescription: { upsert: jest.fn(), findMany: jest.fn() },
      workReportItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn(), createMany: jest.fn() },
      workReportAudit: { create: jest.fn(), findMany: jest.fn() },
    },
  } as any;
}

function makeContractorDocCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: { user: { id: userId, role } },
    prisma: {
      contractorDoc: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      contractorDocItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      contractorDocAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
      projectMember: { findUnique: jest.fn() },
      project: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb({
        contractorDocItem: { deleteMany: jest.fn(), createMany: jest.fn() },
        contractorDocAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
        contractorDoc: { update: jest.fn().mockResolvedValue({ id: UUIDS.doc }) },
      })),
    },
  } as any;
}

describe('Phase 2 — 2.2: workReport.listMine', () => {
  it('filters by createdById for contractor', async () => {
    const ctx = makeWorkReportCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createWorkReportCaller(ctx);
    await caller.listMine({ page: 1, limit: 20 });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBe(UUIDS.contractor);
  });

  it('does not filter by createdById for manager', async () => {
    const ctx = makeWorkReportCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createWorkReportCaller(ctx);
    await caller.listMine({ page: 1, limit: 20 });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBeUndefined();
  });

  it('filters by status and projectId', async () => {
    const ctx = makeWorkReportCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createWorkReportCaller(ctx);
    await caller.listMine({ page: 1, limit: 20, status: 'PENDING', projectId: UUIDS.project });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.approvalStatus).toBe('PENDING');
    expect(arg.where.projectId).toBe(UUIDS.project);
  });

  it('computes totalAmount from items totalPrice', async () => {
    const ctx = makeWorkReportCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([
      { id: UUIDS.report, items: [{ totalPrice: 500 }, { totalPrice: 300 }] },
    ]);
    ctx.prisma.workReport.count.mockResolvedValue(1);

    const caller = createWorkReportCaller(ctx);
    const result = await caller.listMine({ page: 1, limit: 20 });

    expect(result.data[0].totalAmount).toBe(800);
  });

  it('returns correct pagination meta', async () => {
    const ctx = makeWorkReportCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(45);

    const caller = createWorkReportCaller(ctx);
    const result = await caller.listMine({ page: 2, limit: 20 });

    expect(result.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });
});

describe('Phase 2 — 2.3: contractorDoc.listMine', () => {
  it('filters by createdById for contractor', async () => {
    const ctx = makeContractorDocCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(0);

    const caller = createContractorDocCaller(ctx);
    await caller.listMine({ page: 1, limit: 20 });

    const arg = ctx.prisma.contractorDoc.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBe(UUIDS.contractor);
  });

  it('does not filter by createdById for manager', async () => {
    const ctx = makeContractorDocCtx('MANAGER', UUIDS.manager);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(0);

    const caller = createContractorDocCaller(ctx);
    await caller.listMine({ page: 1, limit: 20 });

    const arg = ctx.prisma.contractorDoc.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBeUndefined();
  });

  it('filters by status', async () => {
    const ctx = makeContractorDocCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(0);

    const caller = createContractorDocCaller(ctx);
    await caller.listMine({ page: 1, limit: 10, status: 'APPROVED' });

    const arg = ctx.prisma.contractorDoc.findMany.mock.calls[0][0];
    expect(arg.where.approvalStatus).toBe('APPROVED');
  });

  it('includes item and attachment counts', async () => {
    const ctx = makeContractorDocCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(0);

    const caller = createContractorDocCaller(ctx);
    await caller.listMine({ page: 1, limit: 20 });

    const arg = ctx.prisma.contractorDoc.findMany.mock.calls[0][0];
    expect(arg.include._count).toEqual({ select: { items: true, attachments: true } });
  });

  it('returns correct pagination meta', async () => {
    const ctx = makeContractorDocCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(25);

    const caller = createContractorDocCaller(ctx);
    const result = await caller.listMine({ page: 1, limit: 20 });

    expect(result.meta).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
  });
});
