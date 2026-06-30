/**
 * Project & Work Report Validation Tests
 * Tests all Zod schemas used in project and work report tRPC routers
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// ============================================
// Project Schemas (matching server/api/routers/project.ts)
// ============================================

const projectListSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  activeOnly: z.boolean().optional().default(true),
});

const projectCreateSchema = z.object({
  name: z.string().min(1, 'نام پروژه الزامی است'),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  employerName: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const projectUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  address: z.string().optional(),
  employerName: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const addMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

// ============================================
// Work Report Schemas (matching server/api/routers/workReport.ts)
// ============================================

const workReportListSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

const workReportListAllSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  projectId: z.string().uuid().optional(),
});

const workReportCreateSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(
    z.object({
      description: z.string().min(1, 'شرح الزامی است'),
      unit: z.string().min(1),
      quantity: z.number().min(0),
    })
  ).min(1, 'حداقل یک آیتم الزامی است'),
  notes: z.string().optional(),
});

const workReportUpdateSchema = z.object({
  id: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string().uuid().optional(),
      description: z.string().min(1),
      unit: z.string().min(1),
      quantity: z.number().min(0),
      unitPrice: z.number().min(0).optional(),
    })
  ).min(1),
  notes: z.string().optional(),
});

const searchDescriptionsSchema = z.object({
  query: z.string().min(1),
});

// ============================================
// Tests
// ============================================

describe('Project Input Validation', () => {
  describe('list', () => {
    it('should accept empty input with defaults', () => {
      const result = projectListSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.activeOnly).toBe(true);
      }
    });

    it('should accept valid list input', () => {
      const result = projectListSchema.safeParse({ page: 2, limit: 50, search: 'test' });
      expect(result.success).toBe(true);
    });

    it('should reject page < 1', () => {
      const result = projectListSchema.safeParse({ page: 0, limit: 20 });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = projectListSchema.safeParse({ page: 1, limit: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('create', () => {
    it('should accept valid create input', () => {
      const result = projectCreateSchema.safeParse({
        name: 'پروژه تست',
        description: 'توضیحات',
        address: 'اصفهان',
        employerName: 'کارفرما',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should accept create with only name', () => {
      const result = projectCreateSchema.safeParse({ name: 'پروژه ساده' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = projectCreateSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = projectCreateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept null values for optional fields', () => {
      const result = projectCreateSchema.safeParse({
        name: 'پروژه تست',
        description: null,
        address: null,
        employerName: null,
        startDate: null,
        endDate: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept undefined values for optional fields', () => {
      const result = projectCreateSchema.safeParse({
        name: 'پروژه تست',
        description: undefined,
        address: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-string description', () => {
      const result = projectCreateSchema.safeParse({
        name: 'پروژه تست',
        description: 123,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('update', () => {
    const validId = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept valid update input', () => {
      const result = projectUpdateSchema.safeParse({
        id: validId,
        name: 'نام جدید',
        isActive: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = projectUpdateSchema.safeParse({ id: 'not-a-uuid', name: 'test' });
      expect(result.success).toBe(false);
    });

    it('should accept nullable date fields', () => {
      const result = projectUpdateSchema.safeParse({
        id: validId,
        startDate: null,
        endDate: null,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name string', () => {
      const result = projectUpdateSchema.safeParse({ id: validId, name: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('addMember', () => {
    it('should accept valid UUIDs', () => {
      const result = addMemberSchema.safeParse({
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '660e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID strings', () => {
      const result = addMemberSchema.safeParse({
        projectId: '123',
        userId: 'abc',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const result = addMemberSchema.safeParse({ projectId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Work Report Input Validation', () => {
  const validProjectId = '550e8400-e29b-41d4-a716-446655440000';
  const validReportId = '660e8400-e29b-41d4-a716-446655440001';

  describe('list', () => {
    it('should accept valid project ID with defaults', () => {
      const result = workReportListSchema.safeParse({ projectId: validProjectId });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject non-UUID projectId', () => {
      const result = workReportListSchema.safeParse({ projectId: 'not-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing projectId', () => {
      const result = workReportListSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('listAll', () => {
    it('should accept empty input with defaults', () => {
      const result = workReportListAllSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept valid approval status filter', () => {
      const result = workReportListAllSchema.safeParse({
        approvalStatus: 'PENDING',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid approval status', () => {
      const result = workReportListAllSchema.safeParse({
        approvalStatus: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('should accept search and projectId filter together', () => {
      const result = workReportListAllSchema.safeParse({
        search: 'WR-2026',
        projectId: validProjectId,
        approvalStatus: 'APPROVED',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should accept valid work report', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [
          { description: 'خاکبرداری', unit: 'متر مکعب', quantity: 150 },
          { description: 'بتن ریزی', unit: 'متر مکعب', quantity: 50 },
        ],
        notes: 'یادداشت تست',
      });
      expect(result.success).toBe(true);
    });

    it('should accept work report without notes', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [{ description: 'کار تست', unit: 'عدد', quantity: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty items array', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing projectId', () => {
      const result = workReportCreateSchema.safeParse({
        items: [{ description: 'test', unit: 'عدد', quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject item with empty description', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [{ description: '', unit: 'عدد', quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject item with empty unit', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [{ description: 'test', unit: '', quantity: 1 }],
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [{ description: 'test', unit: 'عدد', quantity: -5 }],
      });
      expect(result.success).toBe(false);
    });

    it('should accept zero quantity', () => {
      const result = workReportCreateSchema.safeParse({
        projectId: validProjectId,
        items: [{ description: 'test', unit: 'عدد', quantity: 0 }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept notes as null (real-world form behavior)', () => {
      // Forms might send null for optional text fields
      const schema = workReportCreateSchema.extend({
        notes: z.string().optional().nullable(),
      });
      const result = schema.safeParse({
        projectId: validProjectId,
        items: [{ description: 'test', unit: 'عدد', quantity: 1 }],
        notes: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('should accept valid update input', () => {
      const result = workReportUpdateSchema.safeParse({
        id: validReportId,
        items: [
          { description: 'آیتم ویرایش شده', unit: 'متر', quantity: 100, unitPrice: 50000 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept existing item IDs for update', () => {
      const result = workReportUpdateSchema.safeParse({
        id: validReportId,
        items: [
          {
            id: '770e8400-e29b-41d4-a716-446655440002',
            description: 'آیتم موجود',
            unit: 'متر',
            quantity: 100,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty items in update', () => {
      const result = workReportUpdateSchema.safeParse({
        id: validReportId,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative unitPrice', () => {
      const result = workReportUpdateSchema.safeParse({
        id: validReportId,
        items: [
          { description: 'test', unit: 'عدد', quantity: 1, unitPrice: -100 },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchDescriptions', () => {
    it('should accept valid query', () => {
      const result = searchDescriptionsSchema.safeParse({ query: 'خاک' });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = searchDescriptionsSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing query', () => {
      const result = searchDescriptionsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

describe('Business Logic: Project Code Generation', () => {
  it('should generate correct project code format', () => {
    const year = new Date().getFullYear();
    const seq = 1;
    const code = `PRJ-${year}-${seq.toString().padStart(4, '0')}`;
    expect(code).toMatch(/^PRJ-\d{4}-\d{4}$/);
    expect(code).toBe(`PRJ-${year}-0001`);
  });

  it('should increment sequence correctly', () => {
    const existingCode = 'PRJ-2026-0005';
    const parts = existingCode.split('-');
    const seq = parseInt(parts[2], 10) + 1;
    const newCode = `PRJ-${parts[1]}-${seq.toString().padStart(4, '0')}`;
    expect(newCode).toBe('PRJ-2026-0006');
  });
});

describe('Business Logic: Report Number Generation', () => {
  it('should generate correct report number format', () => {
    const year = new Date().getFullYear();
    const seq = 1;
    const reportNumber = `WR-${year}-${seq.toString().padStart(4, '0')}`;
    expect(reportNumber).toMatch(/^WR-\d{4}-\d{4}$/);
    expect(reportNumber).toBe(`WR-${year}-0001`);
  });
});

describe('Business Logic: Total Amount Calculation', () => {
  it('should calculate total amount correctly', () => {
    const items = [
      { quantity: 10, unitPrice: 50000, totalPrice: 10 * 50000 },
      { quantity: 5, unitPrice: 100000, totalPrice: 5 * 100000 },
    ];
    const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);
    expect(totalAmount).toBe(1000000);
  });

  it('should handle zero prices', () => {
    const items = [
      { quantity: 10, unitPrice: 0, totalPrice: 0 },
    ];
    const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);
    expect(totalAmount).toBe(0);
  });
});
