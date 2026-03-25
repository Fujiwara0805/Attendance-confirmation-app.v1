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
    title: '招待フォームで事前登録',
    description:
      'イベントの参加確認を招待フォームで効率化。招待フォーム→事前登録→QRコード発行→当日受付の一気通貫フローを実現できます。SNSやメールでフォームのURLを共有するだけで参加者が簡単に登録でき、主催者の手作業を大幅に削減します。',
    image:
      'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto/v1774357984/annie-spratt-vgbLaqJGEbY-unsplash_r4m6mq.jpg',
    reverse: false,
  },
  {
    title: 'QRコードで当日受付を簡素化',
    description:
      '事前登録が完了した参加者には、個別のQRコードが自動で発行されます。当日はスマートフォンに表示されたQRコードをスキャンするだけで受付が完了するため、長蛇の列や紙の名簿チェックはもう不要。受付スタッフの負担も最小限に抑えられます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto/v1774402426/helena-lopes-yIcm3DWRz-c-unsplash_ezy6vc.jpg',
    reverse: true,
  },
  {
    title: '参加者データを一元管理',
    description:
      '誰が事前登録し、誰が当日実際に出席したかをリアルタイムで一元管理できます。ダッシュボードで参加状況を即座に確認でき、CSVエクスポート機能で社内報告やマーケティング分析にも活用可能。イベント後のフォローアップも効率的に行えます。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto/v1774402502/myriam-jessier-eveI7MOcSmw-unsplash_zw0jks.jpg',
    reverse: false,
  },
  {
    title: 'カスタムフォームで柔軟に対応',
    description:
      '参加者の所属・役職・食事制限・Tシャツサイズなど、イベントの内容に合わせた入力項目を自由に追加できます。必要な情報を事前に漏れなく収集できるため、当日の準備や手配がスムーズになり、参加者の満足度向上にもつながります。',
    image:
'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto/v1774358129/headway-5QgIuuBxKwM-unsplash_xabba5.jpg',
    reverse: true,
  },
];

export default function InvitationFeaturePage() {
  return (
    <>
      <LPHeader />

      {/* ── Hero ── */}
      <section className="pt-24 pb-16 md:pb-24 bg-gradient-to-b from-indigo-50 to-white">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeIn}>
              <p className="inline-block text-xs font-semibold tracking-wider uppercase text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full mb-5">
                招待フォーム・参加者管理
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
                招待フォーム・
                <br className="hidden sm:block" />
                参加者管理
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg">
                SNS告知から事前登録、QRコード発行、当日受付まで一気通貫
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] transition-all px-6 py-3 rounded-xl shadow-sm"
                >
                  無料で始める
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/#features"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 transition-all px-6 py-3 rounded-xl"
                >
                  <ChevronLeft className="w-4 h-4" />
                  他の機能を見る
                </Link>
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ ...fadeIn.transition, delay: 0.1 }}>
              <img
src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto/v1774402879/jakob-dalbjorn-cuKJre3nyYc-unsplash_usnazo.jpg"
                alt="イベント受付のイメージ"
                className="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/3]"
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Feature Sections ── */}
      {features.map((feature, i) => (
        <section
          key={feature.title}
          className={i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
        >
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                {...fadeIn}
                className={feature.reverse ? 'lg:order-2' : ''}
              >
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {feature.title}
                </h2>
                <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>

              <motion.div
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: 0.1 }}
                className={feature.reverse ? 'lg:order-1' : ''}
              >
                <img
                  src={feature.image}
                  alt={feature.title}
                  className="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/3]"
                  loading="lazy"
                />
              </motion.div>
            </div>
          </div>
        </section>
      ))}

      {/* ── Final CTA ── */}
      <section className="bg-gradient-to-b from-white to-indigo-50">
        <div className="mx-auto max-w-3xl px-5 py-20 md:py-28 text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              イベント受付を、シームレスに。
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              初期費用ゼロ、セットアップは1分。まずは無料プランで始めてみてください。
            </p>
            <div className="mt-8">
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] transition-all px-8 py-3.5 rounded-xl shadow-sm"
              >
                無料で始める
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <LPFooter />
    </>
  );
}
