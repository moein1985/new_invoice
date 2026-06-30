import { describe, expect, it, jest } from '@jest/globals';
import { createCallerFactory } from '../server/api/trpc';
import { contractorDocRouter } from '../server/api/routers/contractorDoc';

const createCaller = createCallerFactory(contractorDocRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  contractor: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
  doc: '55555555-5555-4555-8555-555555555555',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
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
      contractorDocItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      contractorDocAttachment: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      projectMember: {
        findUnique: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      notification: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb((makeTx() as any))),
    },
  } as any;
}

function makeTx() {
  return {
    contractorDocItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    contractorDocAttachment: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    contractorDoc: {
      update: jest.fn().mockResolvedValue({ id: UUIDS.doc }),
    },
  };
}

describe('contractorDocRouter.list', () => {
  it('filters contractor list by createdById', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.contractorDoc.findMany.mockResolvedValue([]);
    ctx.prisma.contractorDoc.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({
      projectId: UUIDS.project,
      page: 1,
      limit: 20,
    });

    const arg = ctx.prisma.contractorDoc.findMany.mock.calls[0][0];
    expect(arg.where.createdById).toBe(UUIDS.contractor);
  });
});

describe('contractorDocRouter.create', () => {
  it('forbids contractor not in project membership', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);

    await expect(
      caller.create({
        projectId: UUIDS.project,
        type: 'RECEIPT',
        direction: 'RECEIVED',
        description: 'desc',
        items: [{ description: 'item', unit: 'عدد', quantity: 1 }],
        attachments: [],
      })
    ).rejects.toThrow('شما عضو این پروژه نیستید');
  });

  it('generates CD number and creates notifications', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.contractorDoc.findFirst.mockResolvedValue({ docNumber: 'CD-2026-0010' });
    ctx.prisma.contractorDoc.create.mockResolvedValue({ id: UUIDS.doc });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.admin }]);

    const caller = createCaller(ctx);

    await caller.create({
      projectId: UUIDS.project,
      type: 'GENERAL',
      description: 'desc',
      items: [{ description: 'item', unit: 'عدد', quantity: 1 }],
      attachments: [],
    });

    const arg = ctx.prisma.contractorDoc.create.mock.calls[0][0];
    expect(arg.data.docNumber).toMatch(/^CD-\d{4}-0011$/);
    expect(ctx.prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('contractorDocRouter.approve/reject', () => {
  it('approves and rejects by manager', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.contractorDoc.findUnique.mockResolvedValue({
      id: UUIDS.doc,
      docNumber: 'CD-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.contractorDoc.update.mockResolvedValue({ id: UUIDS.doc, approvalStatus: 'APPROVED' });

    const caller = createCaller(ctx);

    const approved = await caller.approve({ id: UUIDS.doc });
    await caller.reject({ id: UUIDS.doc, reason: 'bad' });

    expect(approved.approvalStatus).toBe('APPROVED');
    expect(ctx.prisma.notification.create).toHaveBeenCalled();
  });
});
