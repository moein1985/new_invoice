import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetServerSession = jest.fn();
const mockReadFile = jest.fn();
const mockExistsSync = jest.fn();
const mockReaddir = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('next-auth/next', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock('@/app/api/auth/[...nextauth]/auth-options', () => ({
  authOptions: {},
}), { virtual: true });

jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

const { GET } = require('../app/api/upload/contractor-doc/[id]/route');

describe('GET /api/upload/contractor-doc/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } });
    mockExistsSync.mockReturnValue(true);
    mockReaddir.mockResolvedValue(['11111111-1111-4111-8111-111111111111.jpg']);
    mockReadFile.mockResolvedValue(Buffer.from('DOC-FILE'));
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET({} as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 for non-UUID id', async () => {
    const res = await GET({} as any, { params: Promise.resolve({ id: 'invalid-id' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid file id');
  });

  it('returns 404 when no matching file found', async () => {
    mockReaddir.mockResolvedValue([]);

    const res = await GET({} as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('File not found');
  });

  it('returns file with mapped content type', async () => {
    const res = await GET({} as any, {
      params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes).toString()).toBe('DOC-FILE');
  });
});
