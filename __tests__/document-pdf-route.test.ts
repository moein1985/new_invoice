import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetServerSession = jest.fn();
const mockGeneratePDFBuffer = jest.fn();

const mockFindUnique = jest.fn();

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

jest.mock('./lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('./lib/services/pdf-puppeteer', () => ({
  generatePDFBuffer: (...args: unknown[]) => mockGeneratePDFBuffer(...args),
}));

jest.mock('@/lib/services/pdf-puppeteer', () => ({
  generatePDFBuffer: (...args: unknown[]) => mockGeneratePDFBuffer(...args),
}));

const { GET } = require('../app/api/documents/[id]/pdf/route');

describe('GET /api/documents/[id]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } });
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET({} as any, { params: Promise.resolve({ id: 'doc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when document is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET({} as any, { params: Promise.resolve({ id: 'doc-404' }) });
    const body = await res.json();

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-404' },
      })
    );
    expect(res.status).toBe(404);
    expect(body.error).toBe('Document not found');
  });

  it('returns a PDF response when document exists', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'doc-1',
      documentNumber: 'INV-2026-0001',
      customer: { id: 'c1', name: 'Customer' },
      createdBy: { id: 'u1', fullName: 'Admin User' },
      items: [],
    });
    mockGeneratePDFBuffer.mockResolvedValue(Buffer.from('PDF-DATA'));

    const res = await GET({} as any, { params: Promise.resolve({ id: 'doc-1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('INV-2026-0001.pdf');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes).toString()).toBe('PDF-DATA');
  });

  it('returns 500 when PDF generation fails', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'doc-1',
      documentNumber: 'INV-2026-0001',
      customer: { id: 'c1', name: 'Customer' },
      createdBy: { id: 'u1', fullName: 'Admin User' },
      items: [],
    });
    mockGeneratePDFBuffer.mockRejectedValueOnce(new Error('render failed'));

    const res = await GET({} as any, { params: Promise.resolve({ id: 'doc-1' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('PDF generation failed');
  });
});
