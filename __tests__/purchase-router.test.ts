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
      purchaseAudit: {
        create: jest.fn(),
        findMany: jest.fn(),
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
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

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
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets APPROVED and approvedInquiryId when inquiry belongs to request', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
      status: 'INQUIRED',
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
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', approvedInquiryId: UUIDS.inquiry }),
      })
    );
    expect(result.status).toBe('APPROVED');
  });

  it('rejects when request is already APPROVED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'APPROVED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry })
    ).rejects.toThrow('درخواست قبلاً تایید شده است');
  });

  it('rejects when request status is not INQUIRED (e.g. DRAFT)', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'PENDING_INQUIRY',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry })
    ).rejects.toThrow('استعلام‌ها باید ابتدا ارسال شوند');
  });

  it('rejects when inquiry does not belong to request', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'INQUIRED',
    });
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      purchaseRequestId: 'other-request-id',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry })
    ).rejects.toThrow('استعلام یافت نشد');
  });

  it('creates audit log entry', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
      status: 'INQUIRED',
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
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });
    ctx.prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const caller = createCaller(ctx);
    await caller.approveInquiry({ purchaseRequestId: UUIDS.request, inquiryId: UUIDS.inquiry });

    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INQUIRY_APPROVED',
          purchaseRequestId: UUIDS.request,
        }),
      })
    );
  });
});

describe('purchaseRouter.getById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns request for ADMIN', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'test',
      assignedToId: UUIDS.worker,
    });

    const caller = createCaller(ctx);
    const result = await caller.getById({ id: UUIDS.request });
    expect(result.id).toBe(UUIDS.request);
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.request })).rejects.toThrow('درخواست خرید یافت نشد');
  });

  it('throws FORBIDDEN when USER accesses unassigned request', async () => {
    const ctx = makeCtx('USER', UUIDS.other);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
    });

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.request })).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('returns request for USER who is assigned', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
    });

    const caller = createCaller(ctx);
    const result = await caller.getById({ id: UUIDS.request });
    expect(result.id).toBe(UUIDS.request);
  });
});

describe('purchaseRouter.update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.update({ id: UUIDS.request, title: 'updated' })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });

  it('throws BAD_REQUEST when status is APPROVED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'APPROVED',
      assignedToId: null,
    });

    const caller = createCaller(ctx);
    await expect(
      caller.update({ id: UUIDS.request, title: 'updated' })
    ).rejects.toThrow('امکان ویرایش درخواست تایید‌شده/خریداری‌شده وجود ندارد');
  });

  it('updates title and creates audit log', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'DRAFT',
      assignedToId: null,
      title: 'old',
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({ id: UUIDS.request, title: 'new' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.update({ id: UUIDS.request, title: 'new' });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'new' } })
    );
    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'UPDATED' }),
      })
    );
    expect(result.title).toBe('new');
  });

  it('changes status from DRAFT to PENDING_INQUIRY when assignedToId is set', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'DRAFT',
      assignedToId: null,
      title: 'test',
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({ id: UUIDS.request, title: 'test' });
    ctx.prisma.notification.create.mockResolvedValue({ id: 'n1' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.update({ id: UUIDS.request, assignedToId: UUIDS.worker });

    const updateArg = ctx.prisma.purchaseRequest.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe('PENDING_INQUIRY');
    expect(updateArg.data.assignedToId).toBe(UUIDS.worker);
    expect(ctx.prisma.notification.create).toHaveBeenCalled();
  });
});

