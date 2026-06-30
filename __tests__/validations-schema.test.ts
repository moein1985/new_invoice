import { describe, it, expect } from '@jest/globals';
import {
  createCustomerSchema,
  updateCustomerSchema,
  documentItemSchema,
  createDocumentSchema,
  createUserSchema,
  updateUserSchema,
} from '../lib/validations';

describe('lib/validations schemas', () => {
  it('validates customer create and rejects invalid phone', () => {
    const ok = createCustomerSchema.safeParse({
      name: 'شرکت نمونه',
      phone: '+98 912-111-2233',
      email: 'info@example.com',
    });
    const bad = createCustomerSchema.safeParse({
      name: 'شرکت نمونه',
      phone: '0912-abc-1234',
    });

    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('requires uuid in customer update', () => {
    expect(
      updateCustomerSchema.safeParse({
        id: 'not-uuid',
        name: 'A',
      }).success
    ).toBe(false);
  });

  it('applies defaults for document item isManualPrice', () => {
    const parsed = documentItemSchema.parse({
      productName: 'کابل',
      quantity: 2,
      unit: 'عدد',
      purchasePrice: 100,
      sellPrice: 120,
      supplier: 'تامین کننده',
    });

    expect(parsed.isManualPrice).toBe(false);
  });

  it('coerces issueDate and applies document defaults', () => {
    const parsed = createDocumentSchema.parse({
      documentType: 'INVOICE',
      customerId: '0f59d836-ef6e-4ced-8e5f-2d567a31dc62',
      issueDate: '2026-04-01',
      items: [
        {
          productName: 'پروفیل',
          quantity: 1,
          unit: 'شاخه',
          purchasePrice: 1000,
          sellPrice: 1200,
          supplier: 'Supplier',
        },
      ],
    });

    expect(parsed.issueDate instanceof Date).toBe(true);
    expect(parsed.discountAmount).toBe(0);
    expect(parsed.defaultProfitPercentage).toBe(20);
  });

  it('validates user creation and default flags', () => {
    const parsed = createUserSchema.parse({
      username: 'test_user_1',
      password: '123456',
      fullName: 'Test User',
    });

    expect(parsed.role).toBe('USER');
    expect(parsed.isActive).toBe(true);
  });

  it('rejects short password in update when provided', () => {
    const result = updateUserSchema.safeParse({
      id: '7d6f9a6f-9ed5-4b45-a473-84767fe53d4f',
      password: '123',
    });

    expect(result.success).toBe(false);
  });
});
