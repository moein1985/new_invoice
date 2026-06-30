import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { loadVazirmatnFonts } from './vfs-fonts';

// Register default VFS first (Roboto fallback)
// @ts-expect-error - pdfMake vfs type issue
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

let vazirFontsReady = false;

async function ensureVazirFonts() {
  if (vazirFontsReady) return;
  try {
    const vazirVfs = await loadVazirmatnFonts();
    // Merge Vazirmatn fonts into pdfMake VFS
    Object.assign(pdfMake.vfs, vazirVfs);
    pdfMake.fonts = {
      Vazirmatn: {
        normal: 'Vazirmatn-Regular.ttf',
        bold: 'Vazirmatn-Bold.ttf',
        italics: 'Vazirmatn-Regular.ttf',
        bolditalics: 'Vazirmatn-Bold.ttf',
      },
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
    vazirFontsReady = true;
  } catch (e) {
    console.warn('Failed to load Vazirmatn fonts, falling back to Roboto', e);
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
  }
}

interface DocumentItem {
  productName: string;
  description?: string | null;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellPrice: number;
  profitPercentage?: number | null;
  supplier: string;
  isManualPrice: boolean;
}

interface Customer {
  name: string;
  code: string;
  phone: string;
  company?: string | null;
  address?: string | null;
}

interface Document {
  documentNumber: string;
  documentType: string;
  issueDate: string | Date;
  dueDate?: string | Date | null;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  notes?: string | null;
  items: DocumentItem[];
  customer: Customer;
  createdBy: {
    fullName: string;
  };
}

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount) + '\nریال';
};

const formatDate = (date: string | Date): string => {
  // Use fa-IR for date but convert Persian digits to Western for pdfmake
  const faDate = new Date(date).toLocaleDateString('fa-IR');
  return faDate.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
};

// pdfmake has no BiDi support - it renders all text LTR.
// For RTL text to display correctly, we reverse the word order
// so pdfmake's LTR rendering produces the correct visual RTL result.
const rtl = (text: string): string => {
  if (!text) return text;
  return text.split(' ').reverse().join(' ');
};

// For mixed Persian+English text (like product names), split into
// separate lines per script so pdfmake doesn't wrap incorrectly.
// Returns a pdfmake stack array.
const rtlMixed = (text: string): any[] => {
  if (!text) return [{ text: '' }];

  const words = text.split(/\s+/).filter(Boolean);
  const segments: { text: string; isRtl: boolean }[] = [];

  for (const word of words) {
    const isRtl = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(word);
    if (segments.length > 0 && segments[segments.length - 1].isRtl === isRtl) {
      segments[segments.length - 1].text += ' ' + word;
    } else {
      segments.push({ text: word, isRtl });
    }
  }

  // If all one script, no need for separate lines
  if (segments.length <= 1) {
    const seg = segments[0];
    return [{ text: seg.isRtl ? seg.text.split(' ').reverse().join(' ') : seg.text }];
  }

  // Each segment becomes its own line; RTL segments get word order reversed
  return segments.map(seg => ({
    text: seg.isRtl ? seg.text.split(' ').reverse().join(' ') : seg.text,
  }));
};

