'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin,
  ShieldCheck,
  Zap,
  BarChart3,
  Smartphone,
  Users,
  ArrowRight,
  CheckCircle2,
  Clock,
  Globe,
  Sparkles,
  ChevronDown,
  MessageSquare,
  Vote,
  Building2,
  Crown,
  Menu,
  X,
} from 'lucide-react';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
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

/* ─────────────────────────────── Features ─────────────────────────────── */

const features = [
  {
    icon: MapPin,
    title: '位置情報で不正を防止',
    description:
      'GPS連携で対象エリア内の参加者だけが登録可能。代理出席の心配はもう不要。',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Zap,
    title: 'QRコードで即完了',
    description:
      'ログイン不要。QRコードを読み取るだけで、参加者はすぐにアクションできる。',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: BarChart3,
    title: 'データをリアルタイム集計',
    description:
      'すべての回答を自動で集計・可視化。CSVエクスポートでデータ分析も簡単に。',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: ShieldCheck,
    title: '1,000人規模でも安定稼働',
    description:
      '大規模イベントでも遅延ゼロ。堅牢なクラウドインフラが安定したパフォーマンスを実現。',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Smartphone,
    title: 'どんな端末でも快適に',
    description:
      'モバイルファーストで設計。スマホ・タブレット・PCすべてで最適な体験を提供。',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: Users,
    title: '管理画面ですべて完結',
    description:
      'フォーム作成・ルーム管理・データ出力まで、ひとつのダッシュボードで。',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: MessageSquare,
    title: 'Q&Aで対話を生み出す',
    description:
      '参加者の質問をリアルタイム受付。いいね機能で注目トピックを可視化。匿名投稿にも対応。',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: Vote,
    title: '投票で全員の声を集める',
    description:
      'ライブ投票で意見やフィードバックを瞬時に集計。意思決定をその場で加速。',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
];

/* ─────────────────────────── How it Works ──────────────────────────── */

const steps = [
  {
    num: '01',
    title: 'イベントを設定',
    desc1: '出席フォーム、Q&Aルーム、投票を',
    desc2: '数クリックで作成。カスタマイズも自由自在。',
    icon: Globe,
  },
  {
    num: '02',
    title: 'QRコードで招待',
    desc1: 'QRコードとURLを参加者に共有。',
    desc2: 'アプリのインストールは一切不要。',
    icon: Sparkles,
  },
  {
    num: '03',
    title: '参加者がすぐアクション',
    desc1: 'スマホから出席登録、質問投稿、',
    desc2: '投票に参加。ワンタップで完了。',
    icon: CheckCircle2,
  },
  {
    num: '04',
    title: '結果をリアルタイムで確認',
    desc1: '回答をリアルタイムで集計・可視化。',
    desc2: 'データはCSVで即エクスポート。',
    icon: Clock,
  },
];

/* ─────────────────────────── Stats ──────────────────────────── */

const stats = [
  { value: '0.3秒', label: '平均登録時間' },
  { value: '99.9%', label: '稼働率' },
  { value: '1,000+', label: '同時アクセス対応' },
  { value: '0円', label: '初期費用' },
];

/* ═══════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleProPlan = async () => {
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'pro_subscription',
          successUrl: `${window.location.origin}/admin?payment=success`,
          cancelUrl: `${window.location.origin}/#pricing`,
        }),
      });
      if (res.status === 401) {
        // 未ログインの場合はログイン画面へ
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      window.location.href = '/admin/login';
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="ざせきくん" width={36} height={36} className="rounded-lg" />
            <span className="hidden sm:block text-lg font-bold tracking-tight text-slate-900">
              ざせきくん
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Desktop links */}
            <Link
              href="/rooms"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors px-3 py-2"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              ルームに参加
            </Link>
            <Link
              href="/admin/login"
              className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              管理者ログイン
            </Link>
            <Link
              href="/admin/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] transition-all px-4 py-2 rounded-xl shadow-sm"
            >
              無料で始める
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-5 py-4 space-y-1">
                <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  管理者ログイン
                </Link>
                <Link href="/rooms" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  ルームに参加
                </Link>
                <Link href="/news" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  お知らせ
                </Link>
                <Link href="/legal/privacy" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  プライバシーポリシー
                </Link>
                <Link href="/legal/terms" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  利用規約
                </Link>
                <div className="pt-2">
                  <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-xl">
                    無料で始める
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-5">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-indigo-100/60 via-blue-50/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 left-10 w-72 h-72 bg-violet-100/30 rounded-full blur-3xl" />
          <div className="absolute top-60 right-10 w-72 h-72 bg-cyan-100/30 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              出席管理 × リアルタイムQ&A × ライブ投票
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]"
          >
            全て学習機会を
            <br />
            「受け取る」から「共に作る」へ
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto"
          >
            出席管理・リアルタイムQ&A・
            <br className="sm:hidden" />
            ライブ投票を一つのプラットフォームに。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/admin/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] transition-all px-7 py-3.5 rounded-xl shadow-lg shadow-indigo-200/50"
            >
              無料で始める
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 active:scale-[0.97] transition-all px-7 py-3.5 rounded-xl"
            >
              機能を見る
              <ChevronDown className="w-4 h-4" />
            </a>
          </motion.div>
        </div>

        {/* Hero visual — mockup card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="relative rounded-2xl bg-white/80 backdrop-blur-xl shadow-2xl shadow-slate-200/60 ring-1 ring-slate-200/60 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/60">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                <div className="w-3 h-3 rounded-full bg-green-400/70" />
              </div>
              <div className="flex-1 mx-4">
                <div className="mx-auto max-w-sm h-6 bg-slate-100 rounded-md flex items-center justify-center">
                  <span className="text-[11px] text-slate-400 font-mono">zaseki-kun.com/attendance</span>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-10 space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <Image src={LOGO_URL} alt="" width={40} height={40} className="rounded-lg" />
                <div>
                  <p className="text-sm font-bold text-slate-900">イベント名 — 出席登録</p>
                  <p className="text-xs text-slate-400">2026年3月17日 月曜日</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-12 bg-slate-50 rounded-xl border-2 border-slate-100 flex items-center px-4">
                  <span className="text-sm text-slate-400">IDを入力</span>
                </div>
                <div className="h-12 bg-slate-50 rounded-xl border-2 border-slate-100 flex items-center px-4">
                  <span className="text-sm text-slate-400">お名前を入力</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>位置情報が確認されました — エリア内です</span>
              </div>
              <button className="w-full h-12 bg-indigo-600 rounded-xl text-white font-semibold text-sm shadow-md cursor-default">
                出席を登録する
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-12 border-y border-slate-100 bg-white/60 backdrop-blur-sm">
        <motion.div
          {...stagger}
          className="mx-auto max-w-5xl px-5 grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((s) => (
            <motion.div key={s.label} {...child} className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold text-gradient">{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ─── News ─── */}
      <section className="py-16 px-5">
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeIn} className="text-center mb-10">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              News
            </span>
            <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              お知らせ
            </h2>
          </motion.div>

          <motion.div {...stagger} className="space-y-3">
            {[
              { date: '2026.03.17', tag: 'リリース', tagColor: 'bg-blue-100 text-blue-700', title: 'ざせきくん v2.0をリリースしました。Q&A・投票機能、カスタムフォーム機能を追加。' },
              { date: '2026.03.10', tag: 'アップデート', tagColor: 'bg-emerald-100 text-emerald-700', title: 'Google Places連携による位置情報検索機能を追加しました。' },
              { date: '2026.03.01', tag: 'お知らせ', tagColor: 'bg-amber-100 text-amber-700', title: 'Proプラン（月額550円）の提供を開始しました。無制限のフォーム・ルーム作成が可能に。' },
            ].map((news, i) => (
              <motion.div
                key={i}
                {...child}
                className="flex gap-4 p-4 rounded-xl bg-white/80 border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="shrink-0 flex flex-col items-start gap-1.5">
                  <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{news.date}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${news.tagColor}`}>{news.tag}</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{news.title}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-6">
            <Link href="/news" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline transition-colors">
              すべてのお知らせを見る →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 sm:py-28 px-5">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeIn} className="text-center mb-14">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              Features
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              すべてが、
              <br className="sm:hidden" />
              ワンストップで完了。
            </h2>
            <p className="mt-4 text-base text-slate-500 max-w-xl mx-auto">
              必要な機能をひとつに集約。
              <br className="sm:hidden" />
              シンプルなのに、パワフル。
            </p>
          </motion.div>

          <motion.div
            {...stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                {...child}
                className="group glass-card p-6 card-hover cursor-default text-center"
              >
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${f.bg} ${f.color} mb-4 mx-auto`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-20 sm:py-28 px-5 bg-gradient-to-b from-slate-50/80 to-white">
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeIn} className="text-center mb-14">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              How it works
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              4ステップで、
              <br className="sm:hidden" />
              すぐにスタート。
            </h2>
          </motion.div>

          <motion.div
            {...stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {steps.map((s, i) => (
              <motion.div key={s.num} {...child} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+32px)] w-[calc(100%-64px)] h-px bg-gradient-to-r from-indigo-200 to-indigo-100" />
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4">
                  <s.icon className="w-7 h-7" />
                </div>
                <p className="text-xs font-bold text-indigo-400 tracking-widest uppercase mb-1">
                  Step {s.num}
                </p>
                <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">
                  {s.desc1}
                  <br className="sm:hidden" />
                  {s.desc2}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 sm:py-28 px-5">
        <motion.div
          {...fadeIn}
          className="mx-auto max-w-3xl text-center rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700 p-10 sm:p-14 shadow-2xl shadow-indigo-200/40 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />

          <div className="relative z-10">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              次のワークショップを、
              <br />
              もっとインタラクティブに。
            </h2>
            <p className="mt-4 text-base text-indigo-100 max-w-lg mx-auto">
              初期費用ゼロ、セットアップは1分。
              <br />
              まずは無料プランで、
              <br className="sm:hidden" />
              ざせきくんの力を体験してください。
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/admin/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-semibold text-indigo-700 bg-white hover:bg-indigo-50 active:scale-[0.97] transition-all px-7 py-3.5 rounded-xl shadow-lg"
              >
                無料で始める
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="py-20 sm:py-28 px-5 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeIn} className="text-center mb-14">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              Pricing
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              シンプルで、
              <br className="sm:hidden" />
              わかりやすい料金。
            </h2>
            <p className="mt-4 text-base text-slate-500 max-w-xl mx-auto">
              まずは無料で始めて、
              <br className="sm:hidden" />
              必要に応じてアップグレード。
            </p>
          </motion.div>

          <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free Plan */}
            <motion.div {...child} className="glass-card p-8 relative">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Free プラン</h3>
                <p className="text-sm text-slate-500 mt-1">個人利用・お試しに最適</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900">¥0</span>
                <span className="text-sm text-slate-400 ml-1">/ 月</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'フォーム 3個まで作成',
                  'ルーム 2個まで作成',
                  'Q&A・投票機能',
                  '位置情報による出席管理',
                  'CSV / Excelエクスポート',
                  'QRコード生成',
                  'カスタムフォーム作成',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/login"
                className="block w-full text-center text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] transition-all px-6 py-3 rounded-xl"
              >
                無料で始める
              </Link>
            </motion.div>

            {/* Pro Plan */}
            <motion.div {...child} className="glass-card p-8 relative ring-2 ring-indigo-500 shadow-xl shadow-indigo-100/40">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-1 rounded-full shadow-md">
                  <Crown className="w-3 h-3" />
                  おすすめ
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Pro プラン</h3>
                <p className="text-sm text-slate-500 mt-1">チーム・組織での本格運用に</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gradient">¥550</span>
                <span className="text-sm text-slate-400 ml-1">/ 月（税込）</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'フォーム 無制限',
                  'ルーム 無制限',
                  'Q&A・投票機能',
                  '位置情報による出席管理',
                  'CSV / Excelエクスポート',
                  'QRコード生成',
                  'カスタムフォーム作成',
                  '優先サポート',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleProPlan}
                className="block w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.97] transition-all px-6 py-3 rounded-xl shadow-lg shadow-indigo-200/50"
              >
                Proプランを始める
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Company Info ─── */}
      <section className="py-16 px-5 bg-slate-50/60">
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeIn} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              運営会社
            </h2>
          </motion.div>

          <motion.div {...fadeIn} className="glass-card p-6 sm:p-8">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {[
                  ['会社名', '株式会社Nobody'],
                  ['所在地', '大分県大分市大字旦野原700番地<br />大分大学研究マネジメント機構4階423'],
                  ['代表者', '藤原 泰樹'],
                  ['事業内容', 'SaaS開発・運営 / DXコンサルティング'],
                  ['お問い合わせ', 'sobota@nobody-info.com'],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-3 pr-4 text-slate-500 font-medium whitespace-nowrap w-32">{label}</td>
                    <td className="py-3 text-slate-800">
                      {label === 'お問い合わせ' ? (
                        <a href={`mailto:${value}`} className="text-indigo-600 hover:underline">{value}</a>
                      ) : value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-100 py-10 px-5 bg-white/60">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="ざせきくん" width={28} height={28} className="rounded-lg" />
            <span className="text-sm font-bold text-slate-900">ざせきくん</span>
            <span className="text-xs text-slate-400">by 株式会社Nobody</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/legal/privacy" className="hover:text-slate-900 transition-colors">
              プライバシーポリシー
            </Link>
            <Link href="/legal/terms" className="hover:text-slate-900 transition-colors">
              利用規約
            </Link>
            <a href="mailto:sobota@nobody-info.com" className="hover:text-slate-900 transition-colors">
              お問い合わせ
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-6xl mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} 株式会社Nobody. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
