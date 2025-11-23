import { z } from 'zod';

// Customer Schemas
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'نام الزامی است').max(255, 'نام بیش از حد طولانی است'),
  phone: z.string().min(1, 'تلفن الزامی است').regex(/^[0-9+\-() ]+$/, 'فرمت تلفن نامعتبر است'),
  email: z.string().email('ایمیل نامعتبر است').optional().or(z.literal('')),
  address: z.string().max(500, 'آدرس بیش از حد طولانی است').optional(),
});

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid('شناسه نامعتبر است'),
});

// Document Item Schema
export const documentItemSchema = z.object({
  productName: z.string().min(1, 'نام محصول الزامی است').max(255),
  description: z.string().max(500).optional(),
  quantity: z.number().positive('تعداد باید بیشتر از صفر باشد'),
  unit: z.string().min(1, 'واحد الزامی است').max(50),
  purchasePrice: z.number().min(0, 'قیمت خرید نمی‌تواند منفی باشد'),
  sellPrice: z.number().min(0, 'قیمت فروش نمی‌تواند منفی باشد'),
  profitPercentage: z.number().optional(),
  supplier: z.string().min(1, 'تأمین‌کننده الزامی است').max(255),
  isManualPrice: z.boolean().default(false),
});

// Document Schemas
export const createDocumentSchema = z.object({
  documentType: z.enum(['TEMP_PROFORMA', 'PROFORMA', 'INVOICE', 'RETURN_INVOICE', 'RECEIPT', 'OTHER']),
  customerId: z.string().uuid('مشتری نامعتبر است'),
  projectName: z.string().max(255).optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  discountAmount: z.number().min(0, 'مبلغ تخفیف نمی‌تواند منفی باشد').default(0),
  notes: z.string().max(1000).optional(),
  attachment: z.string().optional(),
  defaultProfitPercentage: z.number().default(20),
  items: z.array(documentItemSchema).min(1, 'حداقل یک قلم الزامی است'),
});

// User Schemas
export const createUserSchema = z.object({
  username: z.string()
    .min(3, 'نام کاربری باید حداقل 3 کاراکتر باشد')
    .max(50, 'نام کاربری بیش از حد طولانی است')
    .regex(/^[a-zA-Z0-9_]+$/, 'نام کاربری فقط می‌تواند شامل حروف، اعداد و _ باشد'),
  password: z.string()
    .min(6, 'رمز عبور باید حداقل 6 کاراکتر باشد')
    .max(100, 'رمز عبور بیش از حد طولانی است'),
  fullName: z.string()
    .min(1, 'نام کامل الزامی است')
    .max(255, 'نام کامل بیش از حد طولانی است'),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']).default('USER'),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  id: z.string().uuid('شناسه نامعتبر است'),
  fullName: z.string()
    .min(1, 'نام کامل الزامی است')
    .max(255, 'نام کامل بیش از حد طولانی است')
    .optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string()
    .min(6, 'رمز عبور باید حداقل 6 کاراکتر باشد')
    .max(100, 'رمز عبور بیش از حد طولانی است')
    .optional(),
});

// Type exports
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type DocumentItemInput = z.infer<typeof documentItemSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
