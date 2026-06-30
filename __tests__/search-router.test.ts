import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { searchRouter } from '../server/api/routers/search';
import { prisma } from '../lib/prisma';

const createCaller = createCallerFactory(searchRouter);

function makeCtx() {
  return {
    session: {
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'ADMIN',
      },
    },
  } as any;
}

describe('searchRouter.globalSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.customer.findMany as any) = jest.fn();
    (prisma.document.findMany as any) = jest.fn();
    (prisma.documentItem.findMany as any) = jest.fn();
    (prisma.user.findMany as any) = jest.fn();
  });

  it('aggregates mapped search results and computes totalResults', async () => {
    (prisma.customer.findMany as any).mockResolvedValue([
      { id: 'c1', name: 'Customer 1', code: 'C-001', phone: '0912', email: null, address: null },
    ]);
    (prisma.document.findMany as any).mockResolvedValue([
      {
        id: 'd1',
        documentNumber: 'INV-1',
        documentType: 'INVOICE',
        projectName: 'P1',
        totalAmount: 1000,
        approvalStatus: 'APPROVED',
        createdAt: new Date(),
        customer: { name: 'Customer 1' },
      },
    ]);
    (prisma.documentItem.findMany as any).mockResolvedValue([
      {
        id: 'i1',
        productName: 'Cable',
        description: 'desc',
        supplier: 'S1',
        documentId: 'd1',
        document: { documentNumber: 'INV-1', customer: { name: 'Customer 1' } },
      },
    ]);
    (prisma.user.findMany as any).mockResolvedValue([
      { id: 'u1', username: 'admin', fullName: 'Admin User', role: 'ADMIN' },
    ]);

    const caller = createCaller(makeCtx());
    const result = await caller.globalSearch({ query: 'cab', limit: 5 });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
    expect(result.customers[0].type).toBe('customer');
    expect(result.documents[0].type).toBe('document');
    expect(result.documentItems[0].type).toBe('item');
    expect(result.users[0].type).toBe('user');
    expect(result.totalResults).toBe(4);
  });

  it('uses lowercase query and returns zero total for empty datasets', async () => {
    (prisma.customer.findMany as any).mockResolvedValue([]);
    (prisma.document.findMany as any).mockResolvedValue([]);
    (prisma.documentItem.findMany as any).mockResolvedValue([]);
    (prisma.user.findMany as any).mockResolvedValue([]);

    const caller = createCaller(makeCtx());
    const result = await caller.globalSearch({ query: 'TeSt', limit: 3 });

    const customerCall = (prisma.customer.findMany as any).mock.calls[0][0];
    expect(customerCall.where.OR[0].name.contains).toBe('test');
    expect(result.totalResults).toBe(0);
  });
});
