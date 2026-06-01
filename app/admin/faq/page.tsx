'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Airplay,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Settings,
} from 'lucide-react';
import AdminShell, {
  readCachedAdminShellPlanInfo,
  type AdminShellPlanInfo,
  writeCachedAdminShellPlanInfo,
} from '../components/AdminShell';

const supportSections = [
  {
    id: 'forms',
    title: 'フォーム管理',
    icon: FileText,
    summary: '出席フォーム、カスタムフォーム、招待フォームを作成・管理する画面です。',
    body:
      '標準の出席フォームは、日付・フォーム名・ID・学年・名前・所属・レポートなど、よく使う項目を含んだ状態ですぐに使えます。カスタムフォームでは項目の追加、削除、並び替え、標準項目の無効化ができるため、授業・イベント・受付業務に合わせて入力内容を調整できます。招待フォームは事前申込や参加予定者の受付に使え、日時選択と個人QRコード発行に対応しています。作成後はQRコードやURLを参加者へ共有するだけで、スマートフォンから回答を受け付けられます。',
    tips: ['フォーム名や担当者、コードで検索できます。', '無料プランでは作成数に上限があります。'],
  },
  {
    id: 'rooms',
    title: 'ルーム管理',
    icon: Airplay,
    summary: 'リアルタイムQ&Aとワークツール（ライブ投票）を行うルームを管理する画面です。',
    body:
      'ルームを作成すると、参加者はコードやURLからログインなしで参加できます。ルーム内では匿名質問の受付、質問へのいいね、ワークツール（通常投票・クイズ・ランキング・ブレスト形式）を利用できます。ブレスト形式では参加者の短い自由回答を付箋カードとして集め、スクリーン上で分類できます。ホスト管理画面では質問の承認や回答済み管理、カードの作成、結果確認、CSV出力までまとめて操作できます。参加者ビュー、ホスト管理、データ出力への導線もルームカードから開けます。',
    tips: ['ルーム名、コード、ステータスで検索できます。', '公開中と終了の切り替えはルームカードから行えます。'],
  },
  {
    id: 'export',
    title: 'データ出力',
    icon: Download,
    summary: 'フォームの回答データをCSVまたはJSONで出力する画面です。',
    body:
      'フォームに登録された出席データや回答データを、CSVまたはJSON形式でダウンロードできます。CSVはExcelで扱いやすい形式で出力されるため、授業後の出席集計、イベント後の参加者管理、外部ツールでの分析に利用できます。期間を指定して必要なデータだけを絞り込むこともできます。',
    tips: ['出力前に対象フォームと期間を確認してください。', '参加者への共有用ではなく、管理者の集計用データです。'],
  },
  {
    id: 'account',
    title: 'アカウント設定',
    icon: Settings,
    summary: 'プラン、請求状態、利用上限、アカウント情報を確認する画面です。',
    body:
      '現在のプラン、フォーム数・ルーム数の利用状況、請求状態を確認できます。FreeプランからProプランへのアップグレード、請求ポータルの表示、解約予約などもこの画面から行います。アカウント削除は関連データに影響するため、実行前に確認画面が表示されます。',
    tips: ['上限に達した場合はプラン変更を検討してください。', '請求情報の詳細は決済ポータルで確認できます。'],
  },
];

export default function AdminFAQPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [planInfo, setPlanInfo] = useState<AdminShellPlanInfo | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/admin/login');
  }, [router, session, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const cached = readCachedAdminShellPlanInfo();
    if (cached) {
      setPlanInfo(cached);
      return;
    }
    (async () => {
      try {
        const response = await fetch('/api/v2/subscription');
        if (response.ok) {
          const data = await response.json();
          setPlanInfo(data);
          writeCachedAdminShellPlanInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch plan info:', error);
      }
    })();
  }, [status]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2864f0]" />
      </div>
    );
  }

  return (
    <AdminShell activeSection="faq" planInfo={planInfo}>
      <div className="border-b border-[#aac8ff] bg-[#ebf3ff]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#aac8ff] bg-[#dce8ff] text-[#2864f0]">
            <HelpCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-[#323232] sm:text-xl">サポート</h1>
            <p className="mt-0.5 text-xs text-[#595959] sm:text-sm">
              管理画面とホスト管理画面の使い方を確認できます。
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {supportSections.map((section) => {
            const Icon = section.icon;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-[#dce8ff] bg-white p-4 transition-colors hover:border-[#aac8ff] hover:bg-[#f3f7ff]"
              >
                <Icon className="h-5 w-5 text-[#2864f0]" />
                <p className="mt-2 text-sm font-bold text-[#323232]">{section.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#595959]">{section.summary}</p>
              </a>
            );
          })}
        </div>

        <div className="space-y-4">
          {supportSections.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 rounded-lg border border-[#e9e7e7] bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#ebf3ff] text-[#2864f0]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#323232]">{section.title}</h2>
                    <p className="mt-1 text-sm font-bold text-[#23418c]">{section.summary}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#595959]">{section.body}</p>
                <div className="mt-4 rounded-lg border border-[#dce8ff] bg-[#f3f7ff] p-3">
                  {section.tips.map((tip) => (
                    <p key={tip} className="text-xs leading-6 text-[#23418c]">
                      {tip}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="rounded-lg border border-[#dce8ff] bg-[#f3f7ff] p-5">
          <p className="text-sm font-bold text-[#323232]">解決しない場合</p>
          <p className="mt-1 text-sm leading-relaxed text-[#595959]">
            操作で迷った場合や不具合が疑われる場合は、状況が分かる画面名と操作内容を添えてお問い合わせください。
          </p>
          <Link
            href="mailto:sobota@nobody-info.com"
            className="mt-3 inline-flex h-9 items-center rounded-md bg-[#2864f0] px-4 text-sm font-bold text-white hover:bg-[#285ac8]"
          >
            お問い合わせ
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
