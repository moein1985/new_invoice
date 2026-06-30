import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import fs from 'fs';
import path from 'path';

const MUSIC_DIR = '/app/music';
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'USER') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
  }

  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);

  // Security: prevent path traversal
  const safeName = path.basename(decodedFilename);
  const ext = path.extname(safeName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: 'فرمت فایل مجاز نیست' }, { status: 400 });
  }

  const filePath = path.join(MUSIC_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'فایل یافت نشد' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const range = request.headers.get('range');

  if (range) {
    // Support range requests for seeking
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
