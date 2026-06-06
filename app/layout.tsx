import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://zaseki-kun.com'),
  title: 'ざせきくん - 出席管理・Q&A・投票をワンストップで',
  description: 'ざせきくんは、出席管理・招待フォーム・Q&A・投票・クイズ（投票/クイズ/ランキング/ブレスト）をひとつにまとめたサービスです。アプリ不要・ログイン不要、スマホのQRコードからすぐに参加でき、結果はスクリーンにリアルタイム表示できます。',
  keywords: ['出席管理', 'Q&A', '投票', 'クイズ', 'ランキング', 'ブレスト', '資料投影', 'QRコード出席', 'Webアプリ', '授業', 'アンケート'],
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
        alt: 'ざせきくん - 出席・Q&A・投票プラットフォーム',
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
      <body>
        <Providers>
          <main className="min-h-screen bg-[hsl(var(--surface,0_11%_96%))]">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
