'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Megaphone, Rocket, RefreshCw, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true },
};

const child = {
  initial: { opacity: 0, y: 16 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  viewport: { once: true },
};

type TagType = 'リリース' | 'アップデート' | 'お知らせ';

const tagConfig: Record<TagType, { color: string; bg: string; icon: React.ElementType }> = {
  リリース: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Rocket },
  アップデート: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: RefreshCw },
  お知らせ: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Info },
};

const announcements: { date: string; tag: TagType; description: string }[] = [
  {
    date: '2026.03.19',
    tag: 'リリース',
    description:
      '招待フォーム機能をリリースしました。イベントの参加確認を招待フォームを使うことで、招待フォーム→事前登録→QRコード発行→当日受付の一気通貫フローを実現できます。招待フォームビルダー、日時スロット選択、回答一覧管理、CSV出力機能を搭載。',
  },
  {
    date: '2026.03.17',
    tag: 'リリース',
    description:
      'ざせきくん v2.0をリリースしました。Q&A・投票機能、カスタムフォーム機能を追加。',
  },
  {
    date: '2026.03.10',
    tag: 'アップデート',
    description:
      'Google Places連携による位置情報検索機能を追加しました。',
  },
  {
    date: '2026.03.01',
    tag: 'お知らせ',
    description:
      'Proプラン（月額550円）の提供を開始しました。無制限のフォーム・ルーム作成が可能に。',
  },
];

export default function NewsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
              戻る
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <motion.div {...fadeIn} className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200">
            <Megaphone className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            お知らせ
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            ざせきくんの最新情報をお届けします
          </p>
        </motion.div>

        <motion.div {...stagger} className="space-y-4">
          {announcements.map((item, idx) => {
            const tag = tagConfig[item.tag];
            const TagIcon = tag.icon;

            return (
              <motion.div key={idx} {...child}>
                <Card className="overflow-hidden border-slate-200/80 bg-white/70 backdrop-blur-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="shrink-0 text-sm font-medium text-slate-400">
                        {item.date}
                      </span>
                      <div className="flex-1 space-y-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.bg} ${tag.color}`}
                        >
                          <TagIcon className="h-3 w-3" />
                          {item.tag}
                        </span>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </main>
    </div>
  );
}
