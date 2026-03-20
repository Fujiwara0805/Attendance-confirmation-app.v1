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
  Mail,
  HelpCircle,
  ClipboardList,
  UserCheck,
  Mic2,
} from 'lucide-react';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

/* ─── Smooth animations (reduced for mobile) ─── */
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
};

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.06 } },
  viewport: { once: true },
};

const child = {
  initial: { opacity: 0, y: 10 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  viewport: { once: true },
};

/* ─── Features ─── */
const features = [
  {
    icon: MapPin,
    title: '位置情報で不正を防止',
    description: 'GPS連携で対象エリア内の参加者だけが登録可能。代理出席の心配はもう不要。',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Zap,
    title: 'QRコードで即完了',
    description: 'ログイン不要。QRコードを読み取るだけで、参加者はすぐにアクションできる。',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: BarChart3,
    title: 'データをリアルタイム集計',
    description: 'すべての回答を自動で集計・可視化。CSVエクスポートでデータ分析も簡単に。',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: ShieldCheck,
    title: '1,000人規模でも安定稼働',
    description: '大規模イベントでも遅延ゼロ。堅牢なクラウドインフラが安定したパフォーマンスを実現。',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Smartphone,
    title: 'どんな端末でも快適に',
    description: 'モバイルファーストで設計。スマホ・タブレット・PCすべてで最適な体験を提供。',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: Users,
    title: '管理画面ですべて完結',
    description: 'フォーム作成・ルーム管理・データ出力まで、ひとつのダッシュボードで。',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  {
    icon: MessageSquare,
    title: 'Q&Aで対話を生み出す',
    description: '参加者の質問をリアルタイム受付。いいね機能で注目トピックを可視化。匿名投稿にも対応。',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: Vote,
    title: '投票で全員の声を集める',
    description: 'ライブ投票で意見やフィードバックを瞬時に集計。意思決定をその場で加速。',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  {
    icon: Mail,
    title: '招待フォームで事前登録',
    description: 'イベントの参加確認を招待フォームを使うことで、招待フォーム→事前登録→QRコード発行→当日受付の一気通貫フローを実現できます。',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
];

/* ─── How it Works ─── */
const steps = [
  {
    num: '01',
    title: 'イベントを設定',
    desc1: '出席フォーム、招待フォーム、Q&Aルーム、投票を',
    desc2: '数クリックで作成。カスタマイズも自由自在。',
    icon: Globe,
  },
  {
    num: '02',
    title: 'QRコードで招待',
    desc1: 'QRコードとURLを参加者に共有。',
    desc2: '招待フォームで事前登録も可能。',
    icon: Sparkles,
  },
  {
    num: '03',
    title: '参加者がすぐアクション',
    desc1: 'スマホから出席登録、事前申込、質問投稿、',
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

/* ─── Stats ─── */
const stats = [
  { value: '0.3秒', label: '平均登録時間' },
  { value: '99.9%', label: '稼働率' },
  { value: '1,000+', label: '同時アクセス対応' },
  { value: '0円', label: '初期費用' },
];

/* ─── Products ─── */
const products = [
  {
    icon: ClipboardList,
    title: '出席管理フォーム',
    description: '位置情報×QRコードで、不正のない正確な出席管理を実現。',
    href: '/features/attendance',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=600&q=80',
    color: 'from-blue-600 to-indigo-600',
  },
  {
    icon: UserCheck,
    title: '招待フォーム・参加者管理',
    description: 'SNS告知から事前登録、QRコード発行、当日受付まで一気通貫。',
    href: '/features/invitation',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80',
    color: 'from-teal-600 to-emerald-600',
  },
  {
    icon: Mic2,
    title: 'リアルタイムQ&A・ライブ投票',
    description: '参加者全員が声を届けられる、双方向コミュニケーションを実現。',
    href: '/features/live-interaction',
    image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=600&q=80',
    color: 'from-orange-600 to-pink-600',
  },
];

/* ─── FAQ ─── */
const faqItems = [
  {
    q: 'ざせきくんとは何ですか？',
    a: 'ざせきくんは、出席管理・招待フォーム・リアルタイムQ&A・ライブ投票をひとつにまとめたイベント運営プラットフォームです。授業、セミナー、カンファレンス、ワークショップなど、あらゆる学習・イベントシーンで活用いただけます。',
  },
  {
    q: '無料プランではどこまで使えますか？',
    a: '無料プランでは、フォーム3個・ルーム2個まで作成可能です。Q&A・投票機能、位置情報による出席管理、招待フォーム・事前登録、CSV/Excelエクスポート、QRコード生成、カスタムフォーム作成のすべての機能をご利用いただけます。',
  },
  {
    q: '参加者はアプリのインストールが必要ですか？',
    a: 'いいえ、参加者はアプリのインストールもログインも不要です。QRコードやURLからスマホのブラウザでそのままアクセスし、すぐに出席登録・質問投稿・投票に参加できます。',
  },
  {
    q: '同一アカウントで複数端末にログインできますか？',
    a: 'はい、可能です。同一アカウントで複数の端末に同時ログインできます。例えば、受付用端末でQRコードスキャン、スクリーン投影用端末でライブQ&A・投票を表示、管理用端末でデータ確認、といった同時運用が可能です。',
  },
  {
    q: 'データのエクスポートは可能ですか？',
    a: 'はい。出席データ、Q&Aの質問一覧、投票結果などをCSV形式でエクスポートできます。Excelやスプレッドシートでの分析に活用いただけます。',
  },
  {
    q: '解約はいつでもできますか？',
    a: 'はい、いつでも解約可能です。解約後も現在の請求期間が終了するまでプランの機能をご利用いただけます。解約手数料等は一切かかりません。',
  },
];

/* ─── Navigation Product Links ─── */
const productLinks = [
  { href: '/features/attendance', label: '出席管理フォーム' },
  { href: '/features/invitation', label: '招待フォーム・参加者管理' },
  { href: '/features/live-interaction', label: 'リアルタイムQ&A・ライブ投票' },
];

/* ═══════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handlePlanPurchase = async (productType: string) => {
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType,
          successUrl: `${window.location.origin}/admin?payment=success`,
          cancelUrl: `${window.location.origin}/#pricing`,
        }),
      });
      if (res.status === 401) {
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="ざせきくん" width={36} height={36} className="rounded-lg" />
            <span className="hidden sm:block text-lg font-bold tracking-tight text-slate-900">
              ざせきくん
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {/* Desktop product dropdown */}
            <div
              className="hidden md:block relative"
              onMouseEnter={() => setProductMenuOpen(true)}
              onMouseLeave={() => setProductMenuOpen(false)}
            >
              <button className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
                製品
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${productMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {productMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-xl ring-1 ring-black/5 p-2"
                  >
                    {productLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block px-3 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link href="/faq" className="hidden md:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
              FAQ
            </Link>
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
                <p className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">製品</p>
                {productLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                    {link.label}
                  </Link>
                ))}
                <div className="border-t border-slate-100 my-2" />
                <Link href="/faq" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  FAQ
                </Link>
                <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  管理者ログイン
                </Link>
                <Link href="/rooms" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  ルームに参加
                </Link>
                <Link href="/news" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                  お知らせ
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

      {/* ─── Hero (Slido-inspired: split layout) ─── */}
      <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-5">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-indigo-100/50 via-blue-50/30 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Text */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5 mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  出席管理 × 招待フォーム
                  <br className="sm:hidden" />
                  {' '}× リアルタイムQ&A × ライブ投票
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]"
              >
                全ての学習機会を
                <br />
                「受け取る」から「共に作る」へ
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                出席管理・招待フォーム・
                <br className="sm:hidden" />
                リアルタイムQ&A・ライブ投票を1つの
                <br className="sm:hidden" />
                プラットフォームで。
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
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

            {/* Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/40">
                <img
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80"
                  alt="カンファレンス会場"
                  className="w-full h-auto object-cover aspect-[4/3]"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/30 to-transparent" />
                {/* Floating badge */}
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto">
                  <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">アプリ不要・ログイン不要</p>
                      <p className="text-[10px] text-slate-500">QRコードですぐにスタート</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-12 border-y border-slate-100 bg-white/60">
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
              { date: '2026.03.19', tag: 'リリース', tagColor: 'bg-blue-100 text-blue-700', title: '招待フォーム機能をリリースしました。SNS告知→事前登録→QRコード発行→当日受付の一気通貫フローを実現。' },
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

      {/* ─── Products Showcase (NEW - Slido-inspired) ─── */}
      <section className="py-20 sm:py-28 px-5 bg-slate-50/60">
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeIn} className="text-center mb-14">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              Products
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              3つの製品で、
              <br className="sm:hidden" />
              あらゆるシーンに対応。
            </h2>
            <p className="mt-4 text-base text-slate-500 max-w-xl mx-auto">
              出席管理から双方向コミュニケーションまで、
              <br className="sm:hidden" />
              ひとつのプラットフォームで完結。
            </p>
          </motion.div>

          <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <motion.div key={p.title} {...child}>
                <Link href={p.href} className="group block h-full">
                  <div className="h-full bg-white rounded-2xl shadow-lg ring-1 ring-black/5 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-t ${p.color} opacity-40`} />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <p.icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{p.description}</p>
                      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:gap-2 transition-all">
                        詳しく見る
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                {...child}
                className="group bg-white rounded-2xl p-6 shadow-sm ring-1 ring-black/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 text-center"
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
      <section className="py-20 sm:py-28 px-5 bg-slate-50/60">
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
      <section id="pricing" className="py-20 sm:py-28 px-5 bg-slate-50/60">
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

          <motion.div {...stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free Plan */}
            <motion.div {...child} className="bg-white rounded-2xl p-8 shadow-sm ring-1 ring-black/5 relative">
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
                  '招待フォーム・事前登録',
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
            <motion.div {...child} className="bg-white rounded-2xl p-8 relative ring-2 ring-indigo-500 shadow-xl shadow-indigo-100/40">
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
                  '招待フォーム・事前登録',
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
                onClick={() => handlePlanPurchase('pro_subscription')}
                className="block w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.97] transition-all px-6 py-3 rounded-xl shadow-lg shadow-indigo-200/50"
              >
                Proプランを始める
              </button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div {...child} className="bg-white rounded-2xl p-8 relative md:col-span-2 lg:col-span-1 ring-1 ring-black/5 shadow-sm">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-1 rounded-full shadow-md">
                  <Building2 className="w-3 h-3" />
                  法人向け
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Enterprise プラン</h3>
                <p className="text-sm text-slate-500 mt-1">法人・大規模イベント運用に</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900">¥2,000</span>
                <span className="text-sm text-slate-400 ml-1">/ 月（税込）</span>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  'フォーム 無制限',
                  'ルーム 無制限',
                  'Q&A・投票機能',
                  '位置情報による出席管理',
                  '招待フォーム・事前登録',
                  'CSV / Excelエクスポート',
                  'QRコード生成',
                  'カスタムフォーム作成',
                  '複数端末での同時運用',
                  '優先サポート',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handlePlanPurchase('enterprise_subscription')}
                className="block w-full text-center text-sm font-semibold text-white bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black active:scale-[0.97] transition-all px-6 py-3 rounded-xl shadow-lg shadow-slate-200/50"
              >
                Enterpriseプランを始める
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 sm:py-28 px-5">
        <div className="mx-auto max-w-3xl">
          <motion.div {...fadeIn} className="text-center mb-14">
            <span className="text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3.5 py-1.5">
              FAQ
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              よくある質問
            </h2>
          </motion.div>

          <motion.div {...stagger} className="space-y-3">
            {faqItems.map((item, i) => (
              <motion.div
                key={i}
                {...child}
                className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pl-13">
                        <p className="text-sm text-slate-600 leading-relaxed pl-8">{item.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-8">
            <Link href="/faq" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              すべてのFAQを見る
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
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

          <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm ring-1 ring-black/5">
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
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: value }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <Image src={LOGO_URL} alt="ざせきくん" width={28} height={28} className="rounded-lg" />
                <span className="text-sm font-bold text-slate-900">ざせきくん</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                出席管理・招待フォーム・リアルタイムQ&A・ライブ投票をワンストップで。
              </p>
              <p className="text-xs text-slate-400 mt-2">by 株式会社Nobody</p>
            </div>

            {/* Products */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">製品</h4>
              <ul className="space-y-2.5">
                <li><Link href="/features/attendance" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">出席管理フォーム</Link></li>
                <li><Link href="/features/invitation" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">招待フォーム・参加者管理</Link></li>
                <li><Link href="/features/live-interaction" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">リアルタイムQ&A・ライブ投票</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">リソース</h4>
              <ul className="space-y-2.5">
                <li><Link href="/faq" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">FAQ</Link></li>
                <li><Link href="/news" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">お知らせ</Link></li>
                <li><Link href="/rooms" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">ルームに参加</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">法務</h4>
              <ul className="space-y-2.5">
                <li><Link href="/legal/privacy" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">プライバシーポリシー</Link></li>
                <li><Link href="/legal/terms" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">利用規約</Link></li>
                <li><Link href="/legal/tokusho" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">特定商取引法に基づく表記</Link></li>
                <li><a href="mailto:sobota@nobody-info.com" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">お問い合わせ</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto max-w-6xl px-5 py-6 text-center">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} 株式会社Nobody. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
