import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'tickets');

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PDF = ['application/pdf'];
const ALLOWED_OTHER = ['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'application/x-zip-compressed'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;       // 5MB
const MAX_PDF_SIZE = 10 * 1024 * 1024;        // 10MB
const MAX_OTHER_SIZE = 10 * 1024 * 1024;      // 10MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'image' | 'pdf' | 'other'

    if (!file || !type) {
      return NextResponse.json({ error: 'فایل و نوع الزامی است' }, { status: 400 });
    }

    let allowedTypes: string[];
    let maxSize: number;

    switch (type) {
      case 'image':
        allowedTypes = ALLOWED_IMAGE;
        maxSize = MAX_IMAGE_SIZE;
        break;
      case 'pdf':
        allowedTypes = ALLOWED_PDF;
        maxSize = MAX_PDF_SIZE;
        break;
      case 'other':
        allowedTypes = ALLOWED_OTHER;
        maxSize = MAX_OTHER_SIZE;
        break;
      default:
        return NextResponse.json({ error: 'نوع فایل نامعتبر' }, { status: 400 });
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `فرمت فایل مجاز نیست. فرمت‌های مجاز: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `حجم فایل بیشتر از حد مجاز (${maxSize / 1024 / 1024}MB) است` },
        { status: 400 }
      );
    }

    const subDir = path.join(UPLOAD_DIR, type);
    if (!existsSync(subDir)) {
      await mkdir(subDir, { recursive: true });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ext.replace(/[^a-z0-9]/g, '');
    const fileName = `${randomUUID()}.${safeExt}`;
    const filePath = path.join(subDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const relativePath = `/uploads/tickets/${type}/${fileName}`;

    return NextResponse.json({
      fileName: file.name,
      filePath: relativePath,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Ticket upload error:', error);
    return NextResponse.json({ error: 'خطا در آپلود فایل' }, { status: 500 });
  }
}
