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

describe('Phase 1 — 1.2: reject stores rejectionReason', () => {
  it('saves rejectionReason in update data', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'REJECTED',
      rejectionReason: 'ناقص است',
    });

    const caller = createCaller(ctx);
    const result = await caller.reject({ id: UUIDS.report, comment: 'ناقص است' });

    const updateArg = ctx.prisma.workReport.update.mock.calls[0][0];
    expect(updateArg.data.approvalStatus).toBe('REJECTED');
    expect(updateArg.data.rejectionReason).toBe('ناقص است');
    expect(result.approvalStatus).toBe('REJECTED');
  });

  it('stores null when no comment provided', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'REJECTED',
      rejectionReason: null,
    });

    const caller = createCaller(ctx);
    await caller.reject({ id: UUIDS.report });

    const updateArg = ctx.prisma.workReport.update.mock.calls[0][0];
    expect(updateArg.data.rejectionReason).toBeNull();
  });
});

describe('Phase 1 — 1.3: create sends notifications to managers', () => {
  it('creates notifications for all active managers', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.workReport.findFirst.mockResolvedValue({ reportNumber: 'WR-2026-0010' });
    ctx.prisma.workReport.create.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0011',
      project: { name: 'Test Project' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([
      { id: UUIDS.admin },
      { id: UUIDS.manager },
    ]);

    const caller = createCaller(ctx);
    await caller.create({
      projectId: UUIDS.project,
      items: [{ description: 'test', unit: 'متر', quantity: 5 }],
    });

    expect(ctx.prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const notifArg = ctx.prisma.notification.createMany.mock.calls[0][0];
    expect(notifArg.data).toHaveLength(2);
    expect(notifArg.data[0].type).toBe('WORK_REPORT_SUBMITTED');
    expect(notifArg.data[0].message).toContain('WR-2026-0011');
  });

  it('does not create notifications when no managers exist', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.workReport.findFirst.mockResolvedValue({ reportNumber: 'WR-2026-0010' });
    ctx.prisma.workReport.create.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0011',
      project: { name: 'Test Project' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.create({
      projectId: UUIDS.project,
      items: [{ description: 'test', unit: 'متر', quantity: 5 }],
    });

    expect(ctx.prisma.notification.createMany).not.toHaveBeenCalled();
  });
});

describe('Phase 1 — 1.4: approve sends notification to contractor', () => {
  it('creates WORK_REPORT_APPROVED notification', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'APPROVED',
    });

    const caller = createCaller(ctx);
    await caller.approve({ id: UUIDS.report });

    expect(ctx.prisma.notification.create).toHaveBeenCalledTimes(1);
    const notifArg = ctx.prisma.notification.create.mock.calls[0][0];
    expect(notifArg.data.type).toBe('WORK_REPORT_APPROVED');
    expect(notifArg.data.userId).toBe(UUIDS.contractor);
    expect(notifArg.data.message).toContain('WR-2026-0001');
  });

  it('clears rejectionReason on approve', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'APPROVED',
    });

    const caller = createCaller(ctx);
    await caller.approve({ id: UUIDS.report });

    const updateArg = ctx.prisma.workReport.update.mock.calls[0][0];
    expect(updateArg.data.approvalStatus).toBe('APPROVED');
    expect(updateArg.data.rejectionReason).toBeNull();
  });
});

describe('Phase 1 — 1.5: update recalculates totalAmount', () => {
  it('calculates totalAmount from item totalPrice sums', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.manager,
      approvalStatus: 'PENDING',
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'PENDING',
      items: [],
      project: { name: 'P', code: 'C' },
    });

    const caller = createCaller(ctx);
    await caller.update({
      id: UUIDS.report,
      items: [
        { description: 'a', unit: 'متر', quantity: 10, unitPrice: 100 },
        { description: 'b', unit: 'عدد', quantity: 5, unitPrice: 200 },
      ],
      notes: 'test',
    });

    const createManyArg = ctx.prisma.workReportItem.createMany.mock.calls[0][0];
    expect(createManyArg.data[0].totalPrice).toBe(1000);
    expect(createManyArg.data[1].totalPrice).toBe(1000);

    const updateArg = ctx.prisma.workReport.update.mock.calls[0][0];
    expect(updateArg.data.totalAmount).toBe(2000);
  });

  it('contractor items have zero unitPrice and totalPrice', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.contractor,
      approvalStatus: 'PENDING',
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'PENDING',
      items: [],
      project: { name: 'P', code: 'C' },
    });

    const caller = createCaller(ctx);
    await caller.update({
      id: UUIDS.report,
      items: [{ description: 'a', unit: 'متر', quantity: 10 }],
      notes: 'test',
    });

    const createManyArg = ctx.prisma.workReportItem.createMany.mock.calls[0][0];
    expect(createManyArg.data[0].unitPrice).toBe(0);
    expect(createManyArg.data[0].totalPrice).toBe(0);
  });
});
