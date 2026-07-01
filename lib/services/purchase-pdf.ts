import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface PurchaseItemData {
  productName: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimatedPrice?: number | null;
}

interface InquiryItemData {
  unitPrice: number;
  totalPrice: number;
  availability: string;
  deliveryDays?: number | null;
  notes?: string | null;
  purchaseItem: {
    productName: string;
    quantity: number;
    unit: string;
  };
}

interface ApprovedInquiryData {
  supplierName: string;
  totalPrice: number;
  paymentMethod?: string | null;
  paymentDays?: number | null;
  notes?: string | null;
  items: InquiryItemData[];
}

interface PurchaseRequestData {
  requestNumber: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  rejectionReason?: string | null;
  deadline?: Date | string | null;
  createdAt: Date | string;
  project?: { name: string } | null;
  createdBy: { fullName: string };
  assignedTo?: { fullName: string } | null;
  items: PurchaseItemData[];
  approvedInquiry?: ApprovedInquiryData | null;
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
  DRAFT: 'پیش‌نویس',
  PENDING_INQUIRY: 'در انتظار استعلام',
  INQUIRED: 'استعلام‌شده',
  APPROVED: 'تایید‌شده',
  REJECTED: 'رد‌شده',
  PURCHASED: 'خریداری‌شده',
};

const priorityLabels: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

const availabilityLabels: Record<string, string> = {
  AVAILABLE: 'موجود',
  UNAVAILABLE: 'ناموجود',
  PARTIAL: 'موجودی محدود',
};

