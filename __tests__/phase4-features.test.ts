import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { createCallerFactory } from '../server/api/trpc';
import { workReportRouter } from '../server/api/routers/workReport';

const createCaller = createCallerFactory(workReportRouter);

const UUIDS = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  contractor: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
  report: '55555555-5555-4555-8555-555555555555',
};

function makeCtx(role: 'ADMIN' | 'MANAGER' | 'USER' | 'CONTRACTOR' = 'ADMIN', userId = UUIDS.admin) {
  return {
    session: { user: { id: userId, role } },
    prisma: {
      workReport: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      projectMember: { findUnique: jest.fn() },
      workDescription: { upsert: jest.fn(), findMany: jest.fn() },
      workReportItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      user: { findMany: jest.fn() },
      notification: { create: jest.fn(), createMany: jest.fn() },
      workReportAudit: { create: jest.fn(), findMany: jest.fn() },
    },
  } as any;
}

describe('Phase 4 — 4.1: quick report create (single item)', () => {
  it('creates a report with a single item via create mutation', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.workReport.findFirst.mockResolvedValue({ reportNumber: 'WR-2026-0010' });
    ctx.prisma.workReport.create.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0011',
      project: { name: 'Test' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([{ id: UUIDS.manager }]);

    const caller = createCaller(ctx);
    const result = await caller.create({
      projectId: UUIDS.project,
      reportDate: '2026-06-30',
      items: [{ description: 'حفر خندق', unit: 'متر', quantity: 50 }],
    });

    const createArg = ctx.prisma.workReport.create.mock.calls[0][0];
    expect(createArg.data.items.create).toHaveLength(1);
    expect(createArg.data.items.create[0].description).toBe('حفر خندق');
    expect(createArg.data.items.create[0].quantity).toBe(50);
    expect(createArg.data.reportDate).toEqual(new Date('2026-06-30'));
    expect(result.id).toBe(UUIDS.report);
  });

  it('creates audit log with CREATED action', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.projectMember.findUnique.mockResolvedValue({ id: 'pm1' });
    ctx.prisma.workReport.findFirst.mockResolvedValue({ reportNumber: 'WR-2026-0010' });
    ctx.prisma.workReport.create.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0011',
      project: { name: 'Test' },
    });
    ctx.prisma.user.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    await caller.create({
      projectId: UUIDS.project,
      items: [{ description: 'test', unit: 'متر', quantity: 1 }],
    });

    expect(ctx.prisma.workReportAudit.create).toHaveBeenCalledTimes(1);
    const auditArg = ctx.prisma.workReportAudit.create.mock.calls[0][0];
    expect(auditArg.data.action).toBe('CREATED');
    expect(auditArg.data.workReportId).toBe(UUIDS.report);
    expect(auditArg.data.userId).toBe(UUIDS.contractor);
  });
});

describe('Phase 4 — 4.2: listMine advanced filters', () => {
  it('applies dateFrom filter to reportDate', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.listMine({ page: 1, limit: 20, dateFrom: '2026-06-01' });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.reportDate).toBeDefined();
    expect(arg.where.reportDate.gte).toEqual(new Date('2026-06-01'));
  });

  it('applies dateTo filter to reportDate', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.listMine({ page: 1, limit: 20, dateTo: '2026-06-30' });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.reportDate.lte).toEqual(new Date('2026-06-30'));
  });

  it('applies both dateFrom and dateTo', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.listMine({ page: 1, limit: 20, dateFrom: '2026-06-01', dateTo: '2026-06-30' });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.reportDate.gte).toEqual(new Date('2026-06-01'));
    expect(arg.where.reportDate.lte).toEqual(new Date('2026-06-30'));
  });

  it('applies search filter to item descriptions', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.listMine({ page: 1, limit: 20, search: 'حفر' });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.items).toBeDefined();
    expect(arg.where.items.some.description.contains).toBe('حفر');
    expect(arg.where.items.some.description.mode).toBe('insensitive');
  });

  it('combines all filters together', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findMany.mockResolvedValue([]);
    ctx.prisma.workReport.count.mockResolvedValue(0);

    const caller = createCaller(ctx);
    await caller.listMine({
      page: 1,
      limit: 20,
      status: 'PENDING',
      projectId: UUIDS.project,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      search: 'test',
    });

    const arg = ctx.prisma.workReport.findMany.mock.calls[0][0];
    expect(arg.where.approvalStatus).toBe('PENDING');
    expect(arg.where.projectId).toBe(UUIDS.project);
    expect(arg.where.reportDate.gte).toBeDefined();
    expect(arg.where.reportDate.lte).toBeDefined();
    expect(arg.where.items).toBeDefined();
  });
});

describe('Phase 4 — 4.3: contractor doc PDF service and route exist', () => {
  it('contractor-doc-pdf.ts service file exists', () => {
    const content = readFileSync(join(process.cwd(), 'lib', 'services', 'contractor-doc-pdf.ts'), 'utf-8');
    expect(content).toContain('generateContractorDocPDF');
    expect(content).toContain('buildContractorDocHTML');
  });

  it('PDF API route exists at /api/contractor-docs/[docId]/pdf', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'api', 'contractor-docs', '[docId]', 'pdf', 'route.ts'), 'utf-8');
    expect(content).toContain('generateContractorDocPDF');
    expect(content).toContain('getServerSession');
    expect(content).toContain('application/pdf');
  });

  it('PDF button exists in contractor doc detail page', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'projects', '[id]', 'contractor-docs', '[docId]', 'page.tsx'), 'utf-8');
    expect(content).toContain('/api/contractor-docs/');
    expect(content).toContain('PDF');
  });
});

