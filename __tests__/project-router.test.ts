import { describe, it, expect, jest } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { projectRouter } from '../server/api/routers/project';

const createCaller = createCallerFactory(projectRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  contractor: '22222222-2222-4222-8222-222222222222',
  project: '33333333-3333-4333-8333-333333333333',
  user: '44444444-4444-4444-8444-444444444444',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: {
      user: { id: userId, role },
    },
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
      projectMember: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    },
  } as any;
}

describe('projectRouter.list', () => {
  it('adds contractor membership filter', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.project.findMany.mockResolvedValue([]);
    ctx.prisma.project.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.list({ page: 1, limit: 20, activeOnly: true });

    const arg = ctx.prisma.project.findMany.mock.calls[0][0];
    expect(arg.where.members).toEqual({ some: { userId: UUIDS.contractor } });
    expect(arg.where.isActive).toBe(true);
  });

  it('adds search OR filters and computes pagination meta', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.project.findMany.mockResolvedValue([{ id: UUIDS.project }]);
    ctx.prisma.project.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.list({ page: 2, limit: 10, search: 'tower', activeOnly: false });

    const arg = ctx.prisma.project.findMany.mock.calls[0][0];
    expect(arg.skip).toBe(10);
    expect(arg.where.OR).toHaveLength(3);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });
});

describe('projectRouter.getById', () => {
  it('throws when contractor is not project member', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.project.findUnique.mockResolvedValue({
      id: UUIDS.project,
      members: [{ userId: UUIDS.user }],
    });

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.project })).rejects.toThrow('شما دسترسی به این پروژه ندارید');
  });
});

describe('projectRouter.create/update', () => {
  it('generates project code from latest sequence', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.admin);
    ctx.prisma.project.findFirst.mockResolvedValue({ code: 'PRJ-2026-0012' });
    ctx.prisma.project.create.mockResolvedValue({ id: UUIDS.project, code: 'PRJ-2026-0013' });

    const caller = createCaller(ctx);
    await caller.create({ name: 'New Site' });

    const arg = ctx.prisma.project.create.mock.calls[0][0];
    expect(arg.data.code).toMatch(/^PRJ-\d{4}-0013$/);
  });

  it('updates nullable date fields correctly', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.admin);
    ctx.prisma.project.update.mockResolvedValue({ id: UUIDS.project });

    const caller = createCaller(ctx);
    await caller.update({ id: UUIDS.project, startDate: null, endDate: null, name: 'Updated' });

    const arg = ctx.prisma.project.update.mock.calls[0][0];
    expect(arg.data.startDate).toBeNull();
    expect(arg.data.endDate).toBeNull();
    expect(arg.data.name).toBe('Updated');
  });
});

describe('projectRouter members and delete', () => {
  it('adds and removes project members', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.projectMember.create.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.projectMember.deleteMany.mockResolvedValue({ count: 1 });

    const caller = createCaller(ctx);
    await caller.addMember({ projectId: UUIDS.project, userId: UUIDS.user });
    await caller.removeMember({ projectId: UUIDS.project, userId: UUIDS.user });

    expect(ctx.prisma.projectMember.create).toHaveBeenCalled();
    expect(ctx.prisma.projectMember.deleteMany).toHaveBeenCalled();
  });

  it('lists active contractors and deletes project', async () => {
    const ctx = makeCtx('MANAGER');
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.contractor }]);
    ctx.prisma.project.delete.mockResolvedValue({ id: UUIDS.project });

    const caller = createCaller(ctx);
    const contractors = await caller.listContractors();
    const deleted = await caller.delete({ id: UUIDS.project });

    expect(contractors).toEqual([{ id: UUIDS.contractor }]);
    expect(deleted.id).toBe(UUIDS.project);
  });
});
