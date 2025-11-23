import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function advancedWorkflowTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 تست پیشرفته workflow کامل سیستم');
  console.log('='.repeat(80) + '\n');

  let testsPassed = 0;
  let testsFailed = 0;
  const errors: string[] = [];

  const test = async (name: string, fn: () => Promise<boolean>) => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        testsPassed++;
      } else {
        console.log(`❌ ${name}`);
        testsFailed++;
        errors.push(name);
      }
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
      testsFailed++;
      errors.push(`${name}: ${error.message}`);
    }
  };

  // پاک کردن داده‌های قبلی
  console.log('🧹 پاک کردن داده‌های تست...\n');
  await prisma.approval.deleteMany();
  await prisma.document.deleteMany();

  const user = await prisma.user.findFirst();
  const customer = await prisma.customer.findFirst();

  if (!user || !customer) {
    console.log('❌ یوزر یا مشتری یافت نشد!');
    return;
  }

  console.log('📋 سناریو 1: ایجاد TEMP_PROFORMA → تایید → تبدیل به PROFORMA → تبدیل به INVOICE\n');

  let tempProformaId: string;
  let proformaId: string;
  let invoiceId: string;

  // ایجاد TEMP_PROFORMA
  await test('1.1. ایجاد TEMP_PROFORMA', async () => {
    const doc = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.document.create({
        data: {
          documentNumber: 'TMP-2025-TEST-001',
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
                productName: 'مانیتور سامسونگ',
                quantity: 10,
                unit: 'عدد',
                purchasePrice: 900000,
                sellPrice: 1000000,
                supplier: 'تامین کننده الف',
              },
            ],
          },
        },
      });

      // ایجاد Approval
      await tx.approval.create({
        data: {
          documentId: newDoc.id,
          userId: user.id,
          status: 'PENDING',
          comment: 'در انتظار تایید',
        },
      });

      return newDoc;
    });

    tempProformaId = doc.id;
    return doc.approvalStatus === 'PENDING';
  });

  await test('1.2. Approval رکورد ایجاد شده است', async () => {
    const approvals = await prisma.approval.count({
      where: { documentId: tempProformaId, status: 'PENDING' },
    });
    return approvals === 1;
  });

  await test('1.3. TEMP_PROFORMA در لیست pendingApprovals ظاهر می‌شود', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
          approvalStatus: 'PENDING',
        },
      },
    });
    return pendingApprovals.length === 1;
  });

  // تایید TEMP_PROFORMA
  await test('1.4. تایید TEMP_PROFORMA', async () => {
    await prisma.$transaction([
      prisma.document.update({
        where: { id: tempProformaId },
        data: { approvalStatus: 'APPROVED' },
      }),
      prisma.approval.updateMany({
        where: { documentId: tempProformaId, status: 'PENDING' },
        data: { status: 'APPROVED' },
      }),
    ]);

    const doc = await prisma.document.findUnique({
      where: { id: tempProformaId },
    });
    return doc?.approvalStatus === 'APPROVED';
  });

  await test('1.5. TEMP_PROFORMA دیگر در pendingApprovals نیست', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
          approvalStatus: 'PENDING',
        },
      },
    });
    return pendingApprovals.length === 0;
  });

  // تبدیل به PROFORMA
  await test('1.6. تبدیل TEMP_PROFORMA به PROFORMA', async () => {
    const sourceDoc = await prisma.document.findUnique({
      where: { id: tempProformaId },
      include: { items: true },
    });

    if (!sourceDoc) return false;

    // حذف PROFORMA قبلی اگر وجود داشته باشد
    await prisma.document.deleteMany({
      where: { convertedFromId: tempProformaId },
    });

    const proforma = await prisma.document.create({
      data: {
        documentNumber: 'PRF-2025-TEST-001',
        documentType: 'PROFORMA',
        customerId: sourceDoc.customerId,
        issueDate: new Date(),
        totalAmount: sourceDoc.totalAmount,
        discountAmount: sourceDoc.discountAmount,
        finalAmount: sourceDoc.finalAmount,
        approvalStatus: 'APPROVED',
        convertedFromId: sourceDoc.id,
        createdById: user.id,
        items: {
          create: sourceDoc.items.map((item) => ({
            productName: item.productName,
            description: item.description,
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

  await test('1.7. PROFORMA مستقیماً APPROVED است (نه PENDING)', async () => {
    const proforma = await prisma.document.findUnique({
      where: { id: proformaId },
    });
    return proforma?.approvalStatus === 'APPROVED';
  });

  await test('1.8. PROFORMA approval ندارد', async () => {
    const approvals = await prisma.approval.count({
      where: { documentId: proformaId },
    });
    return approvals === 0;
  });

  // تبدیل به INVOICE
  await test('1.9. تبدیل PROFORMA به INVOICE', async () => {
    const sourceDoc = await prisma.document.findUnique({
      where: { id: proformaId },
      include: { items: true },
    });

    if (!sourceDoc) return false;

    await prisma.document.deleteMany({
      where: { convertedFromId: proformaId },
    });

    const invoice = await prisma.document.create({
      data: {
        documentNumber: 'INV-2025-TEST-001',
        documentType: 'INVOICE',
        customerId: sourceDoc.customerId,
        issueDate: new Date(),
        totalAmount: sourceDoc.totalAmount,
        discountAmount: sourceDoc.discountAmount,
        finalAmount: sourceDoc.finalAmount,
        approvalStatus: 'APPROVED',
        convertedFromId: sourceDoc.id,
        createdById: user.id,
        items: {
          create: sourceDoc.items.map((item) => ({
            productName: item.productName,
            description: item.description,
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

  await test('1.10. INVOICE مستقیماً APPROVED است', async () => {
    const invoice = await prisma.document.findUnique({
      where: { id: invoiceId },
    });
    return invoice?.approvalStatus === 'APPROVED';
  });

  console.log('\n📋 سناریو 2: ویرایش TEMP_PROFORMA تایید شده\n');

  await test('2.1. ویرایش TEMP_PROFORMA: حذف PROFORMA', async () => {
    await prisma.document.delete({ where: { id: proformaId } });
    const exists = await prisma.document.findUnique({ where: { id: proformaId } });
    return !exists;
  });

  await test('2.2. ویرایش TEMP_PROFORMA: حذف INVOICE', async () => {
    await prisma.document.delete({ where: { id: invoiceId } });
    const exists = await prisma.document.findUnique({ where: { id: invoiceId } });
    return !exists;
  });

  await test('2.3. بازگشت TEMP_PROFORMA به PENDING', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.approval.deleteMany({
        where: { documentId: tempProformaId },
      });

      await tx.document.update({
        where: { id: tempProformaId },
        data: { approvalStatus: 'PENDING' },
      });

      await tx.approval.create({
        data: {
          documentId: tempProformaId,
          userId: user.id,
          status: 'PENDING',
          comment: 'سند ویرایش شد و نیاز به تایید مجدد دارد',
        },
      });
    });

    const doc = await prisma.document.findUnique({
      where: { id: tempProformaId },
    });
    return doc?.approvalStatus === 'PENDING';
  });

  await test('2.4. TEMP_PROFORMA دوباره در کارتابل ظاهر می‌شود', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
          approvalStatus: 'PENDING',
        },
      },
    });
    return pendingApprovals.length === 1;
  });

  console.log('\n📋 سناریو 3: رد کردن TEMP_PROFORMA\n');

  let rejectedTempId: string;

  await test('3.1. ایجاد TEMP_PROFORMA جدید برای رد', async () => {
    const doc = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.document.create({
        data: {
          documentNumber: 'TMP-2025-TEST-002',
          documentType: 'TEMP_PROFORMA',
          customerId: customer.id,
          issueDate: new Date(),
          totalAmount: 5000000,
          discountAmount: 0,
          finalAmount: 5000000,
          approvalStatus: 'PENDING',
          createdById: user.id,
          items: {
            create: [
              {
                productName: 'کیبورد',
                quantity: 5,
                unit: 'عدد',
                purchasePrice: 900000,
                sellPrice: 1000000,
                supplier: 'تامین کننده ب',
              },
            ],
          },
        },
      });

      await tx.approval.create({
        data: {
          documentId: newDoc.id,
          userId: user.id,
          status: 'PENDING',
          comment: 'در انتظار تایید',
        },
      });

      return newDoc;
    });

    rejectedTempId = doc.id;
    return doc.approvalStatus === 'PENDING';
  });

  await test('3.2. رد کردن TEMP_PROFORMA', async () => {
    await prisma.$transaction([
      prisma.document.update({
        where: { id: rejectedTempId },
        data: { approvalStatus: 'REJECTED' },
      }),
      prisma.approval.updateMany({
        where: { documentId: rejectedTempId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          comment: 'قیمت‌ها مناسب نیست',
        },
      }),
    ]);

    const doc = await prisma.document.findUnique({
      where: { id: rejectedTempId },
    });
    return doc?.approvalStatus === 'REJECTED';
  });

  await test('3.3. TEMP_PROFORMA رد شده در کارتابل نیست', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
        document: {
          documentType: 'TEMP_PROFORMA',
          approvalStatus: 'PENDING',
        },
      },
    });
    return !pendingApprovals.some((a) => a.documentId === rejectedTempId);
  });

  console.log('\n📋 سناریو 4: ایجاد مستقیم PROFORMA و INVOICE\n');

  await test('4.1. ایجاد مستقیم PROFORMA با APPROVED', async () => {
    const doc = await prisma.document.create({
      data: {
        documentNumber: 'PRF-2025-TEST-DIRECT-001',
        documentType: 'PROFORMA',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 3000000,
        discountAmount: 0,
        finalAmount: 3000000,
        approvalStatus: 'APPROVED',
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'ماوس',
              quantity: 20,
              unit: 'عدد',
              purchasePrice: 140000,
              sellPrice: 150000,
              supplier: 'تامین کننده ج',
            },
          ],
        },
      },
    });
    return doc.approvalStatus === 'APPROVED';
  });

  await test('4.2. ایجاد مستقیم INVOICE با APPROVED', async () => {
    const doc = await prisma.document.create({
      data: {
        documentNumber: 'INV-2025-TEST-DIRECT-001',
        documentType: 'INVOICE',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 2000000,
        discountAmount: 0,
        finalAmount: 2000000,
        approvalStatus: 'APPROVED',
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'کابل',
              quantity: 50,
              unit: 'عدد',
              purchasePrice: 38000,
              sellPrice: 40000,
              supplier: 'تامین کننده د',
            },
          ],
        },
      },
    });
    return doc.approvalStatus === 'APPROVED';
  });

  console.log('\n📋 سناریو 5: بررسی آمار داشبورد\n');

  await test('5.1. شمارش صحیح اسناد PENDING', async () => {
    const pendingCount = await prisma.document.count({
      where: {
        documentType: 'TEMP_PROFORMA',
        approvalStatus: 'PENDING',
      },
    });
    // باید 1 سند PENDING باشد (TMP-2025-TEST-001)
    return pendingCount === 1;
  });

  await test('5.2. شمارش صحیح اسناد APPROVED', async () => {
    const approvedCount = await prisma.document.count({
      where: {
        approvalStatus: 'APPROVED',
      },
    });
    // باید 2 سند APPROVED باشد (PRF و INV مستقیم)
    return approvedCount === 2;
  });

  await test('5.3. شمارش صحیح اسناد REJECTED', async () => {
    const rejectedCount = await prisma.document.count({
      where: {
        approvalStatus: 'REJECTED',
      },
    });
    return rejectedCount === 1;
  });

  await test('5.4. فقط TEMP_PROFORMA با PENDING در کارتابل', async () => {
    const pendingApprovals = await prisma.approval.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        document: true,
      },
    });

    const allTempProforma = pendingApprovals.every(
      (approval) => approval.document.documentType === 'TEMP_PROFORMA'
    );

    return pendingApprovals.length === 1 && allTempProforma;
  });

  console.log('\n📋 سناریو 6: بررسی ارتباطات (convertedFromId)\n');

  let chain1TempId: string;
  let chain1ProformaId: string;
  let chain1InvoiceId: string;

  await test('6.1. ایجاد زنجیره کامل TEMP → PROFORMA → INVOICE', async () => {
    // ایجاد TEMP
    const temp = await prisma.$transaction(async (tx) => {
      const newDoc = await tx.document.create({
        data: {
          documentNumber: 'TMP-2025-CHAIN-001',
          documentType: 'TEMP_PROFORMA',
          customerId: customer.id,
          issueDate: new Date(),
          totalAmount: 1000000,
          discountAmount: 0,
          finalAmount: 1000000,
          approvalStatus: 'APPROVED',
          createdById: user.id,
          items: {
            create: [
              {
                productName: 'تست زنجیره',
                quantity: 1,
                unit: 'عدد',
                purchasePrice: 900000,
                sellPrice: 1000000,
                supplier: 'تست',
              },
            ],
          },
        },
      });

      await tx.approval.create({
        data: {
          documentId: newDoc.id,
          userId: user.id,
          status: 'APPROVED',
        },
      });

      return newDoc;
    });

    chain1TempId = temp.id;

    // تبدیل به PROFORMA
    const proforma = await prisma.document.create({
      data: {
        documentNumber: 'PRF-2025-CHAIN-001',
        documentType: 'PROFORMA',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 1000000,
        discountAmount: 0,
        finalAmount: 1000000,
        approvalStatus: 'APPROVED',
        convertedFromId: temp.id,
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'تست زنجیره',
              quantity: 1,
              unit: 'عدد',
              purchasePrice: 900000,
              sellPrice: 1000000,
              supplier: 'تست',
            },
          ],
        },
      },
    });

    chain1ProformaId = proforma.id;

    // تبدیل به INVOICE
    const invoice = await prisma.document.create({
      data: {
        documentNumber: 'INV-2025-CHAIN-001',
        documentType: 'INVOICE',
        customerId: customer.id,
        issueDate: new Date(),
        totalAmount: 1000000,
        discountAmount: 0,
        finalAmount: 1000000,
        approvalStatus: 'APPROVED',
        convertedFromId: proforma.id,
        createdById: user.id,
        items: {
          create: [
            {
              productName: 'تست زنجیره',
              quantity: 1,
              unit: 'عدد',
              purchasePrice: 900000,
              sellPrice: 1000000,
              supplier: 'تست',
            },
          ],
        },
      },
    });

    chain1InvoiceId = invoice.id;

    return true;
  });

  await test('6.2. PROFORMA.convertedFromId = TEMP_PROFORMA.id', async () => {
    const proforma = await prisma.document.findUnique({
      where: { id: chain1ProformaId },
    });
    return proforma?.convertedFromId === chain1TempId;
  });

  await test('6.3. INVOICE.convertedFromId = PROFORMA.id', async () => {
    const invoice = await prisma.document.findUnique({
      where: { id: chain1InvoiceId },
    });
    return invoice?.convertedFromId === chain1ProformaId;
  });

  await test('6.4. یافتن تمام اسناد تبدیل شده از TEMP', async () => {
    const convertedDocs = await prisma.document.findMany({
      where: { convertedFromId: chain1TempId },
    });
    return convertedDocs.length === 1 && convertedDocs[0].id === chain1ProformaId;
  });

  await test('6.5. یافتن تمام اسناد تبدیل شده از PROFORMA', async () => {
    const convertedDocs = await prisma.document.findMany({
      where: { convertedFromId: chain1ProformaId },
    });
    return convertedDocs.length === 1 && convertedDocs[0].id === chain1InvoiceId;
  });

  // نتیجه نهایی
  console.log('\n' + '='.repeat(80));
  console.log('📊 نتیجه نهایی:');
  console.log('='.repeat(80));
  console.log(`✅ موفق: ${testsPassed}`);
  console.log(`❌ ناموفق: ${testsFailed}`);
  console.log(`📈 درصد موفقیت: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (testsFailed > 0) {
    console.log('\n⚠️  تست‌های ناموفق:');
    errors.forEach((error) => console.log(`   ❌ ${error}`));
  }

  // خلاصه وضعیت اسناد
  console.log('\n📄 خلاصه وضعیت اسناد:\n');

  const allDocs = await prisma.document.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      approvals: true,
      convertedFrom: true,
    },
  });

  const docsByType = {
    TEMP_PROFORMA: allDocs.filter((d) => d.documentType === 'TEMP_PROFORMA'),
    PROFORMA: allDocs.filter((d) => d.documentType === 'PROFORMA'),
    INVOICE: allDocs.filter((d) => d.documentType === 'INVOICE'),
  };

  console.log(`   📝 TEMP_PROFORMA: ${docsByType.TEMP_PROFORMA.length} سند`);
  console.log(`      - PENDING: ${docsByType.TEMP_PROFORMA.filter((d) => d.approvalStatus === 'PENDING').length}`);
  console.log(`      - APPROVED: ${docsByType.TEMP_PROFORMA.filter((d) => d.approvalStatus === 'APPROVED').length}`);
  console.log(`      - REJECTED: ${docsByType.TEMP_PROFORMA.filter((d) => d.approvalStatus === 'REJECTED').length}`);

  console.log(`\n   📋 PROFORMA: ${docsByType.PROFORMA.length} سند`);
  console.log(`      - همه APPROVED: ${docsByType.PROFORMA.every((d) => d.approvalStatus === 'APPROVED') ? 'بله ✅' : 'خیر ❌'}`);

  console.log(`\n   🧾 INVOICE: ${docsByType.INVOICE.length} سند`);
  console.log(`      - همه APPROVED: ${docsByType.INVOICE.every((d) => d.approvalStatus === 'APPROVED') ? 'بله ✅' : 'خیر ❌'}`);

  console.log('\n');

  await prisma.$disconnect();
}

advancedWorkflowTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