describe('purchaseRouter.addInquiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates inquiry with items and audit log', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
      status: 'PENDING_INQUIRY',
    });
    ctx.prisma.purchaseInquiry.create.mockResolvedValue({
      id: 'inq-1',
      supplierName: 'test',
      items: [],
      attachments: [],
    });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.addInquiry({
      purchaseRequestId: UUIDS.request,
      supplierName: 'تأمین‌کننده',
      items: [
        {
          purchaseItemId: '77777777-7777-4777-8777-777777777777',
          unitPrice: 1000,
          totalPrice: 2000,
        },
      ],
    });

    const createArg = ctx.prisma.purchaseInquiry.create.mock.calls[0][0];
    expect(createArg.data.totalPrice).toBe(2000);
    expect(createArg.data.supplierName).toBe('تأمین‌کننده');
    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'INQUIRY_ADDED' }),
      })
    );
    expect(result.id).toBe('inq-1');
  });

  it('saves attachments when provided', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
      status: 'PENDING_INQUIRY',
    });
    ctx.prisma.purchaseInquiry.create.mockResolvedValue({
      id: 'inq-1',
      items: [],
      attachments: [],
    });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.addInquiry({
      purchaseRequestId: UUIDS.request,
      supplierName: 'test',
      items: [
        {
          purchaseItemId: '77777777-7777-4777-8777-777777777777',
          unitPrice: 100,
          totalPrice: 200,
        },
      ],
      attachments: [
        {
          fileName: 'proforma.pdf',
          filePath: '/uploads/purchases/proforma.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          type: 'PROFORMA',
        },
      ],
    });

    const createArg = ctx.prisma.purchaseInquiry.create.mock.calls[0][0];
    expect(createArg.data.attachments).toBeDefined();
    expect(createArg.data.attachments.create).toHaveLength(1);
    expect(createArg.data.attachments.create[0].fileName).toBe('proforma.pdf');
  });

  it('throws FORBIDDEN when USER is not assigned', async () => {
    const ctx = makeCtx('USER', UUIDS.other);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
      status: 'PENDING_INQUIRY',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addInquiry({
        purchaseRequestId: UUIDS.request,
        supplierName: 'test',
        items: [{ purchaseItemId: '77777777-7777-4777-8777-777777777777', unitPrice: 100, totalPrice: 200 }],
      })
    ).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws BAD_REQUEST when request is APPROVED', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
      status: 'APPROVED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.addInquiry({
        purchaseRequestId: UUIDS.request,
        supplierName: 'test',
        items: [{ purchaseItemId: '77777777-7777-4777-8777-777777777777', unitPrice: 100, totalPrice: 200 }],
      })
    ).rejects.toThrow('امکان افزودن استعلام به درخواست تایید‌شده/خریداری‌شده وجود ندارد');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.addInquiry({
        purchaseRequestId: UUIDS.request,
        supplierName: 'test',
        items: [{ purchaseItemId: '77777777-7777-4777-8777-777777777777', unitPrice: 100, totalPrice: 200 }],
      })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });

  it('computes totalPrice from items', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      assignedToId: UUIDS.worker,
      status: 'PENDING_INQUIRY',
    });
    ctx.prisma.purchaseInquiry.create.mockResolvedValue({ id: 'inq-1', items: [], attachments: [] });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.addInquiry({
      purchaseRequestId: UUIDS.request,
      supplierName: 'test',
      items: [
        { purchaseItemId: '77777777-7777-4777-8777-777777777777', unitPrice: 1000, totalPrice: 3000 },
        { purchaseItemId: '88888888-8888-4888-8888-888888888888', unitPrice: 500, totalPrice: 1000 },
      ],
    });

    const createArg = ctx.prisma.purchaseInquiry.create.mock.calls[0][0];
    expect(createArg.data.totalPrice).toBe(4000);
  });
});

describe('purchaseRouter.reject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets status to REJECTED with reason and notifies assigned user', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'test',
      assignedToId: UUIDS.worker,
      status: 'INQUIRED',
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({ id: UUIDS.request, status: 'REJECTED' });
    ctx.prisma.notification.create.mockResolvedValue({ id: 'n1' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.reject({ id: UUIDS.request, reason: 'بودجه کافی نیست' });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'بودجه کافی نیست' }),
      })
    );
    expect(ctx.prisma.notification.create).toHaveBeenCalled();
    expect(result.status).toBe('REJECTED');
  });

  it('throws BAD_REQUEST when status is PURCHASED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'PURCHASED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.reject({ id: UUIDS.request, reason: 'test' })
    ).rejects.toThrow('امکان رد درخواست خریداری‌شده وجود ندارد');
  });

  it('throws BAD_REQUEST when already REJECTED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'REJECTED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.reject({ id: UUIDS.request, reason: 'test' })
    ).rejects.toThrow('درخواست قبلاً رد شده است');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.reject({ id: UUIDS.request, reason: 'test' })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });
});

describe('purchaseRouter.markPurchased', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets status to PURCHASED when APPROVED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'APPROVED',
    });
    ctx.prisma.purchaseRequest.update.mockResolvedValue({ id: UUIDS.request, status: 'PURCHASED' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.markPurchased({ id: UUIDS.request });

    expect(ctx.prisma.purchaseRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PURCHASED' } })
    );
    expect(result.status).toBe('PURCHASED');
  });

  it('throws BAD_REQUEST when status is not APPROVED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'INQUIRED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.markPurchased({ id: UUIDS.request })
    ).rejects.toThrow('فقط درخواست‌های تایید‌شده قابل علامت‌گذاری هستند');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.markPurchased({ id: UUIDS.request })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });
});

