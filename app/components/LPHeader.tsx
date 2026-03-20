'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Menu, X, ChevronDown } from 'lucide-react';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

const productLinks = [
  { href: '/features/attendance', label: '出席管理フォーム' },
  { href: '/features/invitation', label: '招待フォーム・参加者管理' },
  { href: '/features/live-interaction', label: 'リアルタイムQ&A・ライブ投票' },
];

export default function LPHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src={LOGO_URL} alt="ざせきくん" width={36} height={36} className="rounded-lg" />
          <span className="hidden sm:block text-lg font-bold tracking-tight text-slate-900">
            ざせきくん
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Desktop links */}
          <div
            className="hidden md:block relative"
            onMouseEnter={() => setProductMenuOpen(true)}
            onMouseLeave={() => setProductMenuOpen(false)}
          >
            <button className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50">
              製品
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${productMenuOpen ? 'rotate-180' : ''}`} />
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
          <Link
            href="/faq"
            className="hidden md:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
          >
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
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
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
  );
}
