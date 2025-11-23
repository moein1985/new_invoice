/**
 * PDF Export با پشتیبانی فارسی
 * استفاده از jsPDF برای پشتیبانی بهتر از فونت‌های فارسی
 */

import jsPDF from 'jspdf';

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
  projectName?: string | null;
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

export const generateDocumentPDFV2 = (document: Document) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const showInternal = document.documentType === 'TEMP_PROFORMA';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  let y = margin;

  // Helper: Add text (RTL support)
  const addText = (text: string, x: number, yPos: number, options: any = {}) => {
    const { align = 'right', size = 10, style = 'normal', color = [0, 0, 0] } = options;
    
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    
    if (style === 'bold') {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    
    doc.text(text, x, yPos, { align });
  };

  // Header - نوع سند
  doc.setFillColor(59, 130, 246); // blue-600
  doc.rect(margin, y, contentWidth, 15, 'F');
  addText(
    DOC_TYPES[document.documentType] || document.documentType,
    pageWidth / 2,
    y + 10,
    { size: 18, style: 'bold', color: [255, 255, 255], align: 'center' }
  );
  
  y += 20;

  // شماره سند
  addText(`شماره سند: ${document.documentNumber}`, pageWidth - margin, y, { size: 12, style: 'bold' });
  y += 10;

  // خط جداکننده
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // اطلاعات مشتری و سند
  doc.setFillColor(243, 244, 246); // gray-100
  doc.rect(margin, y, contentWidth, 30, 'F');
  
  addText(`مشتری: ${document.customer.name}`, pageWidth - margin - 5, y + 7, { style: 'bold' });
  addText(`کد مشتری: ${document.customer.code}`, pageWidth - margin - 5, y + 14);
  addText(`تلفن: ${document.customer.phone}`, pageWidth - margin - 5, y + 21);
  
  addText(`تاریخ: ${formatDate(document.issueDate)}`, margin + 5, y + 7, { align: 'left' });
  if (document.dueDate) {
    addText(`سررسید: ${formatDate(document.dueDate)}`, margin + 5, y + 14, { align: 'left' });
  }
  if (document.projectName) {
    addText(`پروژه: ${document.projectName}`, margin + 5, y + 21, { align: 'left' });
  }
  
  y += 35;

  // جدول اقلام - Header
  doc.setFillColor(229, 231, 235); // gray-200
  const colWidths = showInternal
    ? [10, 50, 20, 15, 25, 15, 25]
    : [15, 60, 25, 20, 40];
  
  let x = margin;
  const headerY = y;
  const rowHeight = 8;

  // رسم هدر جدول
  doc.rect(margin, y, contentWidth, rowHeight, 'F');
  
  if (showInternal) {
    addText('ردیف', x + 5, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[0];
    addText('نام محصول', x + 25, y + 5, { size: 9, style: 'bold' });
    x += colWidths[1];
    addText('تعداد', x + 10, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[2];
    addText('واحد', x + 7, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[3];
    addText('قیمت خرید', x + 12, y + 5, { size: 9, style: 'bold' });
    x += colWidths[4];
    addText('سود%', x + 7, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[5];
    addText('قیمت فروش', x + 12, y + 5, { size: 9, style: 'bold' });
  } else {
    addText('ردیف', x + 7, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[0];
    addText('نام محصول', x + 30, y + 5, { size: 9, style: 'bold' });
    x += colWidths[1];
    addText('تعداد', x + 12, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[2];
    addText('واحد', x + 10, y + 5, { size: 9, style: 'bold', align: 'center' });
    x += colWidths[3];
    addText('قیمت واحد', x + 20, y + 5, { size: 9, style: 'bold' });
  }
  
  y += rowHeight;

  // اقلام
  doc.setDrawColor(220, 220, 220);
  document.items.forEach((item, index) => {
    // Check for page break
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    x = margin;
    
    // Border
    doc.rect(margin, y, contentWidth, rowHeight);
    
    if (showInternal) {
      addText((index + 1).toString(), x + 5, y + 5, { size: 8, align: 'center' });
      x += colWidths[0];
      addText(item.productName, x + 25, y + 5, { size: 8 });
      x += colWidths[1];
      addText(item.quantity.toString(), x + 10, y + 5, { size: 8, align: 'center' });
      x += colWidths[2];
      addText(item.unit, x + 7, y + 5, { size: 8, align: 'center' });
      x += colWidths[3];
      addText(formatCurrency(item.purchasePrice), x + 12, y + 5, { size: 8 });
      x += colWidths[4];
      addText(`${item.profitPercentage || 0}%`, x + 7, y + 5, { size: 8, align: 'center' });
      x += colWidths[5];
      addText(formatCurrency(item.sellPrice), x + 12, y + 5, { size: 8 });
    } else {
      addText((index + 1).toString(), x + 7, y + 5, { size: 8, align: 'center' });
      x += colWidths[0];
      addText(item.productName, x + 30, y + 5, { size: 8 });
      x += colWidths[1];
      addText(item.quantity.toString(), x + 12, y + 5, { size: 8, align: 'center' });
      x += colWidths[2];
      addText(item.unit, x + 10, y + 5, { size: 8, align: 'center' });
      x += colWidths[3];
      addText(formatCurrency(item.sellPrice), x + 20, y + 5, { size: 8 });
    }
    
    y += rowHeight;
  });

  y += 5;

  // مجموع
  doc.setFillColor(239, 246, 255); // blue-50
  doc.rect(margin, y, contentWidth, 25, 'F');
  
  addText(`جمع کل: ${formatCurrency(document.totalAmount)}`, pageWidth - margin - 5, y + 8, {
    size: 11,
    style: 'bold',
  });
  
  if (document.discountAmount > 0) {
    addText(`تخفیف: ${formatCurrency(document.discountAmount)}`, pageWidth - margin - 5, y + 15, {
      size: 10,
    });
  }
  
  addText(`مبلغ نهایی: ${formatCurrency(document.finalAmount)}`, pageWidth - margin - 5, y + 22, {
    size: 12,
    style: 'bold',
    color: [37, 99, 235], // blue-600
  });

  y += 30;

  // یادداشت‌ها
  if (document.notes) {
    addText('توضیحات:', pageWidth - margin, y, { style: 'bold' });
    y += 7;
    
    // Split long text
    const splitNotes = doc.splitTextToSize(document.notes, contentWidth - 10);
    splitNotes.forEach((line: string) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = margin;
      }
      addText(line, pageWidth - margin - 5, y, { size: 9 });
      y += 5;
    });
  }

  // Footer
  const footerY = pageHeight - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  addText(`ایجاد شده توسط: ${document.createdBy.fullName}`, pageWidth - margin, footerY + 7, {
    size: 8,
    color: [107, 114, 128], // gray-500
  });
  addText(`تاریخ چاپ: ${formatDate(new Date())}`, margin, footerY + 7, {
    size: 8,
    color: [107, 114, 128],
    align: 'left',
  });

  // Save
  const filename = `${DOC_TYPES[document.documentType]}_${document.documentNumber}.pdf`;
  doc.save(filename);
};
