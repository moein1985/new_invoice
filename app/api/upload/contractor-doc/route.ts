import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

const MAX_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'contractor-docs');
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

type FileSignature = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | 'unknown';
  extension: string;
};

function sanitizeOriginalName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  const safeBase = base.replace(/[^a-zA-Z0-9_\-.\u0600-\u06FF]/g, '_').slice(0, 120) || 'file';
  const safeExt = ext.replace(/[^a-z0-9.]/g, '').slice(0, 10) || '.bin';
  return `${safeBase}${safeExt}`;
}

function detectMagic(buffer: Buffer): FileSignature {
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  // PDF: 25 50 44 46 (%PDF)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }

  return { mimeType: 'unknown', extension: 'bin' };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'فایل الزامی است' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'حداکثر حجم فایل 10 مگابایت است' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'فرمت فایل مجاز نیست' }, { status: 400 });
    }

    const originalFileName = sanitizeOriginalName(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const signature = detectMagic(buffer);

    if (signature.mimeType === 'unknown' || signature.mimeType !== file.type) {
      return NextResponse.json({ error: 'نوع فایل نامعتبر است' }, { status: 400 });
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const fileId = randomUUID();
    const storedName = `${fileId}.${signature.extension}`;
    const absolutePath = path.join(UPLOAD_DIR, storedName);

    await writeFile(absolutePath, buffer);

    return NextResponse.json({
      fileName: originalFileName,
      filePath: fileId,
      fileSize: file.size,
      mimeType: signature.mimeType,
    });
  } catch (error) {
    console.error('Contractor doc upload error:', error);
    return NextResponse.json({ error: 'خطا در آپلود فایل' }, { status: 500 });
  }
}
