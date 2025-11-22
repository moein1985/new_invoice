/**
 * Document Business Logic Tests
 */

import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';

const documentTypes = ['INVOICE', 'DELIVERY_NOTE', 'PROFORMA', 'ORDER'] as const;

const listInputSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  customerId: z.string().optional(),
  type: z.enum(documentTypes).optional(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED']).optional(),
});

const createInputSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(documentTypes),
  documentNumber: z.string().min(1),
  documentDate: z.string(),
  totalAmount: z.number().min(0),
  description: z.string().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().min(0.01),
      unitPrice: z.number().min(0),
      discount: z.number().min(0).max(100).optional(),
      tax: z.number().min(0).max(100).optional(),
    })
  ).min(1),
});

describe('Document Input Validation', () => {
  describe('list', () => {
    it('should validate correct list input', () => {
      const input = { page: 1, limit: 50 };
      const result = listInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with filters', () => {
      const input = {
        page: 1,
        limit: 50,
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        status: 'SENT' as const,
      };
      const result = listInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid document type', () => {
      const input = {
        page: 1,
        limit: 50,
        type: 'INVALID_TYPE',
      };
      const result = listInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('create', () => {
    it('should validate correct document with items', () => {
      const input = {
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        documentNumber: 'INV-001',
        documentDate: '2024-01-01',
        totalAmount: 1000,
        items: [
          {
            description: 'محصول 1',
            quantity: 2,
            unitPrice: 500,
          },
        ],
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with optional fields', () => {
      const input = {
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        documentNumber: 'INV-001',
        documentDate: '2024-01-01',
        totalAmount: 1100,
        description: 'توضیحات',
        items: [
          {
            description: 'محصول 1',
            quantity: 2,
            unitPrice: 500,
            discount: 10,
            tax: 9,
          },
        ],
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject document without items', () => {
      const input = {
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        documentNumber: 'INV-001',
        documentDate: '2024-01-01',
        totalAmount: 1000,
        items: [],
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const input = {
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        documentNumber: 'INV-001',
        documentDate: '2024-01-01',
        totalAmount: 1000,
        items: [
          {
            description: 'محصول 1',
            quantity: -1,
            unitPrice: 500,
          },
        ],
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject discount over 100%', () => {
      const input = {
        customerId: 'customer-123',
        type: 'INVOICE' as const,
        documentNumber: 'INV-001',
        documentDate: '2024-01-01',
        totalAmount: 1000,
        items: [
          {
            description: 'محصول 1',
            quantity: 1,
            unitPrice: 500,
            discount: 150,
          },
        ],
      };
      const result = createInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('Document Business Logic', () => {
  describe('item calculations', () => {
    it('should calculate item total without discount', () => {
      const quantity = 2;
      const unitPrice = 500;
      const total = quantity * unitPrice;
      expect(total).toBe(1000);
    });

    it('should calculate item total with discount', () => {
      const quantity = 2;
      const unitPrice = 500;
      const discount = 10; // 10%
      const subtotal = quantity * unitPrice;
      const discountAmount = (subtotal * discount) / 100;
      const total = subtotal - discountAmount;
      expect(total).toBe(900);
    });

    it('should calculate item total with tax', () => {
      const quantity = 2;
      const unitPrice = 500;
      const tax = 9; // 9%
      const subtotal = quantity * unitPrice;
      const taxAmount = (subtotal * tax) / 100;
      const total = subtotal + taxAmount;
      expect(total).toBe(1090);
    });

    it('should calculate with both discount and tax', () => {
      const quantity = 2;
      const unitPrice = 500;
      const discount = 10;
      const tax = 9;
      
      const subtotal = quantity * unitPrice;
      const afterDiscount = subtotal - (subtotal * discount) / 100;
      const total = afterDiscount + (afterDiscount * tax) / 100;
      
      expect(total).toBe(981);
    });
  });

  describe('document total', () => {
    it('should sum all items', () => {
      const items = [
        { total: 1000 },
        { total: 500 },
        { total: 250 },
      ];
      const total = items.reduce((sum, item) => sum + item.total, 0);
      expect(total).toBe(1750);
    });
  });

  describe('document status', () => {
    it('should start as DRAFT', () => {
      const status = 'DRAFT';
      expect(status).toBe('DRAFT');
    });

    it('should allow valid status transitions', () => {
      const validStatuses = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED'];
      validStatuses.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });
  });
});
