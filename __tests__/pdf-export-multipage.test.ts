declare const describe: any;
declare const it: any;
declare const expect: any;
declare const jest: any;

jest.mock('pdfmake/build/pdfmake', () => ({
  __esModule: true,
  default: {
    createPdf: jest.fn(() => ({ download: jest.fn() })),
    vfs: {},
    fonts: {},
  },
}));

jest.mock('pdfmake/build/vfs_fonts', () => ({
  __esModule: true,
  default: { pdfMake: { vfs: {} } },
}));

import { generateDocumentPDF } from '../lib/services/pdf-export';
import pdfMake from 'pdfmake/build/pdfmake';

describe('PDF export multi-page behavior', () => {
  it('uses row-safe table options and includes all rows for large documents', async () => {
    const items = Array.from({ length: 200 }).map((_, index) => ({
      productName: `محصول ${index + 1}`,
      description: `توضیح ${index + 1}`,
      quantity: 1,
      unit: 'عدد',
      purchasePrice: 1000,
      sellPrice: 1200,
      profitPercentage: 20,
      supplier: 'تامین کننده',
      isManualPrice: false,
    }));

    const doc: any = {
      documentNumber: 'INV-TEST-200',
      documentType: 'TEMP_PROFORMA',
      issueDate: new Date('2026-01-01T00:00:00.000Z'),
      totalAmount: 240000,
      discountAmount: 0,
      finalAmount: 240000,
      items,
      customer: {
        name: 'مشتری تست',
        code: 'C-200',
        phone: '09120000000',
      },
      createdBy: {
        fullName: 'Tester',
      },
    };

    await generateDocumentPDF(doc);

  const mockCreatePdf = (pdfMake as any).createPdf;
    expect(mockCreatePdf.mock.results.length).toBeGreaterThan(0);
  const mockDownload = mockCreatePdf.mock.results[0].value.download;

    expect(mockCreatePdf).toHaveBeenCalledTimes(1);

    const definition = mockCreatePdf.mock.calls[0][0];
    const tableSection = definition.content.find(
      (entry: any) => entry.stack && entry.stack[1]?.table?.headerRows === 1
    );
    expect(tableSection).toBeTruthy();

    const table = tableSection.stack[1].table;
    expect(table.headerRows).toBe(1);
    expect(table.dontBreakRows).toBe(true);
    expect(table.keepWithHeaderRows).toBe(1);

    // header + 200 items
    expect(table.body.length).toBe(201);
    expect(mockDownload).toHaveBeenCalledWith('INV-TEST-200.pdf');
  });
});
