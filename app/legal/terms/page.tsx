import Link from 'next/link';
import Image from 'next/image';
import { TermsDocument } from '@/components/legal/TermsDocument';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <div className="mb-10 flex items-center gap-3">
          <Image
            src={LOGO_URL}
            alt="ざせきくん"
            width={44}
            height={44}
            className="rounded-2xl ring-1 ring-black/5"
          />
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              利用規約
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">ざせきくん（株式会社Nobody）</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-8">
          <TermsDocument />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-800 sm:text-base"
          >
            ← ホームに戻る
          </Link>
          <Link
            href="/legal/privacy"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 sm:text-base"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/legal/tokusho"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 sm:text-base"
          >
            特定商取引法に基づく表記
          </Link>
        </div>
      </div>
    </div>
  );
}
