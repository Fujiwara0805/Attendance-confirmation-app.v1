'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import LPHeader from '@/app/components/LPHeader';
import LPFooter from '@/app/components/LPFooter';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const faqItems = [
  {
    question: 'ざせきくんとは何ですか？',
    answer:
      'ざせきくんは、出席管理・招待フォーム・リアルタイムQ&A・ライブ投票をひとつにまとめたイベント運営プラットフォームです。授業、セミナー、カンファレンス、ワークショップなど、あらゆる学習・イベントシーンで活用いただけます。',
  },
  {
    question: '無料プランではどこまで使えますか？',
    answer:
      '無料プランでは、フォーム3個・ルーム2個まで作成可能です。Q&A・投票機能、位置情報による出席管理、招待フォーム・事前登録、CSV/Excelエクスポート、QRコード生成、カスタムフォーム作成のすべての機能をご利用いただけます。',
  },
  {
    question: '参加者はアプリのインストールが必要ですか？',
    answer:
      'いいえ、参加者はアプリのインストールもログインも不要です。QRコードやURLからスマホのブラウザでそのままアクセスし、すぐに出席登録・質問投稿・投票に参加できます。',
  },
  {
    question: '位置情報はどのように使われますか？',
    answer:
      '位置情報は出席登録時に、参加者が対象エリア内にいることを確認するために使用されます。GPS連携により、会場外からの不正な出席登録（代理出席など）を防止します。位置情報の利用は任意で、管理者がフォームごとにON/OFFを設定できます。',
  },
  {
    question: 'Q&Aや投票にログインは必要ですか？',
    answer:
      '参加者側はログイン不要です。ルームコードまたはQRコードでアクセスするだけで、匿名で質問投稿や投票に参加できます。管理者（ホスト）側のみ、ログインが必要です。',
  },
  {
    question: '同一アカウントで複数端末にログインできますか？',
    answer:
      'はい、可能です。同一アカウントで複数の端末に同時ログインできます。例えば、受付用端末でQRコードスキャン、スクリーン投影用端末でライブQ&A・投票を表示、管理用端末でデータ確認、といった同時運用が可能です。',
  },
  {
    question: 'データのエクスポートは可能ですか？',
    answer:
      'はい。出席データ、Q&Aの質問一覧、投票結果などをCSV形式でエクスポートできます。Excelやスプレッドシートでの分析に活用いただけます。',
  },
  {
    question: 'セキュリティ対策はどうなっていますか？',
    answer:
      'パスワードはbcryptによるハッシュ化、通信はSSL/TLS暗号化で保護されています。Google OAuth認証にも対応しており、安全にご利用いただけます。',
  },
  {
    question: '料金プランの違いは何ですか？',
    answer:
      'Freeプラン（¥0/月）はフォーム3個・ルーム2個まで、Proプラン（¥550/月）はフォーム・ルーム無制限＋優先サポート、Enterpriseプラン（¥2,000/月）はさらに複数端末での同時運用サポートが含まれます。すべてのプランで全機能をご利用いただけます。',
  },
  {
    question: '解約はいつでもできますか？',
    answer:
      'はい、いつでも解約可能です。解約後も現在の請求期間が終了するまでプランの機能をご利用いただけます。解約手数料等は一切かかりません。',
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <>
      <LPHeader />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero */}
        <section className="pt-24 pb-12">
          <div className="mx-auto max-w-3xl px-5 pt-16 text-center">
            <motion.div {...fadeIn}>
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
                <HelpCircle className="h-7 w-7 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                よくある質問
              </h1>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                ざせきくんに関するよくあるご質問をまとめました。
                <br className="hidden sm:block" />
                お探しの回答が見つからない場合は、お気軽にお問い合わせください。
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ Items */}
        <section className="pb-20">
          <div className="mx-auto max-w-3xl px-5">
            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <motion.div
                  key={index}
                  {...fadeIn}
                  transition={{
                    duration: 0.5,
                    ease: [0.25, 0.46, 0.45, 0.94],
                    delay: index * 0.04,
                  }}
                >
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <button
                      onClick={() => toggleItem(index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-sm font-semibold text-slate-900 sm:text-base">
                        {item.question}
                      </span>
                      <motion.div
                        animate={{ rotate: openIndex === index ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="flex-shrink-0"
                      >
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {openIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-100 px-6 pb-5 pt-4">
                            <p className="text-sm leading-relaxed text-slate-600">
                              {item.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <div className="mx-auto max-w-3xl px-5">
            <motion.div
              {...fadeIn}
              className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 px-8 py-12 text-center shadow-lg"
            >
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                他にご質問はありますか？
              </h2>
              <p className="mt-3 text-sm text-indigo-100 sm:text-base">
                お気軽にメールでお問い合わせください。サポートチームが迅速にお答えいたします。
              </p>
              <a
                href="mailto:support@zasekikun.com"
                className="mt-6 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50"
              >
                お問い合わせはこちら
              </a>
            </motion.div>
          </div>
        </section>
      </main>
      <LPFooter />
    </>
  );
}
