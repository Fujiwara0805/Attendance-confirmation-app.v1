'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  MessageCircleQuestion,
  BarChart3,
  Monitor,
  UserRoundX,
  Laptop,
  ArrowRight,
  FileText,
} from 'lucide-react';
import LPHeader from '@/app/components/LPHeader';
import LPFooter from '@/app/components/LPFooter';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const features = [
  {
    title: 'Q&Aで参加者の疑問を集める',
    description:
      '参加者はスマートフォンから質問を投稿でき、「いいね」の多い質問が自動的に上位へ表示されます。匿名投稿にも対応しているため、発言しにくい参加者からも率直な質問が集まり、講演やセミナーの内容を深められます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358294/felicia-buitenwerf-Qs_Zkak27Jk-unsplash_ljjxwq.jpg',
    icon: MessageCircleQuestion,
    reverse: false,
  },
  {
    title: '投票・クイズで意見を集約',
    description:
      '用途に応じて4つの形式から選べます。意見を集める「通常投票」、正解を設定できる「クイズ」（制限時間・正答率表示・画像添付・複数問の連続出題に対応）、候補を順位付けして集計する「ランキング」、短い回答を付箋で集めて分類する「ブレスト」。回答はその場でグラフとして可視化されます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358337/flipsnack-LUqSTRx3_Ig-unsplash_b4hkct.jpg',
    icon: BarChart3,
    reverse: true,
  },
  {
    title: 'スライドに重ねてスクリーン投影',
    description:
      '資料投影画面では、Canva・Googleスライドなどを投影しながら、Q&Aや投票・クイズの結果を同じ画面に重ねて表示できます。スライドを切り替えることなく、参加者の反応を会場全体でリアルタイムに共有できます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358479/product-school-lVTtqIY6pL0-unsplash_pfrzxn.jpg',
    icon: Monitor,
    reverse: false,
  },
  {
    title: '登録不要・匿名で参加',
    description:
      '参加者はアプリのインストールも会員登録も不要です。QRコードを読み取るだけで、匿名のまま質問や投票に参加できます。参加のハードルを下げることで、より多くの率直な声が集まります。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774403129/redd-francisco-5U_28ojjgms-unsplash_blguut.jpg',
    icon: UserRoundX,
    reverse: true,
  },
  {
    title: '複数端末での同時運用',
    description:
      '受付用・スクリーン投影用・管理用を、同一アカウントで同時に運用できます。端末ごとに役割へ最適化された画面を表示できるため、運営チームで分担しながらスムーズに進行できます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774403542/adam-nowakowski-D4LDw5eXhgg-unsplash_v7clmg.jpg',
    icon: Laptop,
    reverse: false,
  },
  {
    title: '終わったあとは、セッションレポートに残る',
    description:
      '実施した投票・クイズの結果やQ&Aのハイライトは、終了後に1枚のセッションレポートにまとまります。印刷・PDF保存・CSV出力に対応し、授業の振り返りや研修の報告資料にそのまま使えます。出席フォームと連携すれば、出席の記録も同じレポートに並びます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357507/stephen-dawson-qwtCeJ5cLYs-unsplash_mobp9w.jpg',
    icon: FileText,
    reverse: true,
  },
];

export default function LiveInteractionPage() {
  return (
    <>
      <LPHeader />

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50 pt-24">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeIn}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 ring-1 ring-indigo-100 px-3.5 py-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase text-indigo-600 mb-6">
                Q&A・投票・クイズ
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                Q&A・投票・
                <br className="hidden sm:block" />
                クイズで全員参加
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg">
                質問・投票・クイズ・ランキング・ブレストをその場で実施。集まった反応はスクリーンにリアルタイムで表示され、終了後はセッションレポートとして残ります。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 h-12 text-sm sm:text-base font-semibold text-white shadow-lg shadow-indigo-200/50 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                >
                  無料で始める
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/#features"
                  className="inline-flex items-center gap-2 rounded-xl ring-1 ring-slate-200 bg-white px-6 h-12 text-sm sm:text-base font-semibold text-slate-700 transition-all hover:ring-indigo-200 hover:text-indigo-600"
                >
                  他の機能を見る
                </Link>
              </div>
            </motion.div>

            <motion.div
              {...fadeIn}
              transition={{ ...fadeIn.transition, delay: 0.15 }}
            >
              <img
src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774403349/israel-palacio-Y20JJ_ddy9M-unsplash_hkanai.jpg"
                alt="Q&A・投票・クイズのイメージ"
                className="rounded-2xl shadow-xl ring-1 ring-black/5 w-full h-auto object-cover aspect-[4/3]"
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Feature Sections ─── */}
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

        return (
          <section key={feature.title} className={bgClass}>
            <div className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                {/* Text */}
                <motion.div
                  {...fadeIn}
                  className={feature.reverse ? 'lg:order-2' : undefined}
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 text-indigo-600 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    {feature.title}
                  </h2>
                  <p className="mt-4 text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed max-w-md">
                    {feature.description}
                  </p>
                </motion.div>

                {/* Image */}
                <motion.div
                  {...fadeIn}
                  transition={{ ...fadeIn.transition, delay: 0.1 }}
                  className={feature.reverse ? 'lg:order-1' : undefined}
                >
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="rounded-2xl shadow-xl ring-1 ring-black/5 w-full h-auto object-cover aspect-[4/3]"
                    loading="lazy"
                    decoding="async"
                  />
                </motion.div>
              </div>
            </div>
          </section>
        );
      })}

      {/* ─── Final CTA ─── */}
      <section className="bg-gradient-to-br from-indigo-600 to-blue-700">
        <div className="mx-auto max-w-3xl px-5 py-20 lg:py-28 text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              次の講演を、もっとインタラクティブに。
            </h2>
            <p className="mt-4 text-base sm:text-lg text-indigo-100 leading-relaxed">
              初期費用ゼロ、セットアップは1分。まずは無料プランで始めてみてください。
            </p>
            <div className="mt-8">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 h-12 text-sm sm:text-base font-semibold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50 active:scale-[0.98]"
              >
                無料で始める
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <LPFooter />
    </>
  );
}
