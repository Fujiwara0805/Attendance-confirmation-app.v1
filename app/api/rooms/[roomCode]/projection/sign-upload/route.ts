import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

const BUCKET = 'projection-files';
const MAX_BYTES = 40 * 1024 * 1024;

export const dynamic = 'force-dynamic';

// バケットが無ければ作成する（private）。
// allowedMimeTypes は設定しない: ブラウザが pptx の MIME を空で送る場合や、
// サーバー側で PDF を書き込む経路でアップロードが弾かれるのを防ぐため。
// アップロードは署名付き URL でパスを限定しているので安全。
async function ensureBucket(supabase: ReturnType<typeof createServerClient>) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
  });
}

// POST: ホストのみ。pptx をブラウザから Supabase Storage へ直接アップロードするための
// 署名付きアップロード URL（path + token）を返す。Vercel のボディ上限(~4.5MB)を回避するため、
// 大きな pptx は API ルートを経由せず Storage へ直接送る。
export async function POST(
  _req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureBucket(supabase);

    const objectPath = `${room.id}/${randomUUID()}.pptx`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(objectPath);
    if (error || !data) {
      console.error('createSignedUploadUrl error:', error);
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token });
  } catch (err) {
    console.error('projection sign-upload error:', err);
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }
}