export const generateDocumentPDF = async (document: Document) => {
  await ensureVazirFonts();
  const fontName = vazirFontsReady ? 'Vazirmatn' : 'Roboto';
  const showInternal = document.documentType === 'TEMP_PROFORMA';

  // Calculate totals
  const totalPurchase = document.items.reduce(
    (sum, item) => sum + item.purchasePrice * item.quantity,
    0
  );
  const totalProfit = document.items.reduce(
    (sum, item) => sum + (item.sellPrice - item.purchasePrice) * item.quantity,
    0
  );

  // Build table headers (RTL order: right to left)
  const tableHeaders: any[] = [];

  tableHeaders.push({ text: rtl('مبلغ کل'), style: 'tableHeader', alignment: 'center' });

  if (showInternal) {
    tableHeaders.push({ text: rtl('سود'), style: 'tableHeader', alignment: 'center' });
  }

  tableHeaders.push({ text: rtl('قیمت فروش'), style: 'tableHeader', alignment: 'center' });

  if (showInternal) {
    tableHeaders.push(
      { text: rtl('درصد سود'), style: 'tableHeader', alignment: 'center' },
      { text: rtl('قیمت خرید'), style: 'tableHeader', alignment: 'center' }
    );
  }

  tableHeaders.push(
    { text: rtl('واحد'), style: 'tableHeader', alignment: 'center' },
    { text: rtl('تعداد'), style: 'tableHeader', alignment: 'center' },
    { text: rtl('نام محصول'), style: 'tableHeader', alignment: 'right' },
    { text: rtl('ردیف'), style: 'tableHeader', alignment: 'center' }
  );

  // Build table rows (RTL order)
  const tableRows = document.items.map((item, index) => {
    const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
    const profitPercent =
      item.purchasePrice > 0
        ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
        : 0;

    const row: any[] = [];

    row.push({ text: formatCurrency(item.sellPrice * item.quantity), bold: true, alignment: 'center' });

    if (showInternal) {
      row.push({ text: formatCurrency(profit), color: '#16a34a', alignment: 'center' });
    }

    row.push({ text: formatCurrency(item.sellPrice), alignment: 'center' });

    if (showInternal) {
      row.push(
        { text: profitPercent.toFixed(1) + '%', alignment: 'center' },
        { text: formatCurrency(item.purchasePrice), alignment: 'center' }
      );
    }

    row.push(
      { text: rtl(item.unit), alignment: 'center' },
      { text: item.quantity.toString(), alignment: 'center' },
      {
        stack: [
          ...rtlMixed(item.productName).map((s: any) => ({ ...s, bold: true, alignment: 'right' })),
          ...(item.description ? rtlMixed(item.description).map((s: any) => ({ ...s, fontSize: 9, color: '#666', alignment: 'right' })) : []),
        ],
      },
      { text: (index + 1).toString(), alignment: 'center' }
    );

    return row;
  });

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: fontName,
      fontSize: 10,
      alignment: 'right' as const,
    },
    content: [
      // Header
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: rtl(DOC_TYPES[document.documentType] || document.documentType),
                style: 'header',
                alignment: 'right',
              },
              {
                text: rtl(`شماره سند: ${document.documentNumber}`),
                style: 'subheader',
                alignment: 'right',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // Document Info
      {
        style: 'section',
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: rtl('تاریخ سند: ' + formatDate(document.issueDate)), border: [true, true, true, true] },
              {
                text: document.dueDate ? rtl('سررسید: ' + formatDate(document.dueDate)) : '',
                border: [true, true, true, true],
              },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
      },

      // Customer Info
      {
        style: 'section',
        stack: [
          { text: rtl('اطلاعات مشتری'), style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  { text: document.customer.company ? rtl('شرکت: ' + document.customer.company) : '', alignment: 'right' },
                  { text: rtl('تلفن: ' + document.customer.phone), alignment: 'right' },
                  { text: rtl('کد: ' + document.customer.code), alignment: 'right' },
                  { text: rtl('نام: ' + document.customer.name), alignment: 'right' },
                ],
              ],
            },
            layout: 'lightHorizontalLines',
          },
        ],
      },

      // Items Table
      {
        style: 'section',
        stack: [
          { text: rtl('ردیف‌های سند'), style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              headerRows: 1,
              dontBreakRows: true,
              keepWithHeaderRows: 1,
              widths: showInternal
                ? ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto']
                : ['auto', 'auto', 'auto', 'auto', '*', 'auto'],
              body: [tableHeaders, ...tableRows],
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f3f4f6' : null),
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#e5e7eb',
              vLineColor: () => '#e5e7eb',
            },
          },
        ],
      },

      // Totals
      {
        style: 'section',
        stack: [
          { text: rtl('محاسبات'), style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              widths: ['auto', '*'],
              body: [
                ...(showInternal
                  ? [
                      [{ text: formatCurrency(totalPurchase), alignment: 'left' }, { text: rtl('جمع خرید:'), alignment: 'right' }],
                      [
                        { text: formatCurrency(totalProfit), color: '#16a34a', alignment: 'left' },
                        { text: rtl('جمع سود:'), alignment: 'right', color: '#16a34a' },
                      ],
                    ]
                  : []),
                [{ text: formatCurrency(document.totalAmount), alignment: 'left' }, { text: rtl('جمع کل:'), alignment: 'right' }],
                ...(document.discountAmount > 0
                  ? [
                      [
                        { text: formatCurrency(document.discountAmount), color: '#dc2626', alignment: 'left' },
                        { text: rtl('تخفیف:'), alignment: 'right', color: '#dc2626' },
                      ],
                    ]
                  : []),
                [
                  { text: formatCurrency(document.finalAmount), bold: true, fontSize: 12, alignment: 'left' },
                  { text: rtl('مبلغ قابل پرداخت:'), alignment: 'right', bold: true, fontSize: 12 },
                ],
              ],
            },
            layout: 'lightHorizontalLines',
          },
        ],
      },

      // Notes
      ...(document.notes
        ? [
            {
              style: 'section',
              stack: [
                { text: rtl('یادداشت\u200cها'), style: 'sectionTitle', alignment: 'right' },
                { text: rtl(document.notes), alignment: 'right' },
              ],
            },
          ]
        : []),
    ],
    styles: {
      header: {
        fontSize: 20,
        bold: true,
        color: '#2563eb',
        margin: [0, 0, 0, 5],
      },
      subheader: {
        fontSize: 12,
        margin: [0, 0, 0, 10],
      },
      section: {
        margin: [0, 10, 0, 10],
      },
      sectionTitle: {
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        fillColor: '#f3f4f6',
      },
    },
  };

  pdfMake.createPdf(docDefinition).download(`${document.documentNumber}.pdf`);
};
