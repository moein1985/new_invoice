import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { generateWorkReportPDF } from '@/lib/services/work-report-pdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reportId } = await params;

  const report = await prisma.workReport.findUnique({
    where: { id: reportId },
    include: {
      project: true,
      createdBy: { select: { id: true, fullName: true } },
      items: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!report) {
    return NextResponse.json({ error: 'Work report not found' }, { status: 404 });
  }

  // Contractors can only access their own reports
  const role = session.user.role;
  if (role === 'CONTRACTOR' && report.createdById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const pdfBuffer = await generateWorkReportPDF(report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.reportNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Work report PDF generation error:', error);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}