describe('Phase 4 — 4.4: audit log', () => {
  it('WorkReportAudit model exists in schema', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
    expect(schema).toContain('model WorkReportAudit');
    expect(schema).toContain('work_report_audits');
  });

  it('migration file exists for work_report_audits', () => {
    const migrationDir = join(process.cwd(), 'prisma', 'migrations');
    const dirs = readdirSync(migrationDir) as string[];
    const auditMigration = dirs.find(d => d.includes('work_report_audit'));
    expect(auditMigration).toBeTruthy();
    const sql = readFileSync(join(migrationDir, auditMigration!, 'migration.sql'), 'utf-8');
    expect(sql).toContain('work_report_audits');
    expect(sql).toContain('CREATE TABLE');
  });

  it('approve mutation creates APPROVED audit entry', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({ id: UUIDS.report, approvalStatus: 'APPROVED' });

    const caller = createCaller(ctx);
    await caller.approve({ id: UUIDS.report });

    expect(ctx.prisma.workReportAudit.create).toHaveBeenCalledTimes(1);
    const auditArg = ctx.prisma.workReportAudit.create.mock.calls[0][0];
    expect(auditArg.data.action).toBe('APPROVED');
    expect(auditArg.data.workReportId).toBe(UUIDS.report);
  });

  it('reject mutation creates REJECTED audit entry with changes', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      reportNumber: 'WR-2026-0001',
      projectId: UUIDS.project,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReport.update.mockResolvedValue({ id: UUIDS.report, approvalStatus: 'REJECTED' });

    const caller = createCaller(ctx);
    await caller.reject({ id: UUIDS.report, comment: 'ناقص' });

    const auditArg = ctx.prisma.workReportAudit.create.mock.calls[0][0];
    expect(auditArg.data.action).toBe('REJECTED');
    expect(auditArg.data.changes).toBe('ناقص');
  });

  it('update mutation creates UPDATED or PRICED audit entry', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.manager,
      approvalStatus: 'PENDING',
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'PENDING',
      items: [],
      project: { name: 'P', code: 'C' },
    });

    const caller = createCaller(ctx);
    await caller.update({
      id: UUIDS.report,
      items: [{ description: 'a', unit: 'متر', quantity: 5, unitPrice: 100 }],
      notes: 'test',
    });

    expect(ctx.prisma.workReportAudit.create).toHaveBeenCalledTimes(1);
    const auditArg = ctx.prisma.workReportAudit.create.mock.calls[0][0];
    expect(auditArg.data.action).toBe('PRICED');
  });

  it('contractor update creates UPDATED audit (not PRICED)', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.contractor,
      approvalStatus: 'PENDING',
    });
    ctx.prisma.workReport.update.mockResolvedValue({
      id: UUIDS.report,
      approvalStatus: 'PENDING',
      items: [],
      project: { name: 'P', code: 'C' },
    });

    const caller = createCaller(ctx);
    await caller.update({
      id: UUIDS.report,
      items: [{ description: 'a', unit: 'متر', quantity: 5 }],
      notes: 'test',
    });

    const auditArg = ctx.prisma.workReportAudit.create.mock.calls[0][0];
    expect(auditArg.data.action).toBe('UPDATED');
  });

  it('listAudit returns audit entries with user info', async () => {
    const ctx = makeCtx('MANAGER', UUIDS.manager);
    ctx.prisma.workReportAudit.findMany.mockResolvedValue([
      {
        id: 'a1',
        workReportId: UUIDS.report,
        userId: UUIDS.manager,
        action: 'APPROVED',
        changes: null,
        createdAt: new Date(),
        user: { fullName: 'Manager One' },
      },
    ]);

    const caller = createCaller(ctx);
    const result = await caller.listAudit({ workReportId: UUIDS.report });

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('APPROVED');
    expect(result[0].user.fullName).toBe('Manager One');

    const arg = ctx.prisma.workReportAudit.findMany.mock.calls[0][0];
    expect(arg.where.workReportId).toBe(UUIDS.report);
    expect(arg.include.user).toEqual({ select: { fullName: true } });
    expect(arg.orderBy.createdAt).toBe('desc');
  });

  it('listAudit throws FORBIDDEN for contractor accessing others report', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.manager,
    });

    const caller = createCaller(ctx);
    await expect(caller.listAudit({ workReportId: UUIDS.report })).rejects.toThrow();
  });

  it('listAudit allows contractor accessing own report', async () => {
    const ctx = makeCtx('CONTRACTOR', UUIDS.contractor);
    ctx.prisma.workReport.findUnique.mockResolvedValue({
      id: UUIDS.report,
      createdById: UUIDS.contractor,
    });
    ctx.prisma.workReportAudit.findMany.mockResolvedValue([]);

    const caller = createCaller(ctx);
    const result = await caller.listAudit({ workReportId: UUIDS.report });
    expect(result).toEqual([]);
  });

  it('audit log UI exists in work report detail page', () => {
    const content = readFileSync(join(process.cwd(), 'app', 'projects', '[id]', 'reports', '[reportId]', 'page.tsx'), 'utf-8');
    expect(content).toContain('listAudit');
    expect(content).toContain('تاریخچه تغییرات');
  });
});
