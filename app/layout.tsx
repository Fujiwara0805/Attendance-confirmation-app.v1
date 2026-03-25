import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'ざせきくん - 出席管理・Q&A・投票をワンストップで',
  description: 'ざせきくんは、出席管理・リアルタイムQ&A・ライブ投票をひとつにまとめたイベント運営プラットフォームです。アプリ不要・ログイン不要で、10,000人規模の同時アクセスにも対応。QRコード共有ですぐに始められます。',
  keywords: ['出席管理', 'リアルタイムQ&A', 'ライブ投票', 'イベント運営', 'QRコード出席', 'Webアプリ', '授業管理', 'アンケート'],
  authors: [{ name: '株式会社Nobody' }],
  creator: '株式会社Nobody',
  publisher: 'ざせきくん',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'ざせきくん - 出席管理・Q&A・投票をワンストップで',
    description: '出席管理・リアルタイムQ&A・ライブ投票をひとつに。アプリ不要で10,000人規模にも対応するイベント運営プラットフォーム。',
    type: 'website',
    locale: 'ja_JP',
    images: [
      {
        url: 'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_1200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png',
        width: 1200,
        height: 630,
        alt: 'ざせきくん - 出席管理システム',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ざせきくん - 出席管理・Q&A・投票をワンストップで',
    description: '出席管理・リアルタイムQ&A・ライブ投票をひとつに。アプリ不要で10,000人規模にも対応するイベント運営プラットフォーム。',
    images: ['https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_1200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'],
  },
  icons: {
    icon: [
      {
        url: 'https://res.cloudinary.com/dz9trbwma/image/upload/f_png,q_auto,w_32/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: 'https://res.cloudinary.com/dz9trbwma/image/upload/f_png,q_auto,w_16/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: 'https://res.cloudinary.com/dz9trbwma/image/upload/f_png,q_auto,w_180/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <Providers>
          <main className="min-h-screen bg-[hsl(var(--surface,226_100%_98%))]">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
