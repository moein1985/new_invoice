import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

export const generateDocumentPDFFromHTML = async (doc: Document) => {
  const showInternal = doc.documentType === 'TEMP_PROFORMA';

  // Calculate totals
  const totalPurchase = doc.items.reduce(
    (sum, item) => sum + item.purchasePrice * item.quantity,
    0
  );
  const totalProfit = doc.items.reduce(
    (sum, item) => sum + (item.sellPrice - item.purchasePrice) * item.quantity,
    0
  );

  // Create a temporary container
  const container = globalThis.document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.padding = '20mm';
  container.style.backgroundColor = '#ffffff';
  container.style.fontFamily = 'Vazir, Tahoma, sans-serif';
  container.style.direction = 'rtl';
  container.style.color = '#000000';

  // Build HTML content
  container.innerHTML = `
    <div style="max-width: 170mm;">
      <!-- Header -->
      <div style="margin-bottom: 20px; text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px;">
        <h1 style="font-size: 28px; color: #2563eb; margin: 0 0 10px 0;">${DOC_TYPES[doc.documentType]}</h1>
        <p style="font-size: 16px; margin: 0;">شماره سند: <strong>${doc.documentNumber}</strong></p>
      </div>

      <!-- Document Info -->
      <div style="margin-bottom: 20px; background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
        <h3 style="font-size: 18px; margin: 0 0 10px 0;">اطلاعات سند</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div><strong>تاریخ سند:</strong> ${formatDate(doc.issueDate)}</div>
          <div><strong>تاریخ ایجاد:</strong> ${formatDate(doc.issueDate)}</div>
        </div>
      </div>

      <!-- Customer Info -->
      <div style="margin-bottom: 20px; background-color: #dbeafe; padding: 15px; border-radius: 8px;">
        <h3 style="font-size: 18px; margin: 0 0 10px 0;">اطلاعات مشتری</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div><strong>نام:</strong> ${doc.customer.name}</div>
          <div><strong>کد:</strong> ${doc.customer.code}</div>
          <div><strong>تلفن:</strong> ${doc.customer.phone}</div>
          ${doc.customer.company ? `<div><strong>شرکت:</strong> ${doc.customer.company}</div>` : ''}
        </div>
        ${doc.customer.address ? `<div style="margin-top: 10px;"><strong>آدرس:</strong> ${doc.customer.address}</div>` : ''}
      </div>

      <!-- Items Table -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 18px; margin: 0 0 10px 0;">ردیف‌های سند</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead style="background-color: #f3f4f6;">
            <tr>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">ردیف</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">نام محصول</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">تعداد</th>
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">واحد</th>
              ${showInternal ? '<th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">قیمت خرید</th>' : ''}
              ${showInternal ? '<th style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">درصد سود</th>' : ''}
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">قیمت فروش</th>
              ${showInternal ? '<th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">سود</th>' : ''}
              <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">مبلغ کل</th>
            </tr>
          </thead>
          <tbody>
            ${doc.items
              .map((item, index) => {
                const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
                const profitPercent =
                  item.purchasePrice > 0
                    ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
                    : 0;

                return `
                  <tr>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${index + 1}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">
                      <div style="font-weight: bold;">${item.productName}</div>
                      ${item.description ? `<div style="font-size: 9px; color: #666;">${item.description}</div>` : ''}
                    </td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${item.quantity}</td>
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${item.unit}</td>
                    ${showInternal ? `<td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${formatCurrency(item.purchasePrice)}</td>` : ''}
                    ${showInternal ? `<td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${profitPercent.toFixed(1)}%</td>` : ''}
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${formatCurrency(item.sellPrice)}</td>
                    ${showInternal ? `<td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; color: #16a34a; font-weight: bold;">${formatCurrency(profit)}</td>` : ''}
                    <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(item.sellPrice * item.quantity)}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="margin-bottom: 20px; background-color: #dbeafe; padding: 15px; border-radius: 8px;">
        <h3 style="font-size: 18px; margin: 0 0 10px 0;">محاسبات</h3>
        ${
          showInternal
            ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #93c5fd;">
            <span><strong>جمع خرید:</strong></span>
            <span><strong>${formatCurrency(totalPurchase)}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #93c5fd; color: #16a34a;">
            <span><strong>جمع سود:</strong></span>
            <span><strong>${formatCurrency(totalProfit)}</strong></span>
          </div>
        `
            : ''
        }
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #93c5fd;">
          <span><strong>جمع کل:</strong></span>
          <span><strong>${formatCurrency(doc.totalAmount)}</strong></span>
        </div>
        ${
          doc.discountAmount > 0
            ? `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #93c5fd; color: #dc2626;">
            <span><strong>تخفیف:</strong></span>
            <span><strong>${formatCurrency(doc.discountAmount)}</strong></span>
          </div>
        `
            : ''
        }
        <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; color: #2563eb; border-top: 2px solid #2563eb; margin-top: 8px;">
          <span><strong>مبلغ قابل پرداخت:</strong></span>
          <span><strong>${formatCurrency(doc.finalAmount)}</strong></span>
        </div>
      </div>

      ${
        doc.notes
          ? `
        <div style="margin-bottom: 20px; background-color: #fef3c7; padding: 15px; border-radius: 8px;">
          <h3 style="font-size: 18px; margin: 0 0 10px 0;">یادداشت‌ها</h3>
          <p style="white-space: pre-wrap; margin: 0;">${doc.notes}</p>
        </div>
      `
          : ''
      }
    </div>
  `;

  globalThis.document.body.appendChild(container);

  try {
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${doc.documentNumber}.pdf`);
  } finally {
    // Clean up
    globalThis.document.body.removeChild(container);
  }
};
