'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, ChevronLeft } from 'lucide-react';
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
    title: '位置情報で不正を防止',
    description:
      'GPS連携により、対象エリア内にいる参加者だけが出席登録を行えます。代理出席やなりすましを技術的に防止し、正確な出席データを確保します。ジオフェンス機能で対象エリアを柔軟に設定でき、教室・会場・オフィスなどあらゆるシーンに対応可能です。',
    image:
      'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357308/charlesdeluvio-Lks7vei-eAg-unsplash_offkod.jpg',
    alt: '位置情報による不正防止のイメージ',
  },
  {
    title: 'QRコードで即完了',
    description:
      '参加者はアプリのダウンロードもログインも不要。QRコードをスマートフォンで読み取るだけで、わずか数秒で出席登録が完了します。受付の混雑を解消し、イベントや授業の開始をスムーズにします。',
    image:
      'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357428/marc-pineda-FT5kTEisT4k-unsplash_jfhitk.jpg',
    alt: 'QRコードスキャンのイメージ',
  },
  {
    title: 'データをリアルタイム集計',
    description:
      'すべての出席データを自動で集計し、ダッシュボード上でリアルタイムに可視化します。出席率の推移や参加者の傾向を一目で把握でき、CSVエクスポート機能で外部ツールでの詳細な分析にもスムーズに連携できます。',
    image:
      'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357507/stephen-dawson-qwtCeJ5cLYs-unsplash_mobp9w.jpg',
    alt: 'リアルタイムデータ集計のイメージ',
  },
  {
    title: '1,000人規模でも安定稼働',
    description:
      '数百人から1,000人を超える大規模イベントでも、遅延やダウンタイムなく安定して動作します。堅牢なクラウドインフラによるオートスケーリングで、参加者が急増しても快適なレスポンスを維持。大学の講義からカンファレンスまで、あらゆる規模に対応します。',
    image:
      'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357569/alexandre-pellaes-6vAjp0pscX0-unsplash_dfsotz.jpg',
    alt: '大規模イベントのイメージ',
  },
];

export default function AttendanceFeaturePage() {
  return (
    <>
      <LPHeader />

      <main className="pt-16">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 to-white">
          <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div {...fadeIn}>
                <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 px-3.5 py-1.5 rounded-full mb-6">
                  出席管理
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
                  出席管理フォーム
                </h1>
                <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg">
                  位置情報×QRコードで、不正のない正確な出席管理を実現
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/admin/login"
                    className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all px-6 h-12 rounded-xl shadow-lg shadow-indigo-200/50"
                  >
                    無料で始める
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/#features"
                    className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition-all px-6 h-12 rounded-xl"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    他の機能を見る
                  </Link>
                </div>
              </motion.div>

              <motion.div
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: 0.1 }}
              >
                <img
src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_800/v1774357674/dom-fou-YRMWVcdyhmI-unsplash_sq9hvg.jpg"
                  alt="教室での出席管理のイメージ"
                  className="rounded-2xl shadow-xl ring-1 ring-black/5 w-full h-auto object-cover aspect-[4/3]"
                  loading="lazy"
                  decoding="async"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Feature Sections ── */}
        {features.map((feature, index) => {
          const isReversed = index % 2 !== 0;
          const bgClass =
            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

          return (
            <section key={feature.title} className={bgClass}>
              <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  {/* Text */}
                  <motion.div
                    {...fadeIn}
                    className={isReversed ? 'lg:order-2' : ''}
                  >
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
                    className={isReversed ? 'lg:order-1' : ''}
                  >
                    <img
                      src={feature.image}
                      alt={feature.alt}
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

        {/* ── Final CTA ── */}
        <section className="bg-gradient-to-b from-indigo-50/80 to-white">
          <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
            <motion.div
              {...fadeIn}
              className="text-center max-w-2xl mx-auto"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                出席管理を、もっとスマートに。
              </h2>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed">
                初期費用ゼロ、セットアップは1分。まずは無料プランで始めてみてください。
              </p>
              <div className="mt-8">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all px-8 h-12 rounded-xl shadow-lg shadow-indigo-200/50"
                >
                  無料で始める
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <LPFooter />
    </>
  );
}
