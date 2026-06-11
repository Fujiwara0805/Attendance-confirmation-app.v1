'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileText,
  HelpCircle,
  Lock,
  Search,
  Smartphone,
  Users,
} from 'lucide-react';
import LPHeader from '@/app/components/LPHeader';
import LPFooter from '@/app/components/LPFooter';

const categories = [
  {
    id: 'overview',
    title: 'サービス概要',
    icon: HelpCircle,
    items: [
      {
        question: 'ざせきくんとは何ですか？',
        answer:
          'ざせきくんは、Q&A・ワーク機能（投票・クイズ・ランキング・ブレスト）・出席管理・招待フォームをひとつにまとめたサービスです。授業・ゼミ・セミナー・イベントなどで、受付から参加者とのやりとり、終了後のセッションレポート・データ出力までを同じサービスで扱えます。',
      },
      {
        question: '参加者はアプリのインストールが必要ですか？',
        answer:
          'いいえ、参加者はアプリをインストールする必要がありません。QRコードやURLを開くだけで、スマートフォンのブラウザから出席登録、Q&Aへの質問投稿、ワークツールへの参加ができます。参加者側のログインも不要です。',
      },
    ],
  },
  {
    id: 'forms',
    title: 'フォーム・出席管理',
    icon: FileText,
    items: [
      {
        question: '出席フォームでは何ができますか？',
        answer:
          '出席フォームでは、名前、所属、学年、レポートなどの項目を使って参加者の出席情報を集められます。カスタムフォームでは項目を追加・削除・並び替えできるため、授業やイベントの運用に合わせて入力内容を調整できます。',
      },
      {
        question: '位置情報はどのように使われますか？',
        answer:
          '位置情報は、出席登録時に参加者が対象エリア内にいるか確認するために使われます。GPS連携により、会場外からの代理出席やなりすましを抑止できます。位置情報チェックはフォームごとにON/OFFを設定できます。',
      },
    ],
  },
  {
    id: 'rooms',
    title: 'Q&A・ワークツール',
    icon: BarChart3,
    items: [
      {
        question: 'Q&Aやワークツールにログインは必要ですか？',
        answer:
          '参加者側のログインは不要です。ルームコード、QRコード、URLのいずれかからアクセスすると、匿名で質問を投稿したり回答に参加したりできます。ホスト管理画面を操作する管理者のみログインが必要です。',
      },
      {
        question: 'ワークツールではどのような形式を使えますか？',
        answer:
          '通常投票、クイズ形式、ランキング形式、ブレスト形式を利用できます。通常投票は選択肢から回答する基本形式、クイズ形式では正解を設定でき、ランキング形式では候補を順位で回答してもらい順位ごとの重みで集計できます。ブレスト形式は参加者の短い自由回答を付箋カードとして集め、先生がスクリーン上でドラッグして分類できる形式です。',
      },
      {
        question: 'ブレスト形式では参加者は何回も回答できますか？',
        answer:
          'はい。ブレスト形式では参加者は思いついたことを何度でも投稿でき、自分の投稿はその場で編集・削除できます。集まった回答は付箋カードとしてスクリーンにリアルタイム表示され、先生は画面上で自由に分類（グルーピング）できます。',
      },
    ],
  },
  {
    id: 'data',
    title: 'データ出力',
    icon: ClipboardList,
    items: [
      {
        question: 'データのエクスポートは可能ですか？',
        answer:
          'はい。出席データ、フォーム回答、Q&Aの質問一覧、ワークツール結果をCSV形式で出力できます。フォームの回答データはJSON形式でも出力できるため、Excel、スプレッドシート、外部分析ツールでの集計に利用できます。',
      },
      {
        question: 'セッションレポートとは何ですか？',
        answer:
          'ルームで実施した投票・クイズの結果、Q&Aのハイライト、参加者数を1枚にまとめたレポートです。ホスト画面からいつでも開け、印刷・PDF保存・CSV出力に対応しています。出席フォームと連携しているルームでは出席数も同じレポートに表示されるため、授業の振り返りや研修の報告資料にそのまま使えます。',
      },
    ],
  },
  {
    id: 'account',
    title: 'アカウント・料金',
    icon: Users,
    items: [
      {
        question: '無料プランではどこまで使えますか？',
        answer:
          '無料プランでは、フォーム2個・ルーム1個まで作成できます。Q&A、投票、位置情報による出席管理、招待フォーム、CSV/Excelエクスポート、QRコード生成、カスタムフォーム作成など、主要機能を試せます。',
      },
      {
        question: '解約はいつでもできますか？',
        answer:
          'はい、いつでも解約できます。解約後も現在の請求期間が終了するまでは有料プランの機能を利用できます。解約手数料はかかりません。',
      },
    ],
  },
  {
    id: 'security',
    title: 'セキュリティ',
    icon: Lock,
    items: [
      {
        question: 'セキュリティ対策はどうなっていますか？',
        answer:
          'パスワードはハッシュ化して保存し、通信はSSL/TLSで暗号化されます。Google OAuth認証にも対応しています。参加者側はログイン不要で利用できるため、イベント当日の参加ハードルを下げながら、管理者側の操作はログインで保護します。',
      },
      {
        question: '複数端末で同時に使えますか？',
        answer:
          'はい、同一アカウントで複数端末にログインできます。受付端末、スクリーン投影端末、管理端末を分けて運用できるため、イベントスタッフが役割ごとに操作できます。',
      },
      {
        question: 'データはどこに保存されますか？削除はできますか？',
        answer:
          'データは国内（東京リージョン）のSupabaseに暗号化して保存されます。フォーム・ルームのデータは管理画面からいつでも削除でき、アカウント削除時にはすべてのデータが削除されます。詳しくは「セキュリティとデータの取り扱い」ページをご覧ください。',
      },
      {
        question: '大学・法人での導入時、請求書払いはできますか？',
        answer:
          'はい、法人・教育機関向けに銀行振込（請求書払い）に対応しており、見積書・請求書・納品書の発行も可能です。研究費や部署予算でのお支払いにもご利用いただけます。お問い合わせフォームからご相談ください。',
      },
      {
        question: '位置情報は何に使われますか？参加者に説明できますか？',
        answer:
          '位置情報は、主催者が位置確認を有効にしたフォームでのみ、参加者の許可を得て取得し、対象エリア内からの登録かどうかの確認だけに使用します。移動の追跡は行いません。参加者画面にも同じ説明を表示しているため、そのままアナウンスにお使いいただけます。',
      },
      {
        question: '不正出席は完全に防げますか？',
        answer:
          '完全には防げません。ざせきくんはQRコード・位置情報・連続登録の制限を組み合わせて不正のコストを大きく上げる仕組みで、紙の出席表やExcelよりはるかに確実な運用記録を残せます。一方で参加者の本人認証は行わないため、厳格な本人確認が必要な用途では組織の規程に照らした確認をお願いしています。',
      },
    ],
  },
];

