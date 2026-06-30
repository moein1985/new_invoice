import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetServerSession = jest.fn();
const mockReadFile = jest.fn();
const mockExistsSync = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('./app/api/auth/[...nextauth]/auth-options', () => ({
  authOptions: {},
}));

jest.mock('@/app/api/auth/[...nextauth]/auth-options', () => ({
  authOptions: {},
}));

jest.mock('./app/api/auth/[...nextauth]/auth-options.ts', () => ({
  authOptions: {},
}), { virtual: true });

jest.mock('@/app/api/auth/[...nextauth]/auth-options.ts', () => ({
  authOptions: {},
}), { virtual: true });

jest.mock('./lib/prisma', () => ({
  prisma: {},
}), { virtual: true });

jest.mock('./lib/prisma.ts', () => ({
  prisma: {},
}), { virtual: true });

jest.mock('@/lib/prisma', () => ({
  prisma: {},
}), { virtual: true });

jest.mock('@/lib/prisma.ts', () => ({
  prisma: {},
}), { virtual: true });

jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

const { GET } = require('../app/api/uploads/purchases/[...path]/route');

describe('GET /api/uploads/purchases/[...path]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } });
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(Buffer.from('FILE-DATA'));
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET({} as any, { params: Promise.resolve({ path: ['image', 'a.jpg'] }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects path traversal segments', async () => {
    const res = await GET({} as any, { params: Promise.resolve({ path: ['..', 'secret.txt'] }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid path');
  });

  it('returns 404 when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET({} as any, { params: Promise.resolve({ path: ['voice', 'a.webm'] }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('File not found');
  });

  it('returns file buffer with mapped mime type', async () => {
    const res = await GET({} as any, { params: Promise.resolve({ path: ['docs', 'a.pdf'] }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes).toString()).toBe('FILE-DATA');
    expect(mockReadFile).toHaveBeenCalled();
  });

  it('uses application/octet-stream for unknown extensions', async () => {
    const res = await GET({} as any, { params: Promise.resolve({ path: ['misc', 'a.bin'] }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });
});
