import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

jest.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

jest.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

const { POST } = require('../app/api/upload/contractor-doc/route');

type MockFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

const makeFile = (overrides: Partial<MockFile> = {}): MockFile => ({
  name: 'receipt.jpg',
  type: 'image/jpeg',
  size: 1024,
  arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer,
  ...overrides,
});

const makeRequest = (file: MockFile | null) => ({
  formData: async () => ({
    get: (key: string) => (key === 'file' ? file : null),
  }),
}) as any;

describe('POST /api/upload/contractor-doc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockExistsSync.mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest(null));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when file is missing', async () => {
    const res = await POST(makeRequest(null));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('الزامی');
  });

  it('returns 400 for unsupported mime type', async () => {
    const res = await POST(makeRequest(makeFile({ type: 'text/plain' as any })));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('فرمت فایل مجاز نیست');
  });

  it('returns 400 on magic-bytes mismatch', async () => {
    const pngFile = makeFile({
      type: 'image/png',
      arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0x00]).buffer,
    });

    const res = await POST(makeRequest(pngFile));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('نوع فایل نامعتبر است');
  });

  it('writes file and returns UUID filePath', async () => {
    const res = await POST(makeRequest(makeFile({ name: 'my*photo.jpg' })));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockWriteFile).toHaveBeenCalled();
    expect(body.filePath).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.fileName).toContain('my_photo');
    expect(body.mimeType).toBe('image/jpeg');
  });

  it('creates upload dir when missing', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await POST(makeRequest(makeFile()));
    expect(res.status).toBe(200);
    expect(mockMkdir).toHaveBeenCalled();
  });
});
