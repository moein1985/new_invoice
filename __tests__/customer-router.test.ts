import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { customerRouter } from '../server/api/routers/customer';

const createCaller = createCallerFactory(customerRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  customer: '22222222-2222-4222-8222-222222222222',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' = 'ADMIN') {
  return {
    session: {
      user: {
        id: UUIDS.admin,
        role,
      },
    },
    prisma: {
      customer: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      document: {
        count: jest.fn(),
      },
    },
  } as any;
}

describe('customerRouter.list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies search filters and returns mapped documentCount', async () => {
    const ctx = makeCtx();
    ctx.prisma.customer.findMany.mockResolvedValue([
      {
        id: UUIDS.customer,
        code: 'CUST-0001',
        name: 'Test Customer',
        phone: '09120000000',
        _count: { documents: 4 },
      },
    ]);
    ctx.prisma.customer.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.list({ page: 1, limit: 10, search: 'test' });

    const arg = ctx.prisma.customer.findMany.mock.calls[0][0];
    expect(arg.where.OR).toHaveLength(3);
    expect(result.data[0].documentCount).toBe(4);
    expect(result.meta.totalPages).toBe(1);
  });
});

describe('customerRouter.create', () => {
  it('generates next code from last customer code', async () => {
    const ctx = makeCtx();
    ctx.prisma.customer.findFirst.mockResolvedValue({ code: 'CUST-0012' });
    ctx.prisma.customer.create.mockResolvedValue({ id: UUIDS.customer, code: 'CUST-0013' });

    const caller = createCaller(ctx);
    await caller.create({ name: 'C1', phone: '0912' });

    expect(ctx.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'CUST-0013' }) })
    );
  });

  it('starts from CUST-0001 when there is no previous code', async () => {
    const ctx = makeCtx();
    ctx.prisma.customer.findFirst.mockResolvedValue(null);
    ctx.prisma.customer.create.mockResolvedValue({ id: UUIDS.customer, code: 'CUST-0001' });

    const caller = createCaller(ctx);
    await caller.create({ name: 'C1', phone: '0912' });

    expect(ctx.prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'CUST-0001' }) })
    );
  });
});

describe('customerRouter.update', () => {
  it('throws when code already used by another customer', async () => {
    const ctx = makeCtx();
    ctx.prisma.customer.findFirst.mockResolvedValue({ id: 'other' });

    const caller = createCaller(ctx);
    await expect(
      caller.update({ id: UUIDS.customer, code: 'CUST-0002' })
    ).rejects.toThrow('کد مشتری قبلاً استفاده شده است');
  });
});

describe('customerRouter.delete', () => {
  it('blocks delete when customer has documents', async () => {
    const ctx = makeCtx();
    ctx.prisma.document.count.mockResolvedValue(3);

    const caller = createCaller(ctx);
    await expect(caller.delete({ id: UUIDS.customer })).rejects.toThrow('نمی\u200cتوان آن را حذف کرد');
  });

  it('deletes customer when no documents exist', async () => {
    const ctx = makeCtx();
    ctx.prisma.document.count.mockResolvedValue(0);
    ctx.prisma.customer.delete.mockResolvedValue({ id: UUIDS.customer });

    const caller = createCaller(ctx);
    const result = await caller.delete({ id: UUIDS.customer });

    expect(ctx.prisma.customer.delete).toHaveBeenCalled();
    expect(result.id).toBe(UUIDS.customer);
  });
});

describe('customerRouter.findByPhone', () => {
  it('returns null for too-short normalized phone', async () => {
    const ctx = makeCtx();
    const caller = createCaller(ctx);

    const result = await caller.findByPhone({ phone: '1234' });
    expect(result).toBeNull();
    expect(ctx.prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('searches with multiple normalized patterns and computes financial summary', async () => {
    const ctx = makeCtx();
    ctx.prisma.customer.findFirst.mockResolvedValue({
      id: UUIDS.customer,
      documents: [
        { documentType: 'INVOICE', finalAmount: 1000 },
        { documentType: 'PROFORMA', finalAmount: 200 },
        { documentType: 'RECEIPT', finalAmount: 300 },
      ],
    });

    const caller = createCaller(ctx);
    const result = await caller.findByPhone({ phone: '+98 912-123-4567' });

    const arg = ctx.prisma.customer.findFirst.mock.calls[0][0];
    expect(arg.where.OR).toHaveLength(4);
    expect(result.financialSummary).toEqual({
      totalInvoices: 1200,
      totalReceipts: 300,
      balance: 900,
    });
  });
});
