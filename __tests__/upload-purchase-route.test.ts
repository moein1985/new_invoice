import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetServerSession = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const mockExistsSync = jest.fn();

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

jest.mock('./app/api/auth/[...nextauth]/auth-options', () => ({
  authOptions: {},
}), { virtual: true });

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
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'fixed-uuid'),
}));

const { POST } = require('../app/api/upload/purchase/route');

type MockFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const makeFile = (overrides: Partial<MockFile> = {}): MockFile => ({
  name: 'invoice.pdf',
  type: 'application/pdf',
  size: 1024,
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  ...overrides,
});

const makeRequest = (file: MockFile | null, type: string | null) => {
  return {
    formData: async () => ({
      get: (key: string) => {
        if (key === 'file') return file;
        if (key === 'type') return type;
        return null;
      },
    }),
  } as any;
};

describe('POST /api/upload/purchase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockExistsSync.mockReturnValue(true);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest(null, null));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when file or type is missing', async () => {
    const res = await POST(makeRequest(null, 'image'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('الزامی');
  });

  it('returns 400 for invalid type', async () => {
    const res = await POST(makeRequest(makeFile({ type: 'image/png' }), 'invalid'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('نامعتبر');
  });

  it('returns 400 for disallowed mime type', async () => {
    const res = await POST(makeRequest(makeFile({ type: 'text/plain' }), 'image'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('فرمت فایل مجاز نیست');
  });

  it('returns 400 when file exceeds max size', async () => {
    const res = await POST(makeRequest(makeFile({ type: 'audio/webm', size: 11 * 1024 * 1024 }), 'voice'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('حجم فایل');
  });

  it('creates directory when missing and writes file', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await POST(makeRequest(makeFile({ name: 'voice.webm', type: 'audio/webm' }), 'voice'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(body.filePath).toBe('/uploads/purchases/voice/fixed-uuid.webm');
  });

  it('sanitizes extension and returns metadata', async () => {
    const res = await POST(
      makeRequest(makeFile({ name: 'x.bad*ext', type: 'image/jpeg', size: 2048 }), 'image')
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fileName).toBe('x.bad*ext');
    expect(body.fileType).toBe('image/jpeg');
    expect(body.fileSize).toBe(2048);
    expect(body.filePath).toBe('/uploads/purchases/image/fixed-uuid.badext');
  });

  it('returns 500 on write failure', async () => {
    mockWriteFile.mockRejectedValueOnce(new Error('disk error'));

    const res = await POST(makeRequest(makeFile({ type: 'image/png' }), 'image'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('خطا در آپلود فایل');
  });
});
