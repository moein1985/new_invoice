import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createCallerFactory } from '../server/api/trpc';
import { projectRouter } from '../server/api/routers/project';

const createProjectCaller = createCallerFactory(projectRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  contractor: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
};

function makeProjectCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: { user: { id: userId, role } },
    prisma: {
      project: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      projectMember: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
      user: { findMany: jest.fn() },
      workReport: { groupBy: jest.fn() },
      contractorDoc: { groupBy: jest.fn() },
      purchaseRequest: { groupBy: jest.fn(), findMany: jest.fn() },
    },
  } as any;
}

describe('Phase 3 — 3.1: upload route paths use process.cwd()', () => {
  it('contractor-doc upload route uses process.cwd()', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'api', 'upload', 'contractor-doc', 'route.ts'), 'utf-8');
    expect(content).toContain('process.cwd()');
    expect(content).not.toContain("'/app/uploads");
  });

  it('purchase upload route uses process.cwd()', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'api', 'upload', 'purchase', 'route.ts'), 'utf-8');
    expect(content).toContain('process.cwd()');
    expect(content).not.toContain("'/app/uploads");
  });

  it('purchases serve route uses process.cwd()', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'api', 'uploads', 'purchases', '[...path]', 'route.ts'), 'utf-8');
    expect(content).toContain('process.cwd()');
    expect(content).not.toContain("'/app/uploads");
  });

  it('contractor-doc serve route uses process.cwd()', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'api', 'upload', 'contractor-doc', '[id]', 'route.ts'), 'utf-8');
    expect(content).toContain('process.cwd()');
    expect(content).not.toContain("'/app/uploads");
  });

  it('contractorDoc router resolveAttachmentAbsolutePath uses process.cwd()', () => {
    const content = readFileSync(join(process.cwd(), 'server', 'api', 'routers', 'contractorDoc.ts'), 'utf-8');
    expect(content).toContain("path.join(process.cwd(), 'uploads', 'contractor-docs')");
    expect(content).not.toContain("'/app/uploads/contractor-docs'");
  });
});

describe('Phase 3 — 3.2: project.getSummary', () => {
  it('throws NOT_FOUND when project does not exist', async () => {
    const ctx = makeProjectCtx('MANAGER');
    ctx.prisma.project.findUnique.mockResolvedValue(null);

    const caller = createProjectCaller(ctx);
    await expect(caller.getSummary({ id: UUIDS.project })).rejects.toThrow('پروژه یافت نشد');
  });

  it('throws FORBIDDEN when contractor is not a member', async () => {
    const ctx = makeProjectCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.project.findUnique.mockResolvedValue({ id: UUIDS.project });
    ctx.prisma.projectMember.findUnique.mockResolvedValue(null);

    const caller = createProjectCaller(ctx);
    await expect(caller.getSummary({ id: UUIDS.project })).rejects.toThrow('دسترسی ندارید');
  });

  it('allows contractor who is a member', async () => {
    const ctx = makeProjectCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.project.findUnique.mockResolvedValue({ id: UUIDS.project });
    ctx.prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.workReport.groupBy.mockResolvedValue([
      { approvalStatus: 'APPROVED', _sum: { totalAmount: 5000 }, _count: { _all: 3 } },
    ]);
    ctx.prisma.contractorDoc.groupBy.mockResolvedValue([
      { approvalStatus: 'PENDING', _sum: { totalAmount: 2000 }, _count: { _all: 1 } },
    ]);
    ctx.prisma.purchaseRequest.groupBy.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);

    const caller = createProjectCaller(ctx);
    const result = await caller.getSummary({ id: UUIDS.project });

    expect(result.workReports).toHaveLength(1);
    expect(result.contractorDocs).toHaveLength(1);
    expect(result.workReports[0].approvalStatus).toBe('APPROVED');
  });

  it('groups by approvalStatus with sum and count', async () => {
    const ctx = makeProjectCtx('ADMIN');
    ctx.prisma.project.findUnique.mockResolvedValue({ id: UUIDS.project });
    ctx.prisma.workReport.groupBy.mockResolvedValue([
      { approvalStatus: 'APPROVED', _sum: { totalAmount: 10000 }, _count: { _all: 5 } },
      { approvalStatus: 'PENDING', _sum: { totalAmount: 3000 }, _count: { _all: 2 } },
    ]);
    ctx.prisma.contractorDoc.groupBy.mockResolvedValue([
      { approvalStatus: 'APPROVED', _sum: { totalAmount: 8000 }, _count: { _all: 3 } },
    ]);
    ctx.prisma.purchaseRequest.groupBy.mockResolvedValue([]);
    ctx.prisma.purchaseRequest.findMany.mockResolvedValue([]);

    const caller = createProjectCaller(ctx);
    const result = await caller.getSummary({ id: UUIDS.project });

    expect(result.workReports).toHaveLength(2);
    expect(result.workReports[0]._count._all).toBe(5);
    expect(result.contractorDocs).toHaveLength(1);

    const wrArg = ctx.prisma.workReport.groupBy.mock.calls[0][0];
    expect(wrArg.by).toEqual(['approvalStatus']);
    expect(wrArg.where.projectId).toBe(UUIDS.project);
    expect(wrArg._sum).toEqual({ totalAmount: true });
  });
});

describe('Phase 3 — 3.3/3.4: rejection reason fields exist in schema', () => {
  it('WorkReport model has rejectionReason field', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
    const workReportMatch = schema.match(/model WorkReport \{[\s\S]*?\}/);
    expect(workReportMatch).toBeTruthy();
    expect(workReportMatch![0]).toContain('rejectionReason');
  });

  it('ContractorDoc model has rejectionReason field', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
    const docMatch = schema.match(/model ContractorDoc \{[\s\S]*?\}/);
    expect(docMatch).toBeTruthy();
    expect(docMatch![0]).toContain('rejectionReason');
  });
});
