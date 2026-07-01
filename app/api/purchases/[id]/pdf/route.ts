import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { generatePurchasePDF } from '@/lib/services/purchase-pdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const purchaseRequest = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      createdBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      items: { orderBy: { createdAt: 'asc' } },
      approvedInquiry: {
        include: {
          items: {
            include: {
              purchaseItem: { select: { productName: true, quantity: true, unit: true } },
            },
          },
        },
      },
    },
  });

  if (!purchaseRequest) {
    return NextResponse.json({ error: 'درخواست خرید یافت نشد' }, { status: 404 });
  }

  const role = session.user.role;
  if (role === 'USER' && purchaseRequest.assignedToId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pdfBuffer = await generatePurchasePDF(purchaseRequest);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${purchaseRequest.requestNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Purchase PDF generation error:', error);
    return NextResponse.json(
      { error: 'خطا در تولید PDF' },
      { status: 500 }
    );
  }
}
