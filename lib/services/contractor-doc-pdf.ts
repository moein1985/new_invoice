import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface ContractorDocItem {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ContractorDocAttachment {
  fileName: string;
  filePath: string;
}

interface ContractorDocData {
  docNumber: string;
  type: string;
  docDate: string | Date;
  totalAmount: number;
  notes?: string | null;
  approvalStatus: string;
  rejectionReason?: string | null;
  description: string;
  direction?: string | null;
  items: ContractorDocItem[];
  attachments?: ContractorDocAttachment[];
  project: {
    name: string;
    code: string;
    employerName?: string | null;
    address?: string | null;
  };
  createdBy: {
    fullName: string;
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount);
};

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('fa-IR');
};

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار تایید',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

const typeLabels: Record<string, string> = {
  RECEIPT: 'رسید',
  EXPENSE: 'هزینه',
  GENERAL: 'سایر',
};

const directionLabels: Record<string, string> = {
  RECEIVED: 'دریافتی',
  DELIVERED: 'تحویلی',
};

function buildContractorDocHTML(doc: ContractorDocData): string {
  const grandTotal = doc.items.reduce((sum, i) => sum + i.totalPrice, 0);
  const hasPrices = doc.items.some(i => i.unitPrice > 0);

  const rows = doc.items.map((item, index) => `
    <tr>
      <td style="text-align:center;">${index + 1}</td>
      <td>${escapeHtml(item.description)}</td>
      <td style="text-align:center;">${escapeHtml(item.unit)}</td>
      <td style="text-align:center;">${item.quantity}</td>
      ${hasPrices ? `<td style="text-align:center;">${formatCurrency(item.unitPrice)}</td>` : ''}
      ${hasPrices ? `<td style="text-align:center;">${formatCurrency(item.totalPrice)}</td>` : ''}
    </tr>`).join('');

  const attachmentList = (doc.attachments && doc.attachments.length > 0)
    ? `<div style="margin-top:20px;">
         <h3 style="font-size:14px;margin-bottom:8px;">پیوست‌ها</h3>
         <ul style="list-style:none;padding:0;font-size:12px;">
           ${doc.attachments.map(a => `<li>• ${escapeHtml(a.fileName)}</li>`).join('')}
         </ul>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
  h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
  h2 { font-size: 14px; margin-top: 20px; }
  .info-box { border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px; }
  .info-row { display: flex; justify-content: space-between; margin: 4px 0; }
  .info-label { font-weight: bold; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
  th { background: #f5f5f5; font-weight: bold; }
  .total-row { font-weight: bold; background: #f9f9f9; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: bold; }
  .status-PENDING { background: #fef3c7; color: #92400e; }
  .status-APPROVED { background: #d1fae5; color: #065f46; }
  .status-REJECTED { background: #fee2e2; color: #991b1b; }
  .rejection-box { border: 1px solid #fca5a5; background: #fef2f2; padding: 10px; margin: 10px 0; border-radius: 4px; }
  .sig-section { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-box { border: 1px solid #ddd; padding: 10px; text-align: center; width: 200px; height: 80px; }
</style>
</head>
<body>

<h1>سند پیمانکار - ${escapeHtml(typeLabels[doc.type] || doc.type)}</h1>
<p style="text-align:center;font-size:12px;color:#666;">شماره: ${escapeHtml(doc.docNumber)}</p>

<div class="info-box">
  <div class="info-row"><span class="info-label">پروژه:</span> <span>${escapeHtml(doc.project.name)} (${escapeHtml(doc.project.code)})</span></div>
  ${doc.project.employerName ? `<div class="info-row"><span class="info-label">کارفرما:</span> <span>${escapeHtml(doc.project.employerName)}</span></div>` : ''}
  <div class="info-row"><span class="info-label">تاریخ سند:</span> <span>${formatDate(doc.docDate)}</span></div>
  <div class="info-row"><span class="info-label">پیمانکار:</span> <span>${escapeHtml(doc.createdBy.fullName)}</span></div>
  ${doc.direction ? `<div class="info-row"><span class="info-label">جهت:</span> <span>${directionLabels[doc.direction] || doc.direction}</span></div>` : ''}
  <div class="info-row"><span class="info-label">وضعیت:</span> <span class="status-badge status-${doc.approvalStatus}">${statusLabels[doc.approvalStatus] || doc.approvalStatus}</span></div>
</div>

${doc.description ? `<div style="margin:10px 0;"><strong>شرح:</strong> ${escapeHtml(doc.description)}</div>` : ''}

${doc.approvalStatus === 'REJECTED' && doc.rejectionReason ? `<div class="rejection-box"><strong>دلیل رد:</strong> ${escapeHtml(doc.rejectionReason)}</div>` : ''}

<table>
  <thead>
    <tr>
      <th style="width:40px;">ردیف</th>
      <th>شرح</th>
      <th style="width:60px;">واحد</th>
      <th style="width:60px;">مقدار</th>
      ${hasPrices ? '<th style="width:80px;">قیمت واحد</th>' : ''}
      ${hasPrices ? '<th style="width:80px;">قیمت کل</th>' : ''}
    </tr>
  </thead>
  <tbody>
    ${rows}
    ${hasPrices ? `<tr class="total-row"><td colspan="5" style="text-align:left;">جمع کل:</td><td style="text-align:center;">${formatCurrency(grandTotal)}</td></tr>` : ''}
  </tbody>
</table>

${doc.notes ? `<div style="margin-top:15px;"><strong>توضیحات:</strong> ${escapeHtml(doc.notes)}</div>` : ''}

${attachmentList}

<div class="sig-section">
  <div class="sig-box">پیمانکار<br><br><br></div>
  <div class="sig-box">ناظر<br><br><br></div>
  <div class="sig-box">مدیر پروژه<br><br><br></div>
</div>

</body>
</html>`;
}

export async function generateContractorDocPDF(doc: ContractorDocData): Promise<Buffer> {
  const html = buildContractorDocHTML(doc);

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
