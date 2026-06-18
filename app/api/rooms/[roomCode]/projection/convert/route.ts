import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { convertOfficeToPdf, GotenbergNotConfiguredError } from '@/lib/gotenberg';

const BUCKET = 'projection-files';
const PDF_URL_TTL_SECONDS = 60 * 60; // 1 時間

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// POST: ホストのみ。Storage 上の pptx を Gotenberg で PDF に変換し、PDF を Storage に保存して
// 署名付き取得 URL を返す。変換後は元 pptx を削除する。
export async function POST(
  req: NextRequest,
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

    const body = await req.json().catch(() => null);
    const path: unknown = body?.path;
    // 自分のルーム配下の pptx のみ変換対象にする（任意パスの変換を防ぐ）。
    if (typeof path !== 'string' || !path.startsWith(`${room.id}/`) || !path.endsWith('.pptx')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError || !file) {
      console.error('projection download error:', downloadError);
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
    }

    const pptxBytes = new Uint8Array(await file.arrayBuffer());

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await convertOfficeToPdf(pptxBytes, 'presentation.pptx');
    } catch (err) {
      if (err instanceof GotenbergNotConfiguredError) {
        // 未設定時はクライアント側のフォールバック描画に任せる。
        return NextResponse.json({ error: 'Conversion not configured', code: 'GOTENBERG_NOT_CONFIGURED' }, { status: 503 });
      }
      console.error('Gotenberg conversion error:', err);
      return NextResponse.json({ error: 'Conversion failed' }, { status: 502 });
    }

    const pdfPath = `${room.id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('projection pdf upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to store converted file' }, { status: 500 });
    }

    // 元 pptx は不要になるので削除（保存容量の節約）。失敗しても致命的ではない。
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(pdfPath, PDF_URL_TTL_SECONDS);
    if (signError || !signed) {
      console.error('projection createSignedUrl error:', signError);
      return NextResponse.json({ error: 'Failed to sign converted file' }, { status: 500 });
    }

    return NextResponse.json({ pdfUrl: signed.signedUrl });
  } catch (err) {
    console.error('projection convert error:', err);
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
  }
}
