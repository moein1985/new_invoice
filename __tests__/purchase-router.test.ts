import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
  },
}));

import { createCallerFactory } from '../server/api/trpc';
import { purchaseRouter } from '../server/api/routers/purchase';

const createCaller = createCallerFactory(purchaseRouter);

type Role = 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR';

function makeCtx(role: Role = 'ADMIN', userId = 'u-admin') {
  return {
    session: {
      user: {
        id: userId,
        role,
      },
    },
    prisma: {
      purchaseRequest: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      purchaseInquiry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    },
  } as any;
}

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  worker: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
  request: '55555555-5555-4555-8555-555555555555',
  inquiry: '66666666-6666-4666-8666-666666666666',
};

describe('purchaseRouter.list', () => {
  it('applies assignedToId filter for USER role', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20 });

    expect(ctx.prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedToId: UUIDS.worker }),
      })
    );
  });

  it('builds search OR clauses and returns pagination meta', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([{ id: 'p1' }]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.list({
      page: 2,
      limit: 10,
      search: 'کابل',
      status: 'INQUIRED',
    });

    const arg = ctx.prisma.purchaseRequest.findMany.mock.calls[0][0];
    expect(arg.skip).toBe(10);
    expect(arg.where.status).toBe('INQUIRED');
    expect(arg.where.OR).toHaveLength(3);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });
});

describe('purchaseRouter.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates request number and sets PENDING_INQUIRY when assigned', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findFirst.mockResolvedValue({ requestNumber: 'PR-1405-000009' });
    ctx.prisma.purchaseRequest.create.mockResolvedValue({ id: 'pr-1', title: 'خرید کابل' });
    ctx.prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const caller = createCaller(ctx);
    await caller.create({
      title: 'خرید کابل',
      priority: 'HIGH',
      assignedToId: UUIDS.worker,
      items: [
        {
          productName: 'کابل',
          quantity: 2,
          unit: 'عدد',
        },
      ],
    });

    const createArg = ctx.prisma.purchaseRequest.create.mock.calls[0][0];
    expect(createArg.data.status).toBe('PENDING_INQUIRY');
    expect(createArg.data.requestNumber).toMatch(/^PR-\d{4}-000010$/);
    expect(ctx.prisma.notification.create).toHaveBeenCalled();
  });
});

describe('purchaseRouter.submit', () => {
  it('rejects when submitter is not assigned user', async () => {
    const ctx = makeCtx('USER', UUIDS.other);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
      createdById: UUIDS.admin,
      _count: { inquiries: 2 },
    });

    const caller = createCaller(ctx);

    await expect(caller.submit({ id: UUIDS.request })).rejects.toThrow('فقط کاربر تخصیص‌یافته می‌تواند ارسال کند');
  });

  it('updates status to INQUIRED and creates notification on success', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
      createdById: UUIDS.admin,
      _count: { inquiries: 1 },
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({ id: UUIDS.request, status: 'INQUIRED' });
    ctx.prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const caller = createCaller(ctx);
    const result = await caller.submit({ id: UUIDS.request });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'INQUIRED' } })
    );
    expect(ctx.prisma.notification.create).toHaveBeenCalled();
    expect(result.status).toBe('INQUIRED');
  });
});

describe('purchaseRouter.approveInquiry', () => {
  it('sets APPROVED and approvedInquiryId when inquiry belongs to request', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
    });
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      purchaseRequestId: UUIDS.request,
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({
      id: UUIDS.request,
      status: 'APPROVED',
      approvedInquiryId: UUIDS.inquiry,
    });

    const caller = createCaller(ctx);
    const result = await caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedInquiryId: UUIDS.inquiry }),
      })
    );
    expect(result.status).toBe('APPROVED');
  });
});
