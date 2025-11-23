import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Register fonts
// @ts-expect-error - pdfMake vfs type issue
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;

// Use default fonts - Roboto has better Unicode support than custom fonts
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

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
  return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
};

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('fa-IR');
};

export const generateDocumentPDF = (document: Document) => {
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

  // Build table headers
  const tableHeaders = [
    { text: 'ردیف', style: 'tableHeader', alignment: 'center' },
    { text: 'نام محصول', style: 'tableHeader' },
    { text: 'تعداد', style: 'tableHeader', alignment: 'center' },
    { text: 'واحد', style: 'tableHeader', alignment: 'center' },
  ];

  if (showInternal) {
    tableHeaders.push(
      { text: 'قیمت خرید', style: 'tableHeader' },
      { text: 'درصد سود', style: 'tableHeader', alignment: 'center' }
    );
  }

  tableHeaders.push({ text: 'قیمت فروش', style: 'tableHeader' });

  if (showInternal) {
    tableHeaders.push({ text: 'سود', style: 'tableHeader' });
  }

  tableHeaders.push({ text: 'مبلغ کل', style: 'tableHeader' });

  // Build table rows
  const tableRows = document.items.map((item, index) => {
    const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
    const profitPercent =
      item.purchasePrice > 0
        ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
        : 0;

    const row: any[] = [
      { text: (index + 1).toString(), alignment: 'center' },
      {
        stack: [
          { text: item.productName, bold: true },
          item.description ? { text: item.description, fontSize: 9, color: '#666' } : null,
        ].filter(Boolean),
      },
      { text: item.quantity.toString(), alignment: 'center' },
      { text: item.unit, alignment: 'center' },
    ];

    if (showInternal) {
      row.push(
        { text: formatCurrency(item.purchasePrice) },
        { text: profitPercent.toFixed(1) + '%', alignment: 'center' }
      );
    }

    row.push({ text: formatCurrency(item.sellPrice) });

    if (showInternal) {
      row.push({ text: formatCurrency(profit), color: '#16a34a' });
    }

    row.push({ text: formatCurrency(item.sellPrice * item.quantity), bold: true });

    return row;
  });

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: 'Roboto', // Fallback to Roboto since Vazir might not work in browser
      fontSize: 10,
    },
    content: [
      // Header
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: DOC_TYPES[document.documentType] || document.documentType,
                style: 'header',
                alignment: 'right',
              },
              {
                text: `شماره سند: ${document.documentNumber}`,
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
              { text: 'تاریخ سند: ' + formatDate(document.issueDate), border: [true, true, true, true] },
              {
                text: document.dueDate ? 'سررسید: ' + formatDate(document.dueDate) : '',
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
          { text: 'اطلاعات مشتری', style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  { text: 'نام: ' + document.customer.name },
                  { text: 'کد: ' + document.customer.code },
                  { text: 'تلفن: ' + document.customer.phone },
                  { text: document.customer.company ? 'شرکت: ' + document.customer.company : '' },
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
          { text: 'ردیف‌های سند', style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              headerRows: 1,
              widths: showInternal
                ? ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto']
                : ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
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
          { text: 'محاسبات', style: 'sectionTitle', alignment: 'right' },
          {
            table: {
              widths: ['*', 'auto'],
              body: [
                ...(showInternal
                  ? [
                      [{ text: 'جمع خرید:', alignment: 'right' }, { text: formatCurrency(totalPurchase) }],
                      [
                        { text: 'جمع سود:', alignment: 'right', color: '#16a34a' },
                        { text: formatCurrency(totalProfit), color: '#16a34a' },
                      ],
                    ]
                  : []),
                [{ text: 'جمع کل:', alignment: 'right' }, { text: formatCurrency(document.totalAmount) }],
                ...(document.discountAmount > 0
                  ? [
                      [
                        { text: 'تخفیف:', alignment: 'right', color: '#dc2626' },
                        { text: formatCurrency(document.discountAmount), color: '#dc2626' },
                      ],
                    ]
                  : []),
                [
                  { text: 'مبلغ قابل پرداخت:', alignment: 'right', bold: true, fontSize: 12 },
                  { text: formatCurrency(document.finalAmount), bold: true, fontSize: 12 },
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
                { text: 'یادداشت‌ها', style: 'sectionTitle', alignment: 'right' },
                { text: document.notes, alignment: 'right' },
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
