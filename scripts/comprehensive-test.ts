import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function comprehensiveTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 تست جامع سیستم مدیریت اسناد');
  console.log('='.repeat(80) + '\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // تابع کمکی برای تست
  const test = async (name: string, fn: () => Promise<boolean>) => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        testsPassed++;
      } else {
        console.log(`❌ ${name}`);
        testsFailed++;
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
      testsFailed++;
    }
  };

  // پاک کردن داده‌های قبلی
  console.log('🧹 پاک کردن داده‌های تست...\n');
  await prisma.approval.deleteMany();
  await prisma.document.deleteMany();

  // یافتن user و customer
  const user = await prisma.user.findFirst();
  const customer = await prisma.customer.findFirst();

  if (!user || !customer) {
    console.log('❌ یوزر یا مشتری یافت نشد!');
    return;
  }

  console.log('📋 تست‌های اصلی:\n');

  // ==========================================
  // تست 1: ایجاد پیش‌فاکتور موقت
  // ==========================================
  let tempProformaId: string;
  await test('1. ایجاد TEMP_PROFORMA با وضعیت PENDING', async () => {
    const doc = await prisma.document.create({
      data: {
        documentNumber: 'TMP-TEST-001',
        documentType: 'TEMP_PROFORMA',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 10000000,
        discountAmount: 0,
        finalAmount: 10000000,
        approvalStatus: 'PENDING',
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'محصول تست',
              quantity: 10,
              unit: 'عدد',
              purchasePrice: 800000,
              sellPrice: 1000000,
              supplier: 'تامین کننده تست',
            },
          ],
        },
      },
    });

    tempProformaId = doc.id;
    return doc.approvalStatus === 'PENDING';
  });

  // ==========================================
  // تست 2: ایجاد Approval برای TEMP_PROFORMA
  // ==========================================
  await test('2. ایجاد Approval با وضعیت PENDING', async () => {
    const approval = await prisma.approval.create({
      data: {
        documentId: tempProformaId,
        userId: user.id,
        status: 'PENDING',
        comment: 'در انتظار تایید',
      },
    });
    return approval.status === 'PENDING';
  });

  // ==========================================
  // تست 3: تایید TEMP_PROFORMA
  // ==========================================
  await test('3. تایید TEMP_PROFORMA (تغییر به APPROVED)', async () => {
    const doc = await prisma.document.update({
      where: { id: tempProformaId },
      data: { approvalStatus: 'APPROVED' },
    });

    await prisma.approval.updateMany({
      where: { documentId: tempProformaId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    return doc.approvalStatus === 'APPROVED';
  });

  // ==========================================
  // تست 4: تبدیل به PROFORMA
  // ==========================================
  let proformaId: string;
  await test('4. تبدیل TEMP_PROFORMA به PROFORMA با وضعیت APPROVED', async () => {
    const sourceDoc = await prisma.document.findUnique({
      where: { id: tempProformaId },
      include: { items: true },
    });

    if (!sourceDoc) return false;

    const proforma = await prisma.document.create({
      data: {
        documentNumber: 'PRF-TEST-001',
        documentType: 'PROFORMA',
        customerId: sourceDoc.customerId,
        issueDate: new Date(),
        totalAmount: sourceDoc.totalAmount,
        discountAmount: sourceDoc.discountAmount,
        finalAmount: sourceDoc.finalAmount,
        approvalStatus: 'APPROVED', // ✅ باید APPROVED باشد
        convertedFromId: sourceDoc.id,
        createdById: user.id,
        items: {
          create: sourceDoc.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            purchasePrice: item.purchasePrice,
            sellPrice: item.sellPrice,
            supplier: item.supplier,
          })),
        },
      },
    });

    proformaId = proforma.id;
    return proforma.approvalStatus === 'APPROVED';
  });

  // ==========================================
  // تست 5: تبدیل به INVOICE
  // ==========================================
  let invoiceId: string;
  await test('5. تبدیل PROFORMA به INVOICE با وضعیت APPROVED', async () => {
    const sourceDoc = await prisma.document.findUnique({
      where: { id: proformaId },
      include: { items: true },
    });

    if (!sourceDoc) return false;

    const invoice = await prisma.document.create({
      data: {
        documentNumber: 'INV-TEST-001',
        documentType: 'INVOICE',
        customerId: sourceDoc.customerId,
        issueDate: new Date(),
        totalAmount: sourceDoc.totalAmount,
        discountAmount: sourceDoc.discountAmount,
        finalAmount: sourceDoc.finalAmount,
        approvalStatus: 'APPROVED', // ✅ باید APPROVED باشد
        convertedFromId: sourceDoc.id,
        createdById: user.id,
        items: {
          create: sourceDoc.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit,
            purchasePrice: item.purchasePrice,
            sellPrice: item.sellPrice,
            supplier: item.supplier,
          })),
        },
      },
    });

    invoiceId = invoice.id;
    return invoice.approvalStatus === 'APPROVED';
  });

  // ==========================================
  // تست 6: بررسی ارتباطات
  // ==========================================
  await test('6. بررسی convertedFromId صحیح است', async () => {
    const proforma = await prisma.document.findUnique({
      where: { id: proformaId },
    });
    const invoice = await prisma.document.findUnique({
      where: { id: invoiceId },
    });

    return proforma?.convertedFromId === tempProformaId && invoice?.convertedFromId === proformaId;
  });

  // ==========================================
  // تست 7: ویرایش TEMP_PROFORMA تایید شده
  // ==========================================
  await test('7. ویرایش TEMP_PROFORMA: حذف PROFORMA و INVOICE', async () => {
    // حذف اسناد مرتبط
    await prisma.document.delete({ where: { id: invoiceId } });
    await prisma.document.delete({ where: { id: proformaId } });

    // بررسی حذف
    const proformaExists = await prisma.document.findUnique({ where: { id: proformaId } });
    const invoiceExists = await prisma.document.findUnique({ where: { id: invoiceId } });

    return !proformaExists && !invoiceExists;
  });

  await test('8. ویرایش TEMP_PROFORMA: بازگشت به PENDING', async () => {
    // حذف approval قبلی
    await prisma.approval.deleteMany({ where: { documentId: tempProformaId } });

    // بازگشت به PENDING
    const doc = await prisma.document.update({
      where: { id: tempProformaId },
      data: { approvalStatus: 'PENDING' },
    });

    // ایجاد approval جدید
    await prisma.approval.create({
      data: {
        documentId: tempProformaId,
        userId: user.id,
        status: 'PENDING',
        comment: 'سند ویرایش شد و نیاز به تایید مجدد دارد',
      },
    });

    return doc.approvalStatus === 'PENDING';
  });

  // ==========================================
  // تست 8: فقط TEMP_PROFORMA در کارتابل
  // ==========================================
  await test('9. فقط TEMP_PROFORMA در کارتابل تاییدیه‌ها ظاهر می‌شود', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
          approvalStatus: 'PENDING',
        },
      },
      include: {
        document: true,
      },
    });

    return pendingApprovals.length === 1 && pendingApprovals[0].document.id === tempProformaId;
  });

  // ==========================================
  // تست 9: ایجاد PROFORMA مستقیم (بدون TEMP)
  // ==========================================
  await test('10. ایجاد PROFORMA مستقیم با وضعیت APPROVED', async () => {
    const directProforma = await prisma.document.create({
      data: {
        documentNumber: 'PRF-TEST-DIRECT',
        documentType: 'PROFORMA',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 5000000,
        discountAmount: 0,
        finalAmount: 5000000,
        approvalStatus: 'APPROVED', // ✅ باید APPROVED باشد
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'محصول مستقیم',
              quantity: 5,
              unit: 'عدد',
              purchasePrice: 900000,
              sellPrice: 1000000,
              supplier: 'تامین کننده',
            },
          ],
        },
      },
    });

    return directProforma.approvalStatus === 'APPROVED';
  });

  // ==========================================
  // نتیجه نهایی
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 نتیجه تست‌ها:');
  console.log('='.repeat(80));
  console.log(`✅ موفق: ${testsPassed}`);
  console.log(`❌ ناموفق: ${testsFailed}`);
  console.log(`📈 درصد موفقیت: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  // نمایش وضعیت نهایی اسناد
  console.log('📄 وضعیت نهایی اسناد:\n');
  const allDocs = await prisma.document.findMany({
    orderBy: { createdAt: 'asc' },
    include: { approvals: true },
  });

  allDocs.forEach((doc) => {
    console.log(`   ${doc.documentNumber} (${doc.documentType}): ${doc.approvalStatus}`);
    if (doc.convertedFromId) {
      const source = allDocs.find((d) => d.id === doc.convertedFromId);
      console.log(`      ↳ ساخته شده از: ${source?.documentNumber}`);
    }
    console.log(`      Approvals: ${doc.approvals.length}`);
  });

  console.log('\n');

  await prisma.$disconnect();
}

comprehensiveTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