function buildPurchaseHTML(req: PurchaseRequestData): string {
  const itemRows = req.items.map((item, index) => `
    <tr>
      <td style="text-align:center">${index + 1}</td>
      <td>${escapeHtml(item.productName)}</td>
      <td>${item.description ? escapeHtml(item.description) : '—'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${escapeHtml(item.unit)}</td>
      <td style="text-align:left">${item.estimatedPrice ? formatCurrency(item.estimatedPrice) : '—'}</td>
    </tr>`).join('');

  let approvedInquirySection = '';
  if (req.approvedInquiry) {
    const inq = req.approvedInquiry;
    const inqItemRows = inq.items.map((item, index) => `
      <tr>
        <td style="text-align:center">${index + 1}</td>
        <td>${escapeHtml(item.purchaseItem.productName)}</td>
        <td style="text-align:center">${item.purchaseItem.quantity}</td>
        <td style="text-align:left">${formatCurrency(item.unitPrice)}</td>
        <td style="text-align:left">${formatCurrency(item.totalPrice)}</td>
        <td style="text-align:center">${availabilityLabels[item.availability] || item.availability}</td>
        <td style="text-align:center">${item.deliveryDays ?? '—'}</td>
      </tr>`).join('');

    approvedInquirySection = `
      <h2 style="margin-top:30px;font-size:14px;color:#1e40af;">استعلام تایید‌شده</h2>
      <table style="width:100%;font-size:12px;margin-bottom:10px;">
        <tr>
          <td style="padding:4px 8px;"><strong>تأمین‌کننده:</strong> ${escapeHtml(inq.supplierName)}</td>
          <td style="padding:4px 8px;"><strong>قیمت کل:</strong> ${formatCurrency(inq.totalPrice)} تومان</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;"><strong>روش پرداخت:</strong> ${inq.paymentMethod ? escapeHtml(inq.paymentMethod) : '—'}</td>
          <td style="padding:4px 8px;"><strong>مهلت پرداخت:</strong> ${inq.paymentDays != null ? inq.paymentDays + ' روز' : '—'}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px;border:1px solid #e5e7eb;">#</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">محصول</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">تعداد</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">قیمت واحد</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">قیمت کل</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">موجودی</th>
            <th style="padding:6px;border:1px solid #e5e7eb;">تحویل (روز)</th>
          </tr>
        </thead>
        <tbody>
          ${inqItemRows}
          <tr style="font-weight:bold;background:#f9fafb;">
            <td colspan="4" style="padding:6px;border:1px solid #e5e7eb;text-align:left;">جمع کل:</td>
            <td style="padding:6px;border:1px solid #e5e7eb;text-align:left;">${formatCurrency(inq.totalPrice)}</td>
            <td colspan="2" style="padding:6px;border:1px solid #e5e7eb;"></td>
          </tr>
        </tbody>
      </table>
      ${inq.notes ? `<p style="margin-top:8px;font-size:11px;color:#6b7280;"><strong>توضیحات:</strong> ${escapeHtml(inq.notes)}</p>` : ''}`;
  }

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: 'Vazirmatn', 'Tahoma', 'Segoe UI', sans-serif; }
  body { padding: 40px; color: #1f2937; font-size: 13px; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; color: #1e3a8a; }
  .subtitle { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 24px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .info-item { padding: 6px 12px; background: #f9fafb; border-radius: 6px; font-size: 12px; }
  .info-item strong { color: #374151; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f3f4f6; padding: 8px; border: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #374151; }
  td { padding: 6px 8px; border: 1px solid #e5e7eb; }
  .status-badge { display: inline-block; padding: 2px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .status-APPROVED { background: #dcfce7; color: #166534; }
  .status-PURCHASED { background: #f3e8ff; color: #6b21a8; }
  .status-REJECTED { background: #fee2e2; color: #991b1b; }
  .rejection-box { margin-top: 12px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 12px; color: #991b1b; }
  .signatures { margin-top: 50px; display: flex; justify-content: space-around; }
  .sig-box { text-align: center; border: 1px dashed #d1d5db; border-radius: 8px; padding: 20px 40px; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>

<h1>درخواست خرید</h1>
<p class="subtitle">شماره: ${escapeHtml(req.requestNumber)}</p>

<div class="info-grid">
  <div class="info-item"><strong>عنوان:</strong> ${escapeHtml(req.title)}</div>
  <div class="info-item"><strong>وضعیت:</strong> <span class="status-badge status-${req.status}">${statusLabels[req.status] || req.status}</span></div>
  <div class="info-item"><strong>اولویت:</strong> ${priorityLabels[req.priority] || req.priority}</div>
  <div class="info-item"><strong>پروژه:</strong> ${req.project ? escapeHtml(req.project.name) : '—'}</div>
  <div class="info-item"><strong>ایجادکننده:</strong> ${escapeHtml(req.createdBy.fullName)}</div>
  <div class="info-item"><strong>مسئول استعلام:</strong> ${req.assignedTo ? escapeHtml(req.assignedTo.fullName) : '—'}</div>
  <div class="info-item"><strong>تاریخ ایجاد:</strong> ${formatDate(req.createdAt)}</div>
  <div class="info-item"><strong>مهلت:</strong> ${req.deadline ? formatDate(req.deadline) : '—'}</div>
</div>

${req.description ? `<div style="margin-bottom:20px;padding:12px;background:#f9fafb;border-radius:8px;font-size:12px;"><strong>توضیحات:</strong><br>${escapeHtml(req.description)}</div>` : ''}

${req.status === 'REJECTED' && req.rejectionReason ? `<div class="rejection-box"><strong>دلیل رد:</strong> ${escapeHtml(req.rejectionReason)}</div>` : ''}

<h2 style="font-size:14px;color:#1e40af;margin-bottom:8px;">اقلام درخواست</h2>
<table>
  <thead>
    <tr>
      <th style="width:40px;">#</th>
      <th>محصول</th>
      <th>توضیحات</th>
      <th style="width:60px;">تعداد</th>
      <th style="width:60px;">واحد</th>
      <th style="width:100px;">قیمت تخمینی</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

${approvedInquirySection}

<div class="signatures">
  <div class="sig-box">ایجادکننده<br><br><br></div>
  <div class="sig-box">مدیر<br><br><br></div>
</div>

</body>
</html>`;
}

export async function generatePurchasePDF(req: PurchaseRequestData): Promise<Buffer> {
  const html = buildPurchaseHTML(req);

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
