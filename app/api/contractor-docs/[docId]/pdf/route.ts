import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { generateContractorDocPDF } from '@/lib/services/contractor-doc-pdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { docId } = await params;

  const doc = await prisma.contractorDoc.findUnique({
    where: { id: docId },
    include: {
      project: true,
      createdBy: { select: { id: true, fullName: true } },
      items: { orderBy: { createdAt: 'asc' } },
      attachments: { select: { fileName: true, filePath: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Contractor doc not found' }, { status: 404 });
  }

  // Contractors can only access their own docs
  const role = session.user.role;
  if (role === 'CONTRACTOR' && doc.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pdfBuffer = await generateContractorDocPDF(doc);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.docNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Contractor doc PDF generation error:', error);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}
