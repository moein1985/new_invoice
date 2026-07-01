import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { generatePurchasePDF } from '@/lib/services/purchase-pdf';

const mockGetServerSession = jest.fn();
const mockFindUnique = jest.fn();
const mockGeneratePDF = generatePurchasePDF as unknown as jest.Mock;

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

jest.mock('./lib/prisma', () => ({
  prisma: {
    purchaseRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}), { virtual: true });

jest.mock('@/lib/prisma', () => ({
  prisma: {
    purchaseRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}), { virtual: true });

jest.mock('../lib/prisma', () => ({
  prisma: {
    purchaseRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}), { virtual: true });

jest.mock('../lib/prisma.ts', () => ({
  prisma: {
    purchaseRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}), { virtual: true });

const { GET } = require('../app/api/purchases/[id]/pdf/route');

const UUID = '55555555-5555-4555-8555-555555555555';

function mockRequest(id: string): any {
  return {
    url: `http://localhost:3000/api/purchases/${id}/pdf`,
    method: 'GET',
  };
}

function mockParams(id: string): any {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/purchases/[id]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when purchase request not found', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u1', role: 'ADMIN' },
    });
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(404);
  });

  it('returns 403 when USER accesses unassigned request', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u-other', role: 'USER' },
    });
    mockFindUnique.mockResolvedValue({
      id: UUID,
      assignedToId: 'u-worker',
      requestNumber: 'PR-1405-000001',
    });

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(403);
  });

  it('returns PDF buffer for ADMIN', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u-admin', role: 'ADMIN' },
    });
    mockFindUnique.mockResolvedValue({
      id: UUID,
      assignedToId: 'u-worker',
      requestNumber: 'PR-1405-000001',
      title: 'خرید کابل',
      project: { name: 'پروژه یک' },
      createdBy: { id: 'u-admin', fullName: 'Admin' },
      assignedTo: { id: 'u-worker', fullName: 'Worker' },
      items: [],
      approvedInquiry: null,
    });
    mockGeneratePDF.mockResolvedValue(Buffer.from('fake-pdf-content'));

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('PR-1405-000001.pdf');
  });

  it('returns PDF for USER who is assigned', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u-worker', role: 'USER' },
    });
    mockFindUnique.mockResolvedValue({
      id: UUID,
      assignedToId: 'u-worker',
      requestNumber: 'PR-1405-000002',
      title: 'test',
      project: null,
      createdBy: { id: 'u-admin', fullName: 'Admin' },
      assignedTo: { id: 'u-worker', fullName: 'Worker' },
      items: [],
      approvedInquiry: null,
    });
    mockGeneratePDF.mockResolvedValue(Buffer.from('pdf'));

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(200);
  });

  it('returns 500 when PDF generation fails', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u-admin', role: 'ADMIN' },
    });
    mockFindUnique.mockResolvedValue({
      id: UUID,
      assignedToId: null,
      requestNumber: 'PR-1405-000003',
      title: 'test',
      project: null,
      createdBy: { fullName: 'Admin' },
      assignedTo: null,
      items: [],
      approvedInquiry: null,
    });
    mockGeneratePDF.mockRejectedValue(new Error('chromium failed'));

    const res = await GET(mockRequest(UUID), mockParams(UUID));
    expect(res.status).toBe(500);
  });
});
