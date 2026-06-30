import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { documentRouter } from '../server/api/routers/document';

const createCaller = createCallerFactory(documentRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  user: '33333333-3333-4333-8333-333333333333',
  customer: '44444444-4444-4444-8444-444444444444',
  doc: '55555555-5555-4555-8555-555555555555',
};

type Role = 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR';

function makeCtx(role: Role = 'ADMIN') {
  const document = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };

  const approval = {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  };

  const tx = {
    document,
    approval,
  };

  return {
    session: {
      user: {
        id: UUIDS.admin,
        role,
      },
    },
    prisma: {
      document,
      approval,
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    },
  } as any;
}

describe('documentRouter.list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds where for types/search/deepSearch/date range and maps response fields', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findMany.mockResolvedValue([
      {
        id: UUIDS.doc,
        documentType: 'INVOICE',
        totalAmount: 1000,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        customer: { name: 'Customer A' },
        createdBy: { fullName: 'Admin User' },
        _count: { items: 2 },
      },
    ]);
    ctx.prisma.document.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.list({
      page: 2,
      limit: 10,
      types: ['INVOICE', 'PROFORMA'],
      search: 'کابل',
      deepSearch: true,
      dateFrom: new Date('2026-01-01T00:00:00.000Z'),
      dateTo: new Date('2026-01-31T23:59:59.999Z'),
    });

    const arg = ctx.prisma.document.findMany.mock.calls[0][0];
    expect(arg.skip).toBe(10);
    expect(arg.where.documentType).toEqual({ in: ['INVOICE', 'PROFORMA'] });
    expect(arg.where.issueDate).toEqual({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lte: new Date('2026-01-31T23:59:59.999Z'),
    });
    expect(arg.where.OR.length).toBeGreaterThan(3);
    expect(result.data[0].customerName).toBe('Customer A');
    expect(result.data[0].createdByName).toBe('Admin User');
    expect(result.data[0].itemsCount).toBe(2);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });

  it('uses documentType when types is not provided', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findMany.mockResolvedValue([]);
    ctx.prisma.document.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 10, documentType: 'RECEIPT' });

    const arg = ctx.prisma.document.findMany.mock.calls[0][0];
    expect(arg.where.documentType).toBe('RECEIPT');
  });
});

describe('documentRouter.exportFiltered', () => {
  it('returns flattened export payload with capped take', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findMany.mockResolvedValue([
      {
        id: UUIDS.doc,
        documentType: 'RECEIPT',
        approvalStatus: 'APPROVED',
        approvalOrder: 1,
        totalAmount: 250000,
        createdAt: new Date('2026-02-10T09:00:00.000Z'),
        customer: { name: 'Customer B' },
        createdBy: { fullName: 'Manager User' },
      },
    ]);

    const caller = createCaller(ctx);
    const result = await caller.exportFiltered({
      types: ['RECEIPT'],
      search: 'Customer',
      deepSearch: false,
    });

    const arg = ctx.prisma.document.findMany.mock.calls[0][0];
    expect(arg.take).toBe(5000);
    expect(arg.where.documentType).toEqual({ in: ['RECEIPT'] });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: UUIDS.doc,
        documentType: 'RECEIPT',
        customerName: 'Customer B',
      })
    );
  });
});

describe('documentRouter.getById', () => {
  it('throws when document is not found', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.doc })).rejects.toThrow('سند یافت نشد');
  });
});

describe('documentRouter.create', () => {
  it('creates TEMP_PROFORMA with pending approval and creates approval record', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findFirst.mockResolvedValue({ documentNumber: 'TMP-2026-000001' });
    ctx.prisma.document.create.mockResolvedValue({ id: UUIDS.doc, documentType: 'TEMP_PROFORMA' });
    ctx.prisma.approval.create.mockResolvedValue({ id: 'ap-1' });

    const caller = createCaller(ctx);
    await caller.create({
      documentType: 'TEMP_PROFORMA',
      customerId: UUIDS.customer,
      issueDate: new Date('2026-03-01T00:00:00.000Z'),
      discountAmount: 0,
      items: [
        {
          productName: 'Item 1',
          quantity: 1,
          unit: 'pcs',
          purchasePrice: 100,
          sellPrice: 130,
          supplier: 'Supplier',
          isManualPrice: false,
        },
      ],
    });

    const createArg = ctx.prisma.document.create.mock.calls[0][0];
    expect(createArg.data.approvalStatus).toBe('PENDING');
    expect(ctx.prisma.approval.create).toHaveBeenCalled();
  });

  it('creates INVOICE as approved and does not create approval record', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findFirst.mockResolvedValue(null);
    ctx.prisma.document.create.mockResolvedValue({ id: UUIDS.doc, documentType: 'INVOICE' });

    const caller = createCaller(ctx);
    await caller.create({
      documentType: 'INVOICE',
      customerId: UUIDS.customer,
      issueDate: new Date('2026-03-01T00:00:00.000Z'),
      discountAmount: 0,
      items: [
        {
          productName: 'Item 1',
          quantity: 1,
          unit: 'pcs',
          purchasePrice: 100,
          sellPrice: 130,
          supplier: 'Supplier',
          isManualPrice: false,
        },
      ],
    });

    const createArg = ctx.prisma.document.create.mock.calls[0][0];
    expect(createArg.data.approvalStatus).toBe('APPROVED');
    expect(ctx.prisma.approval.create).not.toHaveBeenCalled();
  });
});

describe('documentRouter.convert', () => {
  it('throws for invalid conversion path', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.document.findUnique.mockResolvedValue({
      id: UUIDS.doc,
      documentType: 'RECEIPT',
      customerId: UUIDS.customer,
      dueDate: null,
      totalAmount: 100,
      discountAmount: 0,
      finalAmount: 100,
      notes: null,
      defaultProfitPercentage: 20,
      items: [],
    });

    const caller = createCaller(ctx);
    await expect(caller.convert({ id: UUIDS.doc, toType: 'INVOICE' })).rejects.toThrow('تبدیل این نوع سند مجاز نیست');
  });
});

describe('documentRouter.pendingApprovals and staleDocuments', () => {
  it('forbids USER role from pendingApprovals', async () => {
    const ctx = makeCtx('USER');
    const caller = createCaller(ctx);

    await expect(caller.pendingApprovals()).rejects.toThrow('شما دسترسی به این بخش ندارید');
  });

  it('returns pending approvals for manager/admin', async () => {
    const ctx = makeCtx('MANAGER');
    ctx.prisma.approval.findMany.mockResolvedValue([{ id: 'a1' }]);

    const caller = createCaller(ctx);
    const result = await caller.pendingApprovals();

    expect(ctx.prisma.approval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('forbids USER role from staleDocuments', async () => {
    const ctx = makeCtx('USER');
    const caller = createCaller(ctx);

    await expect(caller.staleDocuments()).rejects.toThrow('شما دسترسی به این بخش ندارید');
  });

  it('queries stale approvals older than one month for manager/admin', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.approval.findMany.mockResolvedValue([{ id: 'a2' }]);

    const caller = createCaller(ctx);
    const result = await caller.staleDocuments();

    const arg = ctx.prisma.approval.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe('PENDING');
    expect(arg.where.createdAt.lt).toBeInstanceOf(Date);
    expect(result).toEqual([{ id: 'a2' }]);
  });
});
