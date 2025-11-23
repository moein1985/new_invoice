import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== بررسی چرخه کار اسناد ===\n');

  // تمام اسناد
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  console.log(`📋 تعداد کل اسناد: ${documents.length}\n`);

  // گروه‌بندی بر اساس نوع
  const grouped: Record<string, typeof documents> = {
    TEMP_PROFORMA: [],
    PROFORMA: [],
    INVOICE: [],
    RETURN_INVOICE: [],
    RECEIPT: [],
    OTHER: [],
  };

  documents.forEach((doc) => {
    grouped[doc.documentType].push(doc);
  });

  // نمایش هر گروه
  for (const [type, docs] of Object.entries(grouped)) {
    if (docs.length === 0) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📁 ${type} (${docs.length} عدد)`);
    console.log(`${'='.repeat(60)}\n`);

    for (const doc of docs) {
      console.log(`  🔹 ${doc.documentNumber}`);
      console.log(`     مشتری: ${doc.customer.name}`);
      console.log(`     وضعیت تایید: ${doc.approvalStatus}`);
      console.log(`     ساخته شده از: ${doc.convertedFromId || '❌ (سند اصلی)'}`);

      // پیدا کردن سند تبدیل شده
      const convertedTo = documents.find((d) => d.convertedFromId === doc.id);
      if (convertedTo) {
        console.log(`     تبدیل شده به: ✅ ${convertedTo.documentNumber} (${convertedTo.documentType})`);
      } else {
        console.log(`     تبدیل شده به: ❌`);
      }

      // آخرین approval
      if (doc.approvals.length > 0) {
        const lastApproval = doc.approvals[0];
        console.log(`     آخرین تایید: ${lastApproval.status} در ${lastApproval.createdAt.toLocaleDateString('fa-IR')}`);
      }

      console.log(`     مبلغ نهایی: ${doc.finalAmount.toLocaleString('fa-IR')} ریال`);
      console.log('');
    }
  }

  // بررسی approval workflow
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 وضعیت Approvals');
  console.log(`${'='.repeat(60)}\n`);

  const approvals = await prisma.approval.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      document: { select: { documentNumber: true, documentType: true } },
      user: { select: { fullName: true } },
    },
  });

  console.log(`تعداد کل approvals: ${approvals.length}\n`);

  for (const approval of approvals) {
    console.log(`  ${approval.status === 'APPROVED' ? '✅' : approval.status === 'REJECTED' ? '❌' : '⏳'} ${approval.document.documentNumber} (${approval.document.documentType})`);
    console.log(`     وضعیت: ${approval.status}`);
    console.log(`     توسط: ${approval.user.fullName}`);
    console.log(`     تاریخ: ${approval.createdAt.toLocaleDateString('fa-IR')}`);
    if (approval.comment) {
      console.log(`     نظر: ${approval.comment}`);
    }
    console.log('');
  }

  // بررسی تناقضات
  console.log(`\n${'='.repeat(60)}`);
  console.log('⚠️  بررسی تناقضات');
  console.log(`${'='.repeat(60)}\n`);

  // اسنادی که convertedFromId دارند اما سند مبدأ وجود ندارد
  const orphanedDocs = documents.filter(
    (doc) => doc.convertedFromId && !documents.find((d) => d.id === doc.convertedFromId)
  );
  if (orphanedDocs.length > 0) {
    console.log(`❌ ${orphanedDocs.length} سند یتیم (سند مبدأ حذف شده):`);
    orphanedDocs.forEach((doc) => {
      console.log(`   - ${doc.documentNumber} (${doc.documentType})`);
    });
    console.log('');
  } else {
    console.log('✅ همه اسناد تبدیل شده، سند مبدأ معتبر دارند\n');
  }

  // اسنادی که TEMP_PROFORMA هستند و APPROVED هستند اما PROFORMA ندارند
  const tempProformasWithoutProforma = documents.filter(
    (doc) =>
      doc.documentType === 'TEMP_PROFORMA' &&
      doc.approvalStatus === 'APPROVED' &&
      !documents.find((d) => d.convertedFromId === doc.id && d.documentType === 'PROFORMA')
  );
  if (tempProformasWithoutProforma.length > 0) {
    console.log(`⚠️  ${tempProformasWithoutProforma.length} پیش‌فاکتور موقت تایید شده بدون پیش‌فاکتور:`);
    tempProformasWithoutProforma.forEach((doc) => {
      console.log(`   - ${doc.documentNumber}`);
    });
    console.log('');
  } else {
    console.log('✅ همه پیش‌فاکتورهای موقت تایید شده، پیش‌فاکتور دارند\n');
  }

  // PROFORMA های APPROVED بدون INVOICE
  const proformasWithoutInvoice = documents.filter(
    (doc) =>
      doc.documentType === 'PROFORMA' &&
      doc.approvalStatus === 'APPROVED' &&
      !documents.find((d) => d.convertedFromId === doc.id && d.documentType === 'INVOICE')
  );
  if (proformasWithoutInvoice.length > 0) {
    console.log(`⚠️  ${proformasWithoutInvoice.length} پیش‌فاکتور تایید شده بدون فاکتور:`);
    proformasWithoutInvoice.forEach((doc) => {
      console.log(`   - ${doc.documentNumber}`);
    });
    console.log('');
  } else {
    console.log('✅ همه پیش‌فاکتورهای تایید شده، فاکتور دارند\n');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
