import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'contractor-docs');

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function isValidId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveFileName(id: string) {
  if (!existsSync(UPLOAD_DIR)) {
    return null;
  }

  const entries = await readdir(UPLOAD_DIR);
  return entries.find((entry) => entry.startsWith(`${id}.`)) ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: 'Invalid file id' }, { status: 400 });
  }

  const resolvedName = await resolveFileName(id);
  if (!resolvedName) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const safeName = path.basename(resolvedName);
  const absolutePath = path.join(UPLOAD_DIR, safeName);

  if (!existsSync(absolutePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const buffer = await readFile(absolutePath);
  const ext = path.extname(safeName).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': contentType === 'application/pdf'
        ? `inline; filename="${safeName}"`
        : `inline; filename="${safeName}"`,
    },
  });
}
