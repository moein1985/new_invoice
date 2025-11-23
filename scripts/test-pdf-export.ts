// Test script to debug PDF export issue
import { generateDocumentPDFFromHTML } from '../lib/services/pdf-export-html';

const mockDocument = {
  documentNumber: 'TEST-001',
  documentType: 'PROFORMA',
  issueDate: new Date(),
  dueDate: null,
  totalAmount: 1000000,
  discountAmount: 0,
  finalAmount: 1000000,
  notes: null,
  items: [
    {
      productName: 'محصول تست',
      description: 'توضیحات تست',
      quantity: 2,
      unit: 'عدد',
      purchasePrice: 100000,
      sellPrice: 150000,
      profitPercentage: 50,
      supplier: 'تامین کننده',
      isManualPrice: false,
    },
  ],
  customer: {
    name: 'مشتری تست',
    code: 'CUST-001',
    phone: '09123456789',
    company: null,
    address: null,
  },
  createdBy: {
    fullName: 'کاربر تست',
  },
};

console.log('🧪 Testing PDF export function...');
console.log('Mock document:', JSON.stringify(mockDocument, null, 2));

try {
  // Check if function exists
  console.log('✅ Function imported:', typeof generateDocumentPDFFromHTML);
  console.log('Function:', generateDocumentPDFFromHTML.toString().substring(0, 200));
  
  // Try to call it
  console.log('📝 Calling generateDocumentPDFFromHTML...');
  generateDocumentPDFFromHTML(mockDocument as any);
  console.log('✅ Function called successfully!');
} catch (error) {
  console.error('❌ Error:', error);
  console.error('Stack:', (error as Error).stack);
}
