import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'purchases');

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PROFORMA = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_VOICE = ['audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/mp4'];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;      // 5MB
const MAX_PROFORMA_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_VOICE_SIZE = 10 * 1024 * 1024;      // 10MB

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'image' | 'proforma' | 'voice'

    if (!file || !type) {
      return NextResponse.json({ error: 'فایل و نوع الزامی است' }, { status: 400 });
    }

    // Validate type and file
    let allowedTypes: string[];
    let maxSize: number;

    switch (type) {
      case 'image':
        allowedTypes = ALLOWED_IMAGE;
        maxSize = MAX_IMAGE_SIZE;
        break;
      case 'proforma':
        allowedTypes = ALLOWED_PROFORMA;
        maxSize = MAX_PROFORMA_SIZE;
        break;
      case 'voice':
        allowedTypes = ALLOWED_VOICE;
        maxSize = MAX_VOICE_SIZE;
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

    // Create upload directory
    const subDir = path.join(UPLOAD_DIR, type);
    if (!existsSync(subDir)) {
      await mkdir(subDir, { recursive: true });
    }

    // Generate safe filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeExt = ext.replace(/[^a-z0-9]/g, '');
    const fileName = `${randomUUID()}.${safeExt}`;
    const filePath = path.join(subDir, fileName);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Return the relative path for DB storage
    const relativePath = `/uploads/purchases/${type}/${fileName}`;

    return NextResponse.json({
      fileName: file.name,
      filePath: relativePath,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'خطا در آپلود فایل' }, { status: 500 });
  }
}
