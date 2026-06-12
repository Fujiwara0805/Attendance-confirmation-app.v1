import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // 位置情報設定（管理画面）専用のプロキシ。未認証で叩けると Google Places の
  // 課金枠を第三者に消費されうる（キーがリファラ制限付きでもサーバー経由だと制限を回避できる）。
  // 全呼び出し元は管理画面なのでログイン必須にする。
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const input = request.nextUrl.searchParams.get('input');
  if (!input) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&language=ja&components=country:jp`
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
