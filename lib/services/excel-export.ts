import ExcelJS from 'exceljs';

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
  return new Intl.NumberFormat('fa-IR').format(amount);
};

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('fa-IR');
};

export const generateDocumentExcel = async (document: Document) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('سند');

  const showInternal = document.documentType === 'TEMP_PROFORMA';

  // Set RTL
  worksheet.views = [{ rightToLeft: true }];

  // Header - Merged cells
  worksheet.mergeCells('A1:F1');
  const headerCell = worksheet.getCell('A1');
  headerCell.value = DOC_TYPES[document.documentType] || document.documentType;
  headerCell.font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
  headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
  headerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  worksheet.getRow(1).height = 30;

  // Document Number
  worksheet.mergeCells('A2:F2');
  const docNumCell = worksheet.getCell('A2');
  docNumCell.value = `شماره سند: ${document.documentNumber}`;
  docNumCell.font = { size: 12, bold: true };
  docNumCell.alignment = { horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // Empty row
  worksheet.addRow([]);

  // Document Info
  worksheet.addRow(['تاریخ سند:', formatDate(document.issueDate), '', 'سررسید:', document.dueDate ? formatDate(document.dueDate) : '-']);
  const docInfoRow = worksheet.lastRow;
  if (docInfoRow) {
    docInfoRow.font = { bold: true };
    docInfoRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  // Empty row
  worksheet.addRow([]);

  // Customer Info
  const custRow1 = worksheet.addRow(['اطلاعات مشتری']);
  worksheet.mergeCells(`A${custRow1.number}:F${custRow1.number}`);
  custRow1.font = { size: 14, bold: true };
  custRow1.alignment = { horizontal: 'center' };
  custRow1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBFDBFE' },
  };

  worksheet.addRow(['نام:', document.customer.name, '', 'کد:', document.customer.code]);
  worksheet.addRow(['تلفن:', document.customer.phone, '', 'شرکت:', document.customer.company || '-']);
  if (document.customer.address) {
    const addrRow = worksheet.addRow(['آدرس:', document.customer.address]);
    worksheet.mergeCells(`B${addrRow.number}:F${addrRow.number}`);
  }

  // Empty row
  worksheet.addRow([]);

  // Items Table Header
  const itemsHeaderRow = worksheet.addRow(['ردیف‌های سند']);
  worksheet.mergeCells(`A${itemsHeaderRow.number}:${showInternal ? 'I' : 'F'}${itemsHeaderRow.number}`);
  itemsHeaderRow.font = { size: 14, bold: true };
  itemsHeaderRow.alignment = { horizontal: 'center' };
  itemsHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBFDBFE' },
  };

  // Table Headers
  const headers = ['ردیف', 'نام محصول', 'تعداد', 'واحد'];
  if (showInternal) {
    headers.push('قیمت خرید', 'درصد سود');
  }
  headers.push('قیمت فروش');
  if (showInternal) {
    headers.push('سود');
  }
  headers.push('مبلغ کل');

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' },
    };
  });

  // Table Data
  document.items.forEach((item, index) => {
    const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
    const profitPercent =
      item.purchasePrice > 0
        ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
        : 0;

    const rowData: any[] = [
      index + 1,
      item.productName + (item.description ? `\n${item.description}` : ''),
      item.quantity,
      item.unit,
    ];

    if (showInternal) {
      rowData.push(formatCurrency(item.purchasePrice), profitPercent.toFixed(1) + '%');
    }

    rowData.push(formatCurrency(item.sellPrice));

    if (showInternal) {
      rowData.push(formatCurrency(profit));
    }

    rowData.push(formatCurrency(item.sellPrice * item.quantity));

    const dataRow = worksheet.addRow(rowData);
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (colNumber === 1 || colNumber === 3 || colNumber === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (showInternal && colNumber === 8) {
        cell.font = { color: { argb: 'FF16A34A' } };
      }
      if (colNumber === headers.length) {
        cell.font = { bold: true };
      }
    });
  });

  // Empty row
  worksheet.addRow([]);

  // Totals
  const totalPurchase = document.items.reduce(
    (sum, item) => sum + item.purchasePrice * item.quantity,
    0
  );
  const totalProfit = document.items.reduce(
    (sum, item) => sum + (item.sellPrice - item.purchasePrice) * item.quantity,
    0
  );

  const totalsHeaderRow = worksheet.addRow(['محاسبات']);
  worksheet.mergeCells(`A${totalsHeaderRow.number}:${showInternal ? 'I' : 'F'}${totalsHeaderRow.number}`);
  totalsHeaderRow.font = { size: 14, bold: true };
  totalsHeaderRow.alignment = { horizontal: 'center' };
  totalsHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBFDBFE' },
  };

  if (showInternal) {
    const purchaseRow = worksheet.addRow(['جمع خرید:', formatCurrency(totalPurchase)]);
    worksheet.mergeCells(`C${purchaseRow.number}:${showInternal ? 'I' : 'F'}${purchaseRow.number}`);
    purchaseRow.font = { bold: true };

    const profitRow = worksheet.addRow(['جمع سود:', formatCurrency(totalProfit)]);
    worksheet.mergeCells(`C${profitRow.number}:${showInternal ? 'I' : 'F'}${profitRow.number}`);
    profitRow.font = { bold: true, color: { argb: 'FF16A34A' } };
  }

  const totalRow = worksheet.addRow(['جمع کل:', formatCurrency(document.totalAmount)]);
  worksheet.mergeCells(`C${totalRow.number}:${showInternal ? 'I' : 'F'}${totalRow.number}`);
  totalRow.font = { bold: true };

  if (document.discountAmount > 0) {
    const discountRow = worksheet.addRow(['تخفیف:', formatCurrency(document.discountAmount)]);
    worksheet.mergeCells(`C${discountRow.number}:${showInternal ? 'I' : 'F'}${discountRow.number}`);
    discountRow.font = { bold: true, color: { argb: 'FFDC2626' } };
  }

  const finalRow = worksheet.addRow(['مبلغ قابل پرداخت:', formatCurrency(document.finalAmount)]);
  worksheet.mergeCells(`C${finalRow.number}:${showInternal ? 'I' : 'F'}${finalRow.number}`);
  finalRow.font = { size: 12, bold: true, color: { argb: 'FF2563EB' } };
  finalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDBEAFE' },
  };

  // Set column widths
  worksheet.columns = [
    { width: 8 },  // ردیف
    { width: 30 }, // نام محصول
    { width: 10 }, // تعداد
    { width: 10 }, // واحد
    ...(showInternal ? [{ width: 15 }, { width: 12 }] : []), // قیمت خرید، درصد سود
    { width: 15 }, // قیمت فروش
    ...(showInternal ? [{ width: 15 }] : []), // سود
    { width: 18 }, // مبلغ کل
  ];

  // Notes
  if (document.notes) {
    worksheet.addRow([]);
    const notesHeaderRow = worksheet.addRow(['یادداشت‌ها']);
    worksheet.mergeCells(`A${notesHeaderRow.number}:${showInternal ? 'I' : 'F'}${notesHeaderRow.number}`);
    notesHeaderRow.font = { size: 12, bold: true };
    notesHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };

    const notesRow = worksheet.addRow([document.notes]);
    worksheet.mergeCells(`A${notesRow.number}:${showInternal ? 'I' : 'F'}${notesRow.number}`);
    notesRow.alignment = { wrapText: true };
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = `${document.documentNumber}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

// Export customers list to Excel
interface CustomerForExport {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: Date;
}

export const exportCustomersToExcel = async (
  customers: CustomerForExport[],
  filename: string = 'customers.xlsx'
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('مشتریان', {
    views: [{ rightToLeft: true }],
  });

  // Add header
  const headerRow = worksheet.addRow([
    'کد مشتری',
    'نام مشتری',
    'تلفن',
    'ایمیل',
    'آدرس',
    'تاریخ ایجاد',
  ]);

  // Style header
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Add data rows
  customers.forEach((customer) => {
    const row = worksheet.addRow([
      customer.code,
      customer.name,
      customer.phone || '-',
      customer.email || '-',
      customer.address || '-',
      new Date(customer.createdAt).toLocaleDateString('fa-IR'),
    ]);

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
  });

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // کد مشتری
    { width: 30 }, // نام مشتری
    { width: 15 }, // تلفن
    { width: 25 }, // ایمیل
    { width: 50 }, // آدرس
    { width: 15 }, // تاریخ ایجاد
  ];

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

// Export documents list to Excel
interface DocumentForExport {
  id: string;
  type: string;
  approvalStatus: string;
  approvalOrder: number | null;
  customerName: string;
  totalAmount: string;
  createdAt: Date;
}

const APPROVAL_STATUS: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

export const exportDocumentsToExcel = async (
  documents: DocumentForExport[],
  filename: string = 'documents.xlsx'
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('اسناد', {
    views: [{ rightToLeft: true }],
  });

  // Add header
  const headerRow = worksheet.addRow([
    'شماره سند',
    'نوع سند',
    'نام مشتری',
    'مبلغ کل (ریال)',
    'وضعیت تایید',
    'تاریخ ایجاد',
  ]);

  // Style header
  headerRow.font = { bold: true, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Add data rows
  documents.forEach((doc) => {
    const row = worksheet.addRow([
      doc.approvalOrder || '-',
      DOC_TYPES[doc.type] || doc.type,
      doc.customerName,
      doc.totalAmount,
      APPROVAL_STATUS[doc.approvalStatus] || doc.approvalStatus,
      new Date(doc.createdAt).toLocaleDateString('fa-IR'),
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };

      // Color code for approval status
      if (colNumber === 5) {
        if (doc.approvalStatus === 'APPROVED') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD1FAE5' },
          };
        } else if (doc.approvalStatus === 'REJECTED') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEE2E2' },
          };
        } else if (doc.approvalStatus === 'PENDING') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' },
          };
        }
      }
    });
  });

  // Set column widths
  worksheet.columns = [
    { width: 15 }, // شماره سند
    { width: 20 }, // نوع سند
    { width: 30 }, // نام مشتری
    { width: 20 }, // مبلغ کل
    { width: 15 }, // وضعیت تایید
    { width: 15 }, // تاریخ ایجاد
  ];

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};
