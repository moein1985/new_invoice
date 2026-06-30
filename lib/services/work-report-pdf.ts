import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface WorkReportItem {
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface WorkReportData {
  reportNumber: string;
  reportDate: string | Date;
  totalAmount: number;
  notes?: string | null;
  approvalStatus: string;
  items: WorkReportItem[];
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

function buildWorkReportHTML(report: WorkReportData): string {
  const grandTotal = report.items.reduce((sum, i) => sum + i.totalPrice, 0);
  const hasPrices = report.items.some(i => i.unitPrice > 0);

  const rows = report.items.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="center">${escapeHtml(item.unit)}</td>
      <td class="center">${item.quantity}</td>
      ${hasPrices ? `<td class="number">${item.unitPrice > 0 ? formatCurrency(item.unitPrice) : '—'}</td>` : ''}
      ${hasPrices ? `<td class="number">${item.totalPrice > 0 ? formatCurrency(item.totalPrice) : '—'}</td>` : ''}
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Vazirmatn', 'B Nazanin', 'Tahoma', sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #333;
    direction: rtl;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header h1 {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .header .report-number {
    font-family: monospace;
    color: #666;
    font-size: 13px;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
    border: 1px solid #ddd;
    padding: 12px;
    border-radius: 4px;
    background: #fafafa;
  }
  .info-grid .item {
    font-size: 12px;
  }
  .info-grid .label {
    font-weight: bold;
    color: #555;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 6px 8px;
    text-align: right;
    font-size: 11px;
  }
  th {
    background: #f0f0f0;
    font-weight: bold;
    font-size: 11px;
    color: #444;
  }
  td.center, th.center { text-align: center; }
  td.number { text-align: left; font-family: monospace; direction: ltr; }
  .total-row { background: #f0f0f0; font-weight: bold; }
  .total-row td { font-size: 12px; }
  .notes {
    border: 1px solid #ddd;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 16px;
    background: #fafafa;
  }
  .notes .label { font-weight: bold; margin-bottom: 4px; }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-top: 40px;
  }
  .sig-box {
    text-align: center;
    border-top: 1px solid #999;
    padding-top: 8px;
    font-size: 11px;
    color: #555;
  }
  .status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: bold;
  }
  .status-PENDING { background: #fef3c7; color: #92400e; }
  .status-APPROVED { background: #d1fae5; color: #065f46; }
  .status-REJECTED { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>

<div class="header">
  <h1>گزارش کار</h1>
  <div class="report-number">${escapeHtml(report.reportNumber)}</div>
</div>

<div class="info-grid">
  <div class="item"><span class="label">پروژه:</span> ${escapeHtml(report.project.name)} (${escapeHtml(report.project.code)})</div>
  <div class="item"><span class="label">تاریخ:</span> ${formatDate(report.reportDate)}</div>
  ${report.project.employerName ? `<div class="item"><span class="label">کارفرما:</span> ${escapeHtml(report.project.employerName)}</div>` : '<div></div>'}
  <div class="item"><span class="label">ثبت‌کننده:</span> ${escapeHtml(report.createdBy.fullName)}</div>
  ${report.project.address ? `<div class="item"><span class="label">آدرس:</span> ${escapeHtml(report.project.address)}</div>` : '<div></div>'}
  <div class="item"><span class="label">وضعیت:</span> <span class="status-badge status-${report.approvalStatus}">${statusLabels[report.approvalStatus] || report.approvalStatus}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:40px">ردیف</th>
      <th>شرح عملیات</th>
      <th class="center" style="width:60px">واحد</th>
      <th class="center" style="width:60px">مقدار</th>
      ${hasPrices ? '<th class="center" style="width:90px">فی (ریال)</th>' : ''}
      ${hasPrices ? '<th class="center" style="width:100px">مبلغ کل (ریال)</th>' : ''}
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
  ${hasPrices && grandTotal > 0 ? `
  <tfoot>
    <tr class="total-row">
      <td colspan="${hasPrices ? 5 : 3}" style="text-align:left;">جمع کل:</td>
      <td class="number">${formatCurrency(grandTotal)} ریال</td>
    </tr>
  </tfoot>
  ` : ''}
</table>

${report.notes ? `
<div class="notes">
  <div class="label">توضیحات:</div>
  <div>${escapeHtml(report.notes)}</div>
</div>
` : ''}

<div class="signatures">
  <div class="sig-box">پیمانکار<br><br><br></div>
  <div class="sig-box">ناظر<br><br><br></div>
  <div class="sig-box">مدیر پروژه<br><br><br></div>
</div>

</body>
</html>`;
}

export async function generateWorkReportPDF(report: WorkReportData): Promise<Buffer> {
  const html = buildWorkReportHTML(report);

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