describe('purchaseRouter.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes request and creates audit log', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'DRAFT',
    });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });
    ctx.prisma.purchaseRequest.delete.mockResolvedValue({ id: UUIDS.request });

    const caller = createCaller(ctx);
    const result = await caller.delete({ id: UUIDS.request });

    expect(ctx.prisma.purchaseRequest.delete).toHaveBeenCalledWith({ where: { id: UUIDS.request } });
    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DELETED' }),
      })
    );
    expect(result.success).toBe(true);
  });

  it('throws BAD_REQUEST when status is PURCHASED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      status: 'PURCHASED',
    });

    const caller = createCaller(ctx);
    await expect(
      caller.delete({ id: UUIDS.request })
    ).rejects.toThrow('امکان حذف درخواست خریداری‌شده وجود ندارد');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.delete({ id: UUIDS.request })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });
});

describe('purchaseRouter.rejectInquiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes inquiry and creates audit log', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      purchaseRequestId: UUIDS.request,
      purchaseRequest: { id: UUIDS.request, status: 'INQUIRED' },
    });
    ctx.prisma.purchaseInquiry.delete.mockResolvedValue({ id: UUIDS.inquiry });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    const result = await caller.rejectInquiry({ inquiryId: UUIDS.inquiry, reason: 'قیمت بالا' });

    expect(ctx.prisma.purchaseInquiry.delete).toHaveBeenCalledWith({ where: { id: UUIDS.inquiry } });
    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'INQUIRY_REJECTED',
          purchaseRequestId: UUIDS.request,
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it('throws NOT_FOUND when inquiry does not exist', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.rejectInquiry({ inquiryId: UUIDS.inquiry })
    ).rejects.toThrow('استعلام یافت نشد');
  });

  it('throws BAD_REQUEST when request is APPROVED', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      purchaseRequestId: UUIDS.request,
      purchaseRequest: { id: UUIDS.request, status: 'APPROVED' },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.rejectInquiry({ inquiryId: UUIDS.inquiry })
    ).rejects.toThrow('درخواست تاییدشده است');
  });
});

describe('purchaseRouter.listAudit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns audit logs for ADMIN without ownership check', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    const mockLogs = [
      { id: 'a1', action: 'CREATED', user: { fullName: 'Admin' } },
      { id: 'a2', action: 'UPDATED', user: { fullName: 'Admin' } },
    ];
    ctx.prisma.purchaseAudit.findMany.mockResolvedValue(mockLogs);

    const caller = createCaller(ctx);
    const result = await caller.listAudit({ purchaseRequestId: UUIDS.request });

    expect(ctx.prisma.purchaseAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { purchaseRequestId: UUIDS.request },
        orderBy: { createdAt: 'desc' },
      })
    );
    expect(result).toHaveLength(2);
  });

  it('returns audit logs for USER who is assigned', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      createdById: UUIDS.admin,
      assignedToId: UUIDS.worker,
    });
    ctx.prisma.purchaseAudit.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.listAudit({ purchaseRequestId: UUIDS.request });

    expect(ctx.prisma.purchaseAudit.findMany).toHaveBeenCalled();
  });

  it('throws FORBIDDEN for USER who is not creator or assignee', async () => {
    const ctx = makeCtx('USER', UUIDS.other);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      createdById: UUIDS.admin,
      assignedToId: UUIDS.worker,
    });

    const caller = createCaller(ctx);
    await expect(
      caller.listAudit({ purchaseRequestId: UUIDS.request })
    ).rejects.toThrow();
  });
});

describe('purchaseRouter.pendingCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns count of INQUIRED requests', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(5);

    const caller = createCaller(ctx);
    const result = await caller.pendingCount();

    expect(ctx.prisma.purchaseRequest.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'INQUIRED' } })
    );
    expect(result).toBe(5);
  });
});

describe('purchaseRouter.deleteInquiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes inquiry when creator requests', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      createdById: UUIDS.worker,
      purchaseRequest: { status: 'PENDING_INQUIRY' },
    });
    ctx.prisma.purchaseInquiry.delete.mockResolvedValue({ id: UUIDS.inquiry });

    const caller = createCaller(ctx);
    const result = await caller.deleteInquiry({ id: UUIDS.inquiry });

    expect(ctx.prisma.purchaseInquiry.delete).toHaveBeenCalledWith({ where: { id: UUIDS.inquiry } });
    expect(result.success).toBe(true);
  });

  it('throws FORBIDDEN when USER is not creator', async () => {
    const ctx = makeCtx('USER', UUIDS.other);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      createdById: UUIDS.worker,
      purchaseRequest: { status: 'PENDING_INQUIRY' },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.deleteInquiry({ id: UUIDS.inquiry })
    ).rejects.toThrow('دسترسی غیرمجاز');
  });

  it('throws BAD_REQUEST when request is APPROVED', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue({
      id: UUIDS.inquiry,
      createdById: UUIDS.worker,
      purchaseRequest: { status: 'APPROVED' },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.deleteInquiry({ id: UUIDS.inquiry })
    ).rejects.toThrow('امکان حذف استعلام درخواست تایید‌شده وجود ندارد');
  });

  it('throws NOT_FOUND when inquiry does not exist', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseInquiry.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.deleteInquiry({ id: UUIDS.inquiry })
    ).rejects.toThrow('استعلام یافت نشد');
  });
});

