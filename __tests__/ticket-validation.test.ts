/**
 * Ticket Input Validation Tests
 * Tests Zod schemas used by the ticket router procedures
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

// Replicate schemas from ticket router
const listInputSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
});

const getByIdInputSchema = z.object({
  id: z.string().uuid(),
});

const createInputSchema = z.object({
  title: z.string().min(1, 'عنوان الزامی است'),
  description: z.string().min(1, 'توضیحات الزامی است'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  projectId: z.string().uuid(),
  attachments: z.array(
    z.object({
      fileName: z.string(),
      filePath: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
    })
  ).optional().default([]),
});

const addReplyInputSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1, 'متن پاسخ الزامی است'),
});

const addAttachmentInputSchema = z.object({
  ticketId: z.string().uuid(),
  fileName: z.string(),
  filePath: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
});

const updateStatusInputSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

const closeInputSchema = z.object({
  id: z.string().uuid(),
});

const deleteInputSchema = z.object({
  id: z.string().uuid(),
});

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Ticket Input Validation', () => {
  describe('list', () => {
    it('should validate correct list input with defaults', () => {
      const result = listInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate list input with all fields', () => {
      const input = {
        page: 2,
        limit: 50,
        search: 'test ticket',
        status: 'OPEN',
        priority: 'HIGH',
        projectId: VALID_UUID,
      };
      const result = listInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject page < 1', () => {
      const result = listInputSchema.safeParse({ page: 0, limit: 20 });
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const result = listInputSchema.safeParse({ page: 1, limit: 200 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid status enum', () => {
      const result = listInputSchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority enum', () => {
      const result = listInputSchema.safeParse({ priority: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid projectId UUID', () => {
      const result = listInputSchema.safeParse({ projectId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should accept null for nullable fields', () => {
      const result = listInputSchema.safeParse({
        search: null,
        status: null,
        priority: null,
        projectId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should validate correct UUID', () => {
      const result = getByIdInputSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID string', () => {
      const result = getByIdInputSchema.safeParse({ id: 'abc123' });
      expect(result.success).toBe(false);
    });

    it('should reject missing id', () => {
      const result = getByIdInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('create', () => {
    const validInput = {
      title: 'تیکت تستی',
      description: 'توضیحات تستی',
      projectId: VALID_UUID,
    };

    it('should validate correct create input with default priority', () => {
      const result = createInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('MEDIUM');
        expect(result.data.attachments).toEqual([]);
      }
    });

    it('should validate create input with explicit priority', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        priority: 'URGENT',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('URGENT');
      }
    });

    it('should validate create input with attachments', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        attachments: [
          {
            fileName: 'test.pdf',
            filePath: '/uploads/tickets/pdf/test.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attachments).toHaveLength(1);
      }
    });

    it('should reject empty title', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        title: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        description: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid priority enum', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        priority: 'CRITICAL',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid projectId', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        projectId: 'not-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject attachment with missing fields', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        attachments: [{ fileName: 'test.pdf' }],
      });
      expect(result.success).toBe(false);
    });

    it('should accept multiple attachments', () => {
      const result = createInputSchema.safeParse({
        ...validInput,
        attachments: [
          { fileName: 'a.pdf', filePath: '/a.pdf', fileType: 'application/pdf', fileSize: 100 },
          { fileName: 'b.png', filePath: '/b.png', fileType: 'image/png', fileSize: 200 },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attachments).toHaveLength(2);
      }
    });
  });

  describe('addReply', () => {
    it('should validate correct reply input', () => {
      const result = addReplyInputSchema.safeParse({
        ticketId: VALID_UUID,
        content: 'این یک پاسخ است',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = addReplyInputSchema.safeParse({
        ticketId: VALID_UUID,
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid ticketId', () => {
      const result = addReplyInputSchema.safeParse({
        ticketId: 'abc',
        content: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addAttachment', () => {
    it('should validate correct attachment input', () => {
      const result = addAttachmentInputSchema.safeParse({
        ticketId: VALID_UUID,
        fileName: 'doc.pdf',
        filePath: '/uploads/tickets/pdf/doc.pdf',
        fileType: 'application/pdf',
        fileSize: 5120,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing fileName', () => {
      const result = addAttachmentInputSchema.safeParse({
        ticketId: VALID_UUID,
        filePath: '/doc.pdf',
        fileType: 'application/pdf',
        fileSize: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fileSize', () => {
      const result = addAttachmentInputSchema.safeParse({
        ticketId: VALID_UUID,
        fileName: 'doc.pdf',
        filePath: '/doc.pdf',
        fileType: 'application/pdf',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should validate correct status update', () => {
      const result = updateStatusInputSchema.safeParse({
        id: VALID_UUID,
        status: 'IN_PROGRESS',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = updateStatusInputSchema.safeParse({
        id: VALID_UUID,
        status: 'PENDING',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid id', () => {
      const result = updateStatusInputSchema.safeParse({
        id: 'not-uuid',
        status: 'OPEN',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid statuses', () => {
      const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
      for (const status of statuses) {
        const result = updateStatusInputSchema.safeParse({ id: VALID_UUID, status });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('close', () => {
    it('should validate correct close input', () => {
      const result = closeInputSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('should reject invalid id', () => {
      const result = closeInputSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('delete', () => {
    it('should validate correct delete input', () => {
      const result = deleteInputSchema.safeParse({ id: VALID_UUID });
      expect(result.success).toBe(true);
    });

    it('should reject invalid id', () => {
      const result = deleteInputSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });
  });
});
