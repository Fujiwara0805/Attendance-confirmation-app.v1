// Gotenberg(LibreOffice入りDocker)に Office ファイルの PDF 変換を委譲するヘルパー。
// Vercel サーバーレスでは LibreOffice を直接動かせないため、外部の Gotenberg に HTTP で渡す。
// 自己ホスト例: `docker run --rm -p 3000:3000 gotenberg/gotenberg:8`
// 環境変数 GOTENBERG_URL（例: https://your-gotenberg.fly.dev）を設定すると有効化される。

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// GOTENBERG_URL 未設定を表す専用エラー（呼び出し側でフォールバック判定に使う）。
export class GotenbergNotConfiguredError extends Error {
  constructor() {
    super('GOTENBERG_URL is not configured');
    this.name = 'GotenbergNotConfiguredError';
  }
}

export function isGotenbergConfigured(): boolean {
  return !!process.env.GOTENBERG_URL;
}

// pptx などの Office ファイルを PDF(バイト列)に変換する。
export async function convertOfficeToPdf(bytes: Uint8Array, filename: string): Promise<Uint8Array> {
  const baseUrl = process.env.GOTENBERG_URL;
  if (!baseUrl) {
    throw new GotenbergNotConfiguredError();
  }

  const form = new FormData();
  // TS 5.7+ の lib.dom では Uint8Array<ArrayBufferLike> が BlobPart に直接代入できないため明示キャスト。
  // 実行時は Uint8Array は正当な BlobPart。
  form.append('files', new Blob([bytes as unknown as BlobPart], { type: PPTX_MIME }), filename);

  const endpoint = `${baseUrl.replace(/\/$/, '')}/forms/libreoffice/convert`;
  const response = await fetch(endpoint, { method: 'POST', body: form });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gotenberg conversion failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
