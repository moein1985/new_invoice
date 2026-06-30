import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import fs from 'fs';
import path from 'path';

const MUSIC_DIR = '/app/music';
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'USER') {
    return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
  }

  try {
    if (!fs.existsSync(MUSIC_DIR)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(MUSIC_DIR)
      .filter(f => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'fa'));

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
