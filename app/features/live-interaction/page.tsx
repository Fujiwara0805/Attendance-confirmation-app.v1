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
    title: 'Q&Aで対話を生み出す',
    description:
      '参加者からの質問をリアルタイムで受け付け、いいね機能により注目度の高いトピックを自動的に上位表示します。匿名投稿にも対応しているため、普段は発言しにくい参加者からも本音の質問が集まり、講演やセミナーの質を大幅に向上させます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358294/felicia-buitenwerf-Qs_Zkak27Jk-unsplash_ljjxwq.jpg',
    icon: MessageCircleQuestion,
    reverse: false,
  },
  {
    title: '投票で全員の声を集める',
    description:
      'ライブ投票機能で、参加者の意見やフィードバックを瞬時に集計・可視化します。選択肢型からスケール評価まで多様な形式に対応し、会議やワークショップでの意思決定をその場で加速。データに基づいた議論が即座に始められます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358337/flipsnack-LUqSTRx3_Ig-unsplash_b4hkct.jpg',
    icon: BarChart3,
    reverse: true,
  },
  {
    title: 'スクリーンにリアルタイム投影',
    description:
      'プレゼンテーションモードを使えば、Q&Aの質問一覧や投票結果をプロジェクターやモニターにライブ表示できます。会場全体で情報を共有することで、参加者のエンゲージメントが高まり、一体感のあるインタラクティブな空間を演出します。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774358479/product-school-lVTtqIY6pL0-unsplash_pfrzxn.jpg',
    icon: Monitor,
    reverse: false,
  },
  {
    title: '匿名で安心して参加',
    description:
      '参加者はアカウント登録やログインが一切不要。QRコードを読み取るだけで匿名のまま質問や投票に参加できます。心理的なハードルを取り除くことで、より多くの参加者から率直なフィードバックや質問を引き出すことが可能です。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774403129/redd-francisco-5U_28ojjgms-unsplash_blguut.jpg',
    icon: UserRoundX,
    reverse: true,
  },
  {
    title: '複数端末での同時運用',
    description:
      '受付端末、スクリーン投影端末、管理端末を同一アカウントで同時に運用できます。それぞれの端末が役割に最適化された画面を表示するため、セミナーやカンファレンスの運営チーム全体がリアルタイムに連携し、スムーズなイベント進行を実現します。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774403542/adam-nowakowski-D4LDw5eXhgg-unsplash_v7clmg.jpg',
    icon: Laptop,
    reverse: false,
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
              <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-semibold text-indigo-700 mb-6">
                リアルタイムQ&A・ライブ投票
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] leading-[1.15]">
                リアルタイムQ&A・
                <br className="hidden sm:block" />
                ライブ投票
              </h1>
              <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-lg">
                参加者全員が声を届けられる、双方向コミュニケーションを実現
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  無料で始める
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/#features"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600"
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
                alt="リアルタイムQ&A・ライブ投票のイメージ"
                className="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/3]"
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
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                    {feature.title}
                  </h2>
                  <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-md">
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
                    className="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/3]"
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
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              次の講演を、もっとインタラクティブに。
            </h2>
            <p className="mt-4 text-indigo-100 text-lg leading-relaxed">
              初期費用ゼロ、セットアップは1分。まずは無料プランで始めてみてください。
            </p>
            <div className="mt-8">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-indigo-700 shadow-lg transition hover:bg-indigo-50"
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
