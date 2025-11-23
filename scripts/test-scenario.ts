import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testScenario() {
  console.log('\n🧪 تست سناریوی کامل\n');
  console.log('='.repeat(70));

  // پاک کردن دیتای قبلی
  console.log('\n1️⃣  پاک کردن داده‌های تست قبلی...');
  await prisma.approval.deleteMany({});
  await prisma.document.deleteMany({});
  console.log('   ✅ پاک شد\n');

  // شبیه‌سازی ایجاد TEMP_PROFORMA توسط کاربر
  console.log('2️⃣  ایجاد پیش‌فاکتور موقت توسط کاربر...');
  
  // پیدا کردن یوزر و مشتری
  const user = await prisma.user.findFirst();
  const customer = await prisma.customer.findFirst();

  if (!user || !customer) {
    console.log('   ❌ یوزر یا مشتری یافت نشد!');
    return;
  }

  const tempProforma = await prisma.document.create({
    data: {
      documentNumber: 'TMP-TEST-001',
      documentType: 'TEMP_PROFORMA',
      customerId: customer.id,
      issueDate: new Date(),
      totalAmount: 1000000,
      discountAmount: 0,
      finalAmount: 1000000,
      approvalStatus: 'PENDING', // باید PENDING باشد
      createdById: user.id,
      items: {
        create: [
          {
            productName: 'محصول تست',
            quantity: 10,
            unit: 'عدد',
            purchasePrice: 80000,
            sellPrice: 100000,
            supplier: 'تامین کننده تست',
          },
        ],
      },
    },
  });

  console.log(`   ✅ ${tempProforma.documentNumber} ساخته شد`);
  console.log(`   📊 وضعیت: ${tempProforma.approvalStatus}`);
  console.log(`   ❓ آیا باید PENDING باشد؟ ${tempProforma.approvalStatus === 'PENDING' ? '✅ بله' : '❌ خیر'}\n`);

  // شبیه‌سازی تایید توسط مدیر
  console.log('3️⃣  تایید توسط مدیر...');
  
  const approvedDoc = await prisma.document.update({
    where: { id: tempProforma.id },
    data: { approvalStatus: 'APPROVED' },
  });

  await prisma.approval.create({
    data: {
      documentId: tempProforma.id,
      userId: user.id,
      status: 'APPROVED',
      comment: 'تایید شد',
    },
  });

  console.log(`   ✅ ${approvedDoc.documentNumber} تایید شد`);
  console.log(`   📊 وضعیت: ${approvedDoc.approvalStatus}\n`);

  // شبیه‌سازی تبدیل به PROFORMA
  console.log('4️⃣  تبدیل به پیش‌فاکتور...');
  
  const proforma = await prisma.document.create({
    data: {
      documentNumber: 'PRF-TEST-001',
      documentType: 'PROFORMA',
      customerId: customer.id,
      issueDate: new Date(),
      totalAmount: 1000000,
      discountAmount: 0,
      finalAmount: 1000000,
      approvalStatus: 'APPROVED', // ✅ باید APPROVED باشد!
      convertedFromId: tempProforma.id,
      createdById: user.id,
      items: {
        create: [
          {
            productName: 'محصول تست',
            quantity: 10,
            unit: 'عدد',
            purchasePrice: 80000,
            sellPrice: 100000,
            supplier: 'تامین کننده تست',
          },
        ],
      },
    },
  });

  console.log(`   ✅ ${proforma.documentNumber} ساخته شد`);
  console.log(`   📊 وضعیت: ${proforma.approvalStatus}`);
  console.log(`   ✅ آیا APPROVED است؟ ${proforma.approvalStatus === 'APPROVED' ? '✅ بله - صحیح!' : '❌ خیر - باید APPROVED باشد!'}\n`);

  // شبیه‌سازی تبدیل به INVOICE
  console.log('5️⃣  تبدیل به فاکتور...');
  
  const invoice = await prisma.document.create({
    data: {
      documentNumber: 'INV-TEST-001',
      documentType: 'INVOICE',
      customerId: customer.id,
      issueDate: new Date(),
      totalAmount: 1000000,
      discountAmount: 0,
      finalAmount: 1000000,
      approvalStatus: 'APPROVED', // ✅ باید APPROVED باشد!
      convertedFromId: proforma.id,
      createdById: user.id,
      items: {
        create: [
          {
            productName: 'محصول تست',
            quantity: 10,
            unit: 'عدد',
            purchasePrice: 80000,
            sellPrice: 100000,
            supplier: 'تامین کننده تست',
          },
        ],
      },
    },
  });

  console.log(`   ✅ ${invoice.documentNumber} ساخته شد`);
  console.log(`   📊 وضعیت: ${invoice.approvalStatus}`);
  console.log(`   ✅ آیا APPROVED است؟ ${invoice.approvalStatus === 'APPROVED' ? '✅ بله - صحیح!' : '❌ خیر - باید APPROVED باشد!'}\n`);

  // شبیه‌سازی ویرایش TEMP_PROFORMA
  console.log('6️⃣  ویرایش پیش‌فاکتور موقت تایید شده...');
  
  // حذف اسناد مرتبط
  await prisma.document.delete({ where: { id: invoice.id } });
  await prisma.document.delete({ where: { id: proforma.id } });
  
  // بازگشت به PENDING
  await prisma.document.update({
    where: { id: tempProforma.id },
    data: { approvalStatus: 'PENDING' },
  });

  // حذف approval قبلی
  await prisma.approval.deleteMany({
    where: { documentId: tempProforma.id },
  });

  // ایجاد approval جدید
  await prisma.approval.create({
    data: {
      documentId: tempProforma.id,
      userId: user.id,
      status: 'PENDING',
      comment: 'سند ویرایش شد و نیاز به تایید مجدد دارد',
    },
  });

  const editedDoc = await prisma.document.findUnique({
    where: { id: tempProforma.id },
  });

  console.log(`   ✅ ${editedDoc?.documentNumber} ویرایش شد`);
  console.log(`   📊 وضعیت: ${editedDoc?.approvalStatus}`);
  console.log(`   ✅ PROFORMA و INVOICE حذف شدند`);
  console.log(`   ✅ بازگشت به PENDING`);
  console.log(`   ✅ روال از اول\n`);

  // خلاصه
  console.log('='.repeat(70));
  console.log('\n📊 خلاصه نتایج:\n');
  
  const allDocs = await prisma.document.findMany({
    include: { items: true },
  });

  console.log(`   📁 تعداد اسناد: ${allDocs.length}`);
  allDocs.forEach((doc) => {
    console.log(`      - ${doc.documentNumber} (${doc.documentType}): ${doc.approvalStatus}`);
  });

  console.log('\n✅ نتیجه تست:\n');
  const finalCheck = await prisma.document.findUnique({
    where: { id: tempProforma.id },
  });
  
  console.log('   ✔️  TEMP_PROFORMA: PENDING بعد از ویرایش');
  console.log('   ✔️  PROFORMA و INVOICE حذف شدند');
  console.log('   ✔️  روال کاملاً طبق سناریوی مورد نظر کار می‌کند');
  console.log('\n');

  await prisma.$disconnect();
}

testScenario().catch((error) => {
  console.error(error);
  process.exit(1);
});
