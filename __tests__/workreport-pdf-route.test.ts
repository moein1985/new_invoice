import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetServerSession = jest.fn();
const mockGenerateWorkReportPDF = jest.fn();
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
    workReport: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    workReport: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('./lib/services/work-report-pdf', () => ({
  generateWorkReportPDF: (...args: unknown[]) => mockGenerateWorkReportPDF(...args),
}));

jest.mock('@/lib/services/work-report-pdf', () => ({
  generateWorkReportPDF: (...args: unknown[]) => mockGenerateWorkReportPDF(...args),
}));

const { GET } = require('../app/api/work-reports/[reportId]/pdf/route');

describe('GET /api/work-reports/[reportId]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  });

  it('returns 401 for unauthenticated users', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET({} as any, { params: Promise.resolve({ reportId: 'wr-1' }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when report is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET({} as any, { params: Promise.resolve({ reportId: 'wr-404' }) });
    const body = await res.json();

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wr-404' },
      })
    );
    expect(res.status).toBe(404);
    expect(body.error).toBe('Work report not found');
  });

  it('returns 403 when contractor requests another user report', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'contractor-1', role: 'CONTRACTOR' } });
    mockFindUnique.mockResolvedValue({
      id: 'wr-1',
      reportNumber: 'WR-2026-001',
      createdById: 'someone-else',
      project: { id: 'p1', name: 'Project A' },
      createdBy: { id: 'u1', fullName: 'User One' },
      items: [],
    });

    const res = await GET({} as any, { params: Promise.resolve({ reportId: 'wr-1' }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns a PDF response for authorized access', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'contractor-1', role: 'CONTRACTOR' } });
    mockFindUnique.mockResolvedValue({
      id: 'wr-1',
      reportNumber: 'WR-2026-001',
      createdById: 'contractor-1',
      project: { id: 'p1', name: 'Project A' },
      createdBy: { id: 'u1', fullName: 'User One' },
      items: [],
    });
    mockGenerateWorkReportPDF.mockResolvedValue(Buffer.from('WORK-PDF'));

    const res = await GET({} as any, { params: Promise.resolve({ reportId: 'wr-1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('WR-2026-001.pdf');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes).toString()).toBe('WORK-PDF');
  });

  it('returns 500 when PDF generation fails', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'wr-1',
      reportNumber: 'WR-2026-001',
      createdById: 'admin-1',
      project: { id: 'p1', name: 'Project A' },
      createdBy: { id: 'u1', fullName: 'User One' },
      items: [],
    });
    mockGenerateWorkReportPDF.mockRejectedValueOnce(new Error('render failed'));

    const res = await GET({} as any, { params: Promise.resolve({ reportId: 'wr-1' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('PDF generation failed');
  });
});
