import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import { createCallerFactory } from '../server/api/trpc';
import { userRouter } from '../server/api/routers/user';

const createCaller = createCallerFactory(userRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: {
      user: {
        id: userId,
        role,
      },
    },
    prisma: {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    },
  } as any;
}

describe('userRouter.list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forbids non-admin role', async () => {
    const ctx = makeCtx('USER', UUIDS.user);
    const caller = createCaller(ctx);

    await expect(caller.list({ page: 1, limit: 10 })).rejects.toThrow('فقط مدیران سیستم به این بخش دسترسی دارند');
  });

  it('returns paginated users with search filters for admin', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.user, username: 'u1' }]);
    ctx.prisma.user.count.mockResolvedValue(1);

    const caller = createCaller(ctx);
    const result = await caller.list({ page: 2, limit: 5, search: 'ali' });

    const arg = ctx.prisma.user.findMany.mock.calls[0][0];
    expect(arg.skip).toBe(5);
    expect(arg.where.OR).toHaveLength(2);
    expect(result.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
  });
});

describe('userRouter.me and getById', () => {
  it('returns current user profile for protected me', async () => {
    const ctx = makeCtx('USER', UUIDS.user);
    ctx.prisma.user.findUnique.mockResolvedValue({ id: UUIDS.user, username: 'me' });

    const caller = createCaller(ctx);
    const result = await caller.me();

    expect(ctx.prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: UUIDS.user } })
    );
    expect(result.id).toBe(UUIDS.user);
  });

  it('throws when admin getById target is missing', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.user.findUnique.mockResolvedValue(null);

    const caller = createCaller(ctx);
    await expect(caller.getById({ id: UUIDS.user })).rejects.toThrow('کاربر یافت نشد');
  });
});

describe('userRouter.create/update/delete', () => {
  it('blocks create when username already exists', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.user.findUnique.mockResolvedValue({ id: UUIDS.user });

    const caller = createCaller(ctx);
    await expect(
      caller.create({
        username: 'taken',
        password: '123456',
        fullName: 'User One',
        email: 'u1@test.com',
        phone: '09123456789',
        role: 'USER',
      })
    ).rejects.toThrow('نام کاربری قبلاً استفاده شده است');
  });

  it('hashes password before create', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    ctx.prisma.user.create.mockResolvedValue({ id: UUIDS.user, username: 'new' });

    const caller = createCaller(ctx);
    await caller.create({
      username: 'new',
      password: 'abcdef',
      fullName: 'New User',
      email: 'new@test.com',
      phone: '09123456789',
      role: 'USER',
    });

    const arg = ctx.prisma.user.create.mock.calls[0][0];
    expect(arg.data.password).not.toBe('abcdef');
    expect(typeof arg.data.password).toBe('string');
    expect(arg.data.password.length).toBeGreaterThan(20);
  });

  it('hashes password on update when provided', async () => {
    const ctx = makeCtx('ADMIN');
    ctx.prisma.user.update.mockResolvedValue({ id: UUIDS.user, username: 'u1' });

    const caller = createCaller(ctx);
    await caller.update({ id: UUIDS.user, password: 'newpass1' });

    const arg = ctx.prisma.user.update.mock.calls[0][0];
    expect(arg.data.password).not.toBe('newpass1');
    expect(typeof arg.data.password).toBe('string');
    expect(arg.data.password.length).toBeGreaterThan(20);
  });

  it('prevents deleting yourself', async () => {
    const ctx = makeCtx('ADMIN', UUIDS.admin);
    const caller = createCaller(ctx);

    await expect(caller.delete({ id: UUIDS.admin })).rejects.toThrow('نمی\u200cتوانید خودتان را حذف کنید');
  });
});

describe('userRouter SIP settings', () => {
  it('returns SIP settings for current user', async () => {
    const ctx = makeCtx('USER', UUIDS.user);
    ctx.prisma.user.findUnique.mockResolvedValue({ sipServer: '10.0.0.1', sipEnabled: true });

    const caller = createCaller(ctx);
    const result = await caller.getSipSettings();

    expect(ctx.prisma.user.findUnique).toHaveBeenCalled();
    expect(result.sipEnabled).toBe(true);
  });

  it('updates SIP settings for current user', async () => {
    const ctx = makeCtx('USER', UUIDS.user);
    ctx.prisma.user.update.mockResolvedValue({ sipServer: 'pbx.local', sipPort: 8089 });

    const caller = createCaller(ctx);
    const result = await caller.updateSipSettings({ sipServer: 'pbx.local', sipPort: 8089, sipEnabled: true });

    expect(ctx.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: UUIDS.user } })
    );
    expect(result.sipServer).toBe('pbx.local');
  });
});
