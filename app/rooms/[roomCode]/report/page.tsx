'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import SessionReportContent from './SessionReportContent';

// 印刷/PDF向けのスタンドアロン表示。通常の閲覧はホスト管理画面の
// 「レポート」タブ（同じ SessionReportContent を埋め込み）から行う。
export default function SessionReportPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = (params?.roomCode || '').toString().toUpperCase();

  return (
    <div className="min-h-screen bg-[#f3f7ff] print:bg-white">
      {/* ── ヘッダー帯（ホスト管理画面と同じ配色） ── */}
      <header className="border-b border-[#9dd8b1] bg-[#eaf8ef] print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#00963c] bg-white text-[#00963c]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-[#323232]">セッションレポート</h1>
              <p className="text-xs text-[#595959]">印刷・PDF保存用の表示です</p>
            </div>
          </div>
          <Link
            href={`/rooms/${roomCode}/host?tab=report`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#cccccc] bg-white px-3.5 text-xs sm:text-sm font-semibold text-[#323232] hover:bg-[#fafafa]"
          >
            <ArrowLeft className="h-4 w-4" />
            ホスト画面に戻る
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6 print:max-w-none print:p-0">
        <SessionReportContent roomCode={roomCode} />
      </main>
    </div>
  );
}
