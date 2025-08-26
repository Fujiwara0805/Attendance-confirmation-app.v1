'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TokushoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>

          <Card className="shadow-lg">
            <CardHeader className="bg-indigo-600 text-white">
              <CardTitle className="text-2xl">特定商取引法に基づく表記</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">販売業者</h3>
                  <p className="text-slate-700">株式会社Nobody</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">運営統括責任者</h3>
                  <p className="text-slate-700">代表取締役 藤原 泰樹</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">連絡先</h3>
                  <p className="text-slate-700">
                    メール: sobota@nobody-info.com<br />
                    ウェブサイト: https://labo-info.vercel.app/
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">商品の種類</h3>
                  <p className="text-slate-700">
                    デジタルコンテンツ（ソフトウェアライセンス）<br />
                    出席管理システム「ざせきくん」
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">販売価格</h3>
                  <p className="text-slate-700">
                    各商品ページに記載<br />
                    （税込価格を表示）
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">支払方法</h3>
                  <p className="text-slate-700">
                    クレジットカード決済<br />
                    （Stripe決済システムを利用）
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">支払時期</h3>
                  <p className="text-slate-700">
                    商品購入時の即時決済
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">商品の引渡し時期</h3>
                  <p className="text-slate-700">
                    決済完了後、即座にアクセス権限を付与<br />
                    （デジタル商品のため物理的な配送はありません）
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">返品・交換</h3>
                  <p className="text-slate-700">
                    デジタル商品の性質上、原則として返品・返金は承っておりません。<br />
                    ただし、商品に重大な欠陥がある場合は個別に対応いたします。
                  </p>
                </div>
              </div>

              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">サービス内容詳細</h3>
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-3">ざせきくん - 出席管理システム</h4>
                  <ul className="space-y-2 text-slate-700">
                    <li>• 位置情報ベースの出席管理機能</li>
                    <li>• カスタマイズ可能なフォーム作成機能</li>
                    <li>• Googleスプレッドシート連携機能</li>
                    <li>• 管理者向けダッシュボード</li>
                    <li>• スマートフォン最適化インターフェース</li>
                    <li>• 1回買い切りライセンス</li>
                  </ul>
                </div>
              </div>

              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">お問い合わせ</h3>
                <p className="text-slate-700">
                  商品やサービスに関するご質問は、上記連絡先までお気軽にお問い合わせください。<br />
                  営業時間: 平日 9:00-18:00（土日祝日を除く）
                </p>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
