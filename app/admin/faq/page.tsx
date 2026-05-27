'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Airplay,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Download,
  FileText,
  HelpCircle,
  Link2,
  Loader2,
  MessageSquare,
  PieChart,
  Settings,
} from 'lucide-react';
import AdminShell from '../components/AdminShell';

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
    summary: 'リアルタイムQ&Aとライブ投票を行うルームを管理する画面です。',
    body:
      'ルームを作成すると、参加者はコードやURLからログインなしで参加できます。ルーム内では匿名質問の受付、質問へのいいね、ライブ投票、クイズ、ランキング形式の投票を利用できます。ホスト管理画面では質問の承認や回答済み管理、投票カードの作成、結果確認、CSV出力までまとめて操作できます。参加者ビュー、ホスト管理、データ出力への導線もルームカードから開けます。',
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
  {
    id: 'host-questions',
    title: 'ホスト管理: 質問',
    icon: MessageSquare,
    summary: '参加者から届いた質問を整理し、進行中に扱いやすくする画面です。',
    body:
      '参加者から投稿された質問を、承認、非表示、回答済みに切り替えられます。承認制をONにすると、新規質問はホストが確認してから公開されます。いいね数や投稿日時で並び替えることで、優先して扱う質問を見つけやすくなります。画面上のリセットは表示整理のための操作で、CSV出力に使う質問データは保持されます。',
    tips: ['承認待ちがある場合は通知エリアからすぐ確認できます。', '質問はスクリーン画面にも表示できます。'],
  },
  {
    id: 'host-polls',
    title: 'ホスト管理: ライブ投票',
    icon: BarChart3,
    summary: '投票カード、クイズ、ランキングを作成し、結果を集計する画面です。',
    body:
      '通常投票は選択肢から回答してもらう基本形式で、複数選択にも対応します。クイズ形式では正解を設定して理解度チェックができ、ランキング形式では候補を順位で回答してもらい、重み付けされた結果を集計できます。カードはドラッグで並び替えでき、スクリーン画面で投票結果を共有できます。リセットした回答結果も履歴として保持され、CSV出力で振り返れます。',
    tips: ['新規作成はヘッダー右側のボタンから行います。', '検索欄で投票タイトル、選択肢、形式を絞り込めます。'],
  },
  {
    id: 'host-summary',
    title: 'ホスト管理: サマリー',
    icon: PieChart,
    summary: 'ルーム全体の状況をまとめて確認する画面です。',
    body:
      '質問数、いいね合計、参加者数、ライブ投票数をまとめて確認できます。出席フォームを連携している場合は出席数も表示されます。質問のステータス分布や人気の質問TOP5を確認できるため、イベント中の進行判断や終了後の振り返りに使えます。',
    tips: ['数字はルームの現在データをもとに表示されます。', '詳細な出力はエクスポート画面を使います。'],
  },
  {
    id: 'host-integration',
    title: 'ホスト管理: 連携',
    icon: Link2,
    summary: 'ルームと出席フォームを紐づける画面です。',
    body:
      '出席フォームを紐づけると、参加者画面に出席タブが表示され、Q&Aや投票と同じ画面から出席登録できます。位置情報チェックやクールダウンなど、既存の出席フォーム設定はそのまま適用されます。授業やイベントで「同じURLから質問、投票、出席まで完結させたい」場合に便利です。',
    tips: ['紐づけ可能なフォームがない場合は、先にフォーム管理で作成してください。', '紐づけはいつでも解除できます。'],
  },
  {
    id: 'host-export',
    title: 'ホスト管理: エクスポート',
    icon: ClipboardCheck,
    summary: 'Q&Aとライブ投票結果をCSVで出力する画面です。',
    body:
      '質問一覧、いいね数、回答済み状態、投票結果などをCSV形式でダウンロードできます。ライブ投票は全カードまとめて出力することも、特定のカードだけを選んで出力することもできます。出席フォームを連携している場合は、ルームサマリーで出席数も確認できます。',
    tips: ['イベント後の分析やレポート作成に使えます。', '投票の出力対象は確認画面で選択します。'],
  },
];

export default function AdminFAQPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) router.push('/admin/login');
  }, [router, session, status]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5f5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2864f0]" />
      </div>
    );
  }

  return (
    <AdminShell activeSection="faq">
      <div className="space-y-6">
        <div className="-mx-4 -mt-6 border-b border-[#aac8ff] bg-[#ebf3ff] px-4 py-5 sm:-mx-6 sm:-mt-8 sm:px-6">
          <div className="flex items-center gap-3">
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