const allItems = categories.flatMap((category) =>
  category.items.map((item) => ({ ...item, category: category.title, categoryId: category.id }))
);

export default function FAQPage() {
  const router = useRouter();
  const { status } = useSession();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>('overview-0');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/admin/faq');
  }, [router, status]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return allItems;
    return allItems.filter((item) =>
      [item.question, item.answer, item.category].join(' ').toLowerCase().includes(keyword)
    );
  }, [query]);

  return (
    <>
      <LPHeader />
      <main className="min-h-screen bg-[#f7f5f5]">
        <section className="border-b border-[#dce8ff] bg-[#ebf3ff] pt-24">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-[#2864f0]">サポート</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#323232] sm:text-4xl">
                何にお困りですか？
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#595959] sm:text-base">
                ざせきくんの基本的な使い方、出席管理、Q&A、ワークツール、データ出力について確認できます。
              </p>
            </div>
            <div className="relative mt-8 max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8c8989]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="キーワードで検索"
                className="h-12 w-full rounded-md border border-[#aac8ff] bg-white pl-11 pr-4 text-sm text-[#323232] outline-none focus:border-[#2864f0] focus:ring-2 focus:ring-[#dce8ff]"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-[#e9e7e7] bg-white p-3">
              <p className="px-2 pb-2 text-xs font-bold text-[#8c8989]">カテゴリ</p>
              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon;
                  return (
                    <a
                      key={category.id}
                      href={`#${category.id}`}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-bold text-[#323232] hover:bg-[#ebf3ff]"
                    >
                      <Icon className="h-4 w-4 text-[#2864f0]" />
                      {category.title}
                    </a>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="space-y-8">
            {query.trim() ? (
              <section className="rounded-lg border border-[#e9e7e7] bg-white p-5">
                <h2 className="text-base font-bold text-[#323232]">検索結果</h2>
                <div className="mt-4 divide-y divide-[#e9e7e7]">
                  {filteredItems.map((item, index) => {
                    const key = `search-${index}`;
                    const open = openKey === key;
                    return (
                      <FAQRow
                        key={key}
                        item={item}
                        open={open}
                        onToggle={() => setOpenKey(open ? null : key)}
                      />
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <p className="py-8 text-sm text-[#595959]">一致する質問はありません。</p>
                  )}
                </div>
              </section>
            ) : (
              categories.map((category) => {
                const Icon = category.icon;
                return (
                  <section
                    key={category.id}
                    id={category.id}
                    className="scroll-mt-24 rounded-lg border border-[#e9e7e7] bg-white p-5"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-[#2864f0]" />
                      <h2 className="text-base font-bold text-[#323232]">{category.title}</h2>
                    </div>
                    <div className="mt-4 divide-y divide-[#e9e7e7]">
                      {category.items.map((item, index) => {
                        const key = `${category.id}-${index}`;
                        const open = openKey === key;
                        return (
                          <FAQRow
                            key={key}
                            item={{ ...item, category: category.title }}
                            open={open}
                            onToggle={() => setOpenKey(open ? null : key)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}

            <section className="rounded-lg border border-[#dce8ff] bg-[#f3f7ff] p-5">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 text-[#2864f0]" />
                <div>
                  <h2 className="text-base font-bold text-[#323232]">解決しない場合</h2>
                  <p className="mt-1 text-sm leading-7 text-[#595959]">
                    詳しい状況を添えてお問い合わせください。管理者としてログインしている場合は、管理者向けサポートページに自動で移動します。
                  </p>
                  <a
                    href="mailto:sobota@nobody-info.com"
                    className="mt-3 inline-flex h-9 items-center rounded-md bg-[#2864f0] px-4 text-sm font-bold text-white hover:bg-[#285ac8]"
                  >
                    お問い合わせ
                  </a>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
      <LPFooter />
    </>
  );
}

function FAQRow({
  item,
  open,
  onToggle,
}: {
  item: { question: string; answer: string; category?: string };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span>
          {item.category && <span className="block text-[11px] font-bold text-[#2864f0]">{item.category}</span>}
          <span className="mt-1 block text-sm font-bold text-[#323232] sm:text-base">{item.question}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#8c8989] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm leading-7 text-[#595959]">{item.answer}</p>}
    </div>
  );
}
