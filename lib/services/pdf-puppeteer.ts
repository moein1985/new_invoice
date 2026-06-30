import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
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
  phone?: string | null;
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
  displaySettings?: Record<string, boolean> | null;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount) + ' ریال';
};

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('fa-IR');
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHTML(doc: Document): string {
  const ds = {
    showDate: true, showDueDate: true, showOperator: true,
    showCustomerName: true, showCustomerCode: true, showCustomerPhone: true, showCustomerCompany: true,
    showPurchasePrice: true, showProfit: true, showItemDescription: true, showNotes: true, showApprovals: true,
    ...(doc.displaySettings && typeof doc.displaySettings === 'object' ? doc.displaySettings : {}),
  };
  const showInternal = doc.documentType === 'TEMP_PROFORMA';
  const showPurchase = showInternal && ds.showPurchasePrice;
  const showProfit = showInternal && ds.showProfit;
  const docTypeLabel = DOC_TYPES[doc.documentType] || doc.documentType;

  const totalPurchase = doc.items.reduce(
    (sum, item) => sum + item.purchasePrice * item.quantity, 0
  );
  const totalProfit = doc.items.reduce(
    (sum, item) => sum + (item.sellPrice - item.purchasePrice) * item.quantity, 0
  );

  const itemRows = doc.items.map((item, index) => {
    const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
    const profitPercent = item.purchasePrice > 0
      ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
      : 0;

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td class="product-name">
          <strong>${escapeHtml(item.productName)}</strong>
          ${ds.showItemDescription && item.description ? `<br><span class="desc">${escapeHtml(item.description)}</span>` : ''}
        </td>
        <td class="center">${item.quantity}</td>
        <td class="center">${escapeHtml(item.unit)}</td>
        ${showPurchase ? `<td class="number">${formatCurrency(item.purchasePrice)}</td>` : ''}
        ${showPurchase ? `<td class="center">${profitPercent.toFixed(1)}%</td>` : ''}
        <td class="number">${formatCurrency(item.sellPrice)}</td>
        ${showProfit ? `<td class="number profit">${formatCurrency(profit)}</td>` : ''}
        <td class="number bold">${formatCurrency(item.sellPrice * item.quantity)}</td>
      </tr>`;
  }).join('');

  const colCount = 5 + (showPurchase ? 2 : 0) + (showProfit ? 1 : 0);

  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Vazirmatn';
    src: url('file:///app/public/fonts/Vazirmatn-Regular.ttf') format('truetype');
    font-weight: normal;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url('file:///app/public/fonts/Vazirmatn-Medium.ttf') format('truetype');
    font-weight: 500;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url('file:///app/public/fonts/Vazirmatn-Bold.ttf') format('truetype');
    font-weight: bold;
  }
  @page {
    size: A4;
    margin: 15mm 10mm 15mm 10mm;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Vazirmatn', 'Tahoma', sans-serif;
    font-size: 11px;
    direction: rtl;
    color: #1f2937;
  }
  .header {
    text-align: center;
    margin-bottom: 24px;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 16px;
  }
  .header h1 {
    font-size: 22px;
    color: #2563eb;
    margin-bottom: 6px;
  }
  .header .doc-number {
    font-size: 13px;
    color: #6b7280;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 20px;
    background: #f9fafb;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .info-grid .item {
    font-size: 11px;
  }
  .info-grid .label {
    font-weight: bold;
    color: #374151;
  }
  .section-title {
    font-size: 14px;
    font-weight: bold;
    margin: 16px 0 8px;
    color: #1f2937;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 4px;
  }
  .customer-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: #f9fafb;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    margin-bottom: 16px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  th {
    background: #f3f4f6;
    font-weight: bold;
    font-size: 10px;
    padding: 8px 6px;
    border: 1px solid #d1d5db;
    text-align: center;
    white-space: nowrap;
  }
  td {
    padding: 7px 6px;
    border: 1px solid #e5e7eb;
    font-size: 10px;
    vertical-align: middle;
  }
  td.center { text-align: center; }
  td.number { text-align: left; direction: ltr; white-space: nowrap; }
  td.product-name { text-align: right; min-width: 120px; }
  td.bold { font-weight: bold; }
  td.profit { color: #16a34a; }
  .desc { font-size: 9px; color: #6b7280; }
  tr:nth-child(even) { background: #f9fafb; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .totals-section { page-break-inside: avoid; }
  .notes { page-break-inside: avoid; }
  .footer { page-break-inside: avoid; }
  .totals {
    width: 50%;
    margin-right: auto;
    margin-left: 0;
  }
  .totals td {
    padding: 8px 10px;
  }
  .totals .label-cell {
    text-align: right;
    font-weight: bold;
  }
  .totals .value-cell {
    text-align: left;
    direction: ltr;
    white-space: nowrap;
  }
  .totals .final-row td {
    font-size: 13px;
    font-weight: bold;
    border-top: 2px solid #1f2937;
  }
  .totals .discount { color: #dc2626; }
  .totals .profit-text { color: #16a34a; }
  .notes {
    margin-top: 16px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    padding: 12px;
    border-radius: 6px;
  }
  .notes-title {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .footer {
    margin-top: 30px;
    text-align: center;
    font-size: 9px;
    color: #9ca3af;
    border-top: 1px solid #e5e7eb;
    padding-top: 10px;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(docTypeLabel)}</h1>
    <div class="doc-number">شماره سند: ${escapeHtml(doc.documentNumber)}</div>
  </div>

  <div class="info-grid">
    ${ds.showDate ? `<div class="item"><span class="label">تاریخ سند:</span> ${formatDate(doc.issueDate)}</div>` : '<div></div>'}
    ${ds.showDueDate && doc.dueDate ? `<div class="item"><span class="label">سررسید:</span> ${formatDate(doc.dueDate)}</div>` : '<div></div>'}
  </div>

  <div class="section-title">اطلاعات مشتری</div>
  <div class="customer-grid">
    ${ds.showCustomerName ? `<div class="item"><span class="label">نام:</span> ${escapeHtml(doc.customer.name)}</div>` : ''}
    ${ds.showCustomerCode ? `<div class="item"><span class="label">کد:</span> ${escapeHtml(doc.customer.code)}</div>` : ''}
    ${ds.showCustomerPhone ? `<div class="item"><span class="label">تلفن:</span> ${doc.customer.phone ? escapeHtml(doc.customer.phone) : '-'}</div>` : ''}
    ${ds.showCustomerCompany && doc.customer.company ? `<div class="item"><span class="label">شرکت:</span> ${escapeHtml(doc.customer.company)}</div>` : ''}
  </div>

  <div class="section-title">ردیف‌های سند</div>
  <table>
    <thead>
      <tr>
        <th>ردیف</th>
        <th>نام محصول</th>
        <th>تعداد</th>
        <th>واحد</th>
        ${showPurchase ? '<th>قیمت خرید</th>' : ''}
        ${showPurchase ? '<th>درصد سود</th>' : ''}
        <th>قیمت فروش</th>
        ${showProfit ? '<th>سود</th>' : ''}
        <th>مبلغ کل</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals-section">
  <div class="section-title">محاسبات</div>
  <table class="totals">
    <tbody>
      ${showPurchase ? `
        <tr>
          <td class="label-cell">جمع خرید:</td>
          <td class="value-cell">${formatCurrency(totalPurchase)}</td>
        </tr>
      ` : ''}
      ${showProfit ? `
        <tr>
          <td class="label-cell profit-text">جمع سود:</td>
          <td class="value-cell profit-text">${formatCurrency(totalProfit)}</td>
        </tr>
      ` : ''}
      <tr>
        <td class="label-cell">جمع کل:</td>
        <td class="value-cell">${formatCurrency(doc.totalAmount)}</td>
      </tr>
      ${doc.discountAmount > 0 ? `
        <tr>
          <td class="label-cell discount">تخفیف:</td>
          <td class="value-cell discount">${formatCurrency(doc.discountAmount)}</td>
        </tr>
      ` : ''}
      <tr class="final-row">
        <td class="label-cell">مبلغ قابل پرداخت:</td>
        <td class="value-cell">${formatCurrency(doc.finalAmount)}</td>
      </tr>
    </tbody>
  </table>
  </div>

  ${ds.showNotes && doc.notes ? `
    <div class="notes">
      <div class="notes-title">یادداشت‌ها</div>
      <div>${escapeHtml(doc.notes)}</div>
    </div>
  ` : ''}

  ${ds.showOperator ? `
  <div class="footer">
    تهیه‌کننده: ${escapeHtml(doc.createdBy.fullName)}
  </div>
  ` : ''}
</body>
</html>`;
}

export async function generatePDFBuffer(doc: Document): Promise<Buffer> {
  const html = buildHTML(doc);

  const tmpDir = '/tmp/pdf-gen';
  mkdirSync(tmpDir, { recursive: true });

  const id = randomUUID();
  const htmlPath = join(tmpDir, `${id}.html`);
  const pdfPath = join(tmpDir, `${id}.pdf`);

  try {
    writeFileSync(htmlPath, html, 'utf-8');

    const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

    execFileSync(chromiumPath, [
      '--headless',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--run-all-compositor-stages-before-draw',
      '--print-to-pdf-no-header',
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ], {
      timeout: 30000,
    });

    return readFileSync(pdfPath);
  } finally {
    try { unlinkSync(htmlPath); } catch {}
    try { unlinkSync(pdfPath); } catch {}
  }
}
