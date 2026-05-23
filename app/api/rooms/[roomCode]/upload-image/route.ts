import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

const BUCKET = 'poll-images';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const ALLOWED_MIME_TYPES = Array.from(ALLOWED_MIME);

export const dynamic = 'force-dynamic';

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

// POST: ホストのみ。投票/出題画像を Supabase Storage の `poll-images` バケットにアップロードし
// 公開 URL を返す。Disk IO 削減のため base64 を polls.options に埋めるのを廃止する経路。
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 10MB limit' }, { status: 413 });
    }

    const { error: bucketErr } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
    if (bucketErr) {
      console.error('Storage bucket update error:', bucketErr);
      return NextResponse.json({ error: 'Storage bucket update failed' }, { status: 500 });
    }

    const ext = extFromMime(file.type);
    const objectPath = `${room.id}/${randomUUID()}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year (immutable, content-addressed)
        upsert: false,
      });

    if (upErr) {
      console.error('Storage upload error:', upErr);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return NextResponse.json({ url: pub.publicUrl, path: objectPath });
  } catch (err) {
    console.error('Upload image error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
