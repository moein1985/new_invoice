import { describe, it, expect, jest } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { statsRouter } from '../server/api/routers/stats';

const createCaller = createCallerFactory(statsRouter);

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' = 'ADMIN') {
  return {
    session: {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        role,
      },
    },
    prisma: {
      customer: { count: jest.fn() },
      document: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: { count: jest.fn() },
      $queryRaw: jest.fn(),
    },
  } as any;
}

describe('statsRouter.getDashboardStats', () => {
  it('returns dashboard summary/charts and includes totalUsers for ADMIN', async () => {
    const ctx = makeCtx('ADMIN');

    ctx.prisma.customer.count.mockResolvedValue(10);
    ctx.prisma.document.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(3);
    ctx.prisma.user.count.mockResolvedValue(7);
    ctx.prisma.document.findMany.mockResolvedValue([
      {
        id: 'd1',
        documentNumber: 'INV-1',
        documentType: 'INVOICE',
        finalAmount: 1000,
        approvalStatus: 'APPROVED',
        issueDate: new Date('2026-01-01'),
        customer: { name: 'C1' },
        createdBy: { fullName: 'Admin' },
      },
    ]);
    ctx.prisma.document.groupBy
      .mockResolvedValueOnce([{ documentType: 'INVOICE', _count: { id: 5 } }])
      .mockResolvedValueOnce([{ approvalStatus: 'APPROVED', _count: { id: 4 } }]);
    ctx.prisma.$queryRaw.mockResolvedValue([{ month: '2026-01', total: '2500', count: 2 }]);

    const caller = createCaller(ctx);
    const result = await caller.getDashboardStats();

    expect(result.summary).toEqual({
      totalCustomers: 10,
      totalDocuments: 40,
      pendingApprovals: 3,
      totalUsers: 7,
    });
    expect(result.recentDocuments[0].customerName).toBe('C1');
    expect(result.charts.monthlyRevenue[0].total).toBe(2500);
  });

  it('hides totalUsers for non-admin users', async () => {
    const ctx = makeCtx('MANAGER');

    ctx.prisma.customer.count.mockResolvedValue(1);
    ctx.prisma.document.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);
    ctx.prisma.document.findMany.mockResolvedValue([]);
    ctx.prisma.document.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    ctx.prisma.$queryRaw.mockResolvedValue([]);

    const caller = createCaller(ctx);
    const result = await caller.getDashboardStats();

    expect(result.summary.totalUsers).toBeUndefined();
  });
});

describe('statsRouter.getTopCustomers', () => {
  it('casts numeric totalAmount to Number', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.$queryRaw.mockResolvedValue([
      { id: 'c1', name: 'C1', code: 'C-1', totalAmount: '12500', documentCount: 3 },
    ]);

    const caller = createCaller(ctx);
    const result = await caller.getTopCustomers();

    expect(result[0].totalAmount).toBe(12500);
    expect(typeof result[0].totalAmount).toBe('number');
  });
});