describe('purchaseRouter.getUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns active users with USER role', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    const mockUsers = [
      { id: 'u1', fullName: 'کاربر یک' },
      { id: 'u2', fullName: 'کاربر دو' },
    ];
    ctx.prisma.user.findMany.mockResolvedValue(mockUsers);

    const caller = createCaller(ctx);
    const result = await caller.getUsers();

    expect(ctx.prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, role: 'USER' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      })
    );
    expect(result).toHaveLength(2);
  });
});

describe('purchaseRouter.list - date filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies dateFrom filter to createdAt', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, dateFrom: '2025-01-01' });

    const arg = ctx.prisma.purchaseRequest.findMany.mock.calls[0][0];
    expect(arg.where.createdAt).toBeDefined();
    expect(arg.where.createdAt.gte).toEqual(new Date('2025-01-01'));
  });

  it('applies dateTo filter to createdAt', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, dateTo: '2025-12-31' });

    const arg = ctx.prisma.purchaseRequest.findMany.mock.calls[0][0];
    expect(arg.where.createdAt.lte).toEqual(new Date('2025-12-31'));
  });

  it('applies both dateFrom and dateTo', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, dateFrom: '2025-06-01', dateTo: '2025-06-30' });

    const arg = ctx.prisma.purchaseRequest.findMany.mock.calls[0][0];
    expect(arg.where.createdAt.gte).toEqual(new Date('2025-06-01'));
    expect(arg.where.createdAt.lte).toEqual(new Date('2025-06-30'));
  });

  it('applies projectId filter', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.count.mockResolvedValue(0);

    const projectId = '77777777-7777-4777-8777-777777777777';
    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, projectId });

    const arg = ctx.prisma.purchaseRequest.findMany.mock.calls[0][0];
    expect(arg.where.projectId).toBe(projectId);
  });
});

describe('purchaseRouter.create - edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets DRAFT status when no assignedToId', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findFirst.mockResolvedValue(null);
    ctx.prisma.purchaseRequest.create.mockResolvedValue({ id: 'pr-1', title: 'test' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.create({
      title: 'test',
      priority: 'LOW',
      items: [{ productName: 'item', quantity: 1, unit: 'عدد' }],
    });

    const createArg = ctx.prisma.purchaseRequest.create.mock.calls[0][0];
    expect(createArg.data.status).toBe('DRAFT');
    expect(ctx.prisma.notification.create).not.toHaveBeenCalled();
  });

  it('starts sequence at 1 when no previous requests', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findFirst.mockResolvedValue(null);
    ctx.prisma.purchaseRequest.create.mockResolvedValue({ id: 'pr-1' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.create({
      title: 'test',
      items: [{ productName: 'item', quantity: 1, unit: 'عدد' }],
    });

    const createArg = ctx.prisma.purchaseRequest.create.mock.calls[0][0];
    expect(createArg.data.requestNumber).toMatch(/PR-\d{4}-000001$/);
  });

  it('creates audit log with CREATED action', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.purchaseRequest.findFirst.mockResolvedValue(null);
    ctx.prisma.purchaseRequest.create.mockResolvedValue({ id: 'pr-1', title: 'test' });
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.create({
      title: 'test',
      items: [{ productName: 'item', quantity: 1, unit: 'عدد' }],
    });

    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATED' }),
      })
    );
  });
});

describe('purchaseRouter.submit - edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws BAD_REQUEST when no inquiries exist', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: UUIDS.request,
      title: 'x',
      assignedToId: UUIDS.worker,
      createdById: UUIDS.admin,
      _count: { inquiries: 0 },
    });

    const caller = createCaller(ctx);
    await expect(
      caller.submit({ id: UUIDS.request })
    ).rejects.toThrow('حداقل یک استعلام باید ثبت شده باشد');
  });

  it('throws NOT_FOUND when request does not exist', async () => {
    const ctx = makeCtx('USER', UUIDS.worker);
    ctx.prisma.purchaseRequest.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(
      caller.submit({ id: UUIDS.request })
    ).rejects.toThrow('درخواست خرید یافت نشد');
  });

  it('creates audit log with SUBMITTED action', async () => {
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
    ctx.prisma.purchaseAudit.create.mockResolvedValue({ id: 'a1' });

    const caller = createCaller(ctx);
    await caller.submit({ id: UUIDS.request });

    expect(ctx.prisma.purchaseAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SUBMITTED' }),
      })
    );
  });
});
