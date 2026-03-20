'use client';

import Image from 'next/image';
import Link from 'next/link';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function LPFooter() {
  return (
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
  );
}
