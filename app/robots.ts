import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://zaseki-kun.com';

// 公開ページのみクロール許可。管理画面・API・参加コード付きの
// 動的ページ（ルーム/出席/チェックイン/招待）は検索対象外にする。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/rooms/', '/attendance/', '/checkin/', '/invitation/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
