'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Phone, Globe, MapPin, Clock, CreditCard, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TokushoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
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
              <p className="text-indigo-100 mt-2">
                通信販売に関する表示事項
              </p>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              
              {/* 必須項目 - Stripeガイドライン準拠 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 販売業者（Legal Name） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    販売業者
                  </h3>
                  <p className="text-slate-700 font-medium">株式会社Nobody</p>
                </div>

                {/* 運営統括責任者（Head of Operations） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    運営統括責任者
                  </h3>
                  <p className="text-slate-700">代表取締役 藤原 泰樹</p>
                </div>

                {/* 住所（Address） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    所在地
                  </h3>
                  <p className="text-slate-700">
                    〒870-0xxx 大分県大分市<br />
                    <span className="text-sm text-slate-500">
                      （詳細住所についてはご請求があり次第遅滞なく開示いたします）
                    </span>
                  </p>
                </div>

                {/* 電話番号（Phone number） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Phone className="h-5 w-5 text-indigo-600" />
                    電話番号
                  </h3>
                  <p className="text-slate-700">
                    ご請求があり次第遅滞なく開示いたします<br />
                    <span className="text-sm text-slate-500">
                      （通常のお問い合わせはメールにて承ります）
                    </span>
                  </p>
                </div>

                {/* メールアドレス（Email address） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Mail className="h-5 w-5 text-indigo-600" />
                    メールアドレス
                  </h3>
                  <p className="text-slate-700">
                    <a 
                      href="mailto:sobota@nobody-info.com" 
                      className="text-indigo-600 hover:text-indigo-800 underline"
                    >
                      sobota@nobody-info.com
                    </a>
                  </p>
                </div>

                {/* ウェブサイト */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-indigo-600" />
                    ホームページURL
                  </h3>
                  <p className="text-slate-700">
                    <a 
                      href="https://labo-info.vercel.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 underline"
                    >
                      https://labo-info.vercel.app/
                    </a>
                  </p>
                </div>

                {/* 販売価格（Price） - 消費税込み */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-indigo-600" />
                    販売価格（消費税込み）
                  </h3>
                  <p className="text-slate-700">
                    カスタムフォーム作成機能: <span className="font-bold text-lg">¥200</span><br />
                    <span className="text-sm text-slate-500">
                      各商品ページに詳細価格を表示
                    </span>
                  </p>
                </div>

                {/* 商品代金以外の必要料金（Additional fees） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                    商品代金以外の必要料金
                  </h3>
                  <p className="text-slate-700">
                    送料: なし（デジタル商品のため）<br />
                    決済手数料: なし<br />
                    <span className="text-sm text-slate-500">
                      表示価格以外の追加料金は一切発生いたしません
                    </span>
                  </p>
                </div>

                {/* 支払方法（Accepted payment methods） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                    支払方法
                  </h3>
                  <p className="text-slate-700">
                    クレジットカード決済（Visa、Mastercard、American Express、JCB）<br />
                    <span className="text-sm text-slate-500">
                      Stripe決済システムを利用
                    </span>
                  </p>
                </div>

                {/* 支払時期（Payment period） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    支払時期
                  </h3>
                  <p className="text-slate-700">
                    商品購入時の即時決済<br />
                    <span className="text-sm text-slate-500">
                      クレジットカード決済は購入と同時に処理されます
                    </span>
                  </p>
                </div>

                {/* 商品の引渡し時期（Delivery times） */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-600" />
                    商品の引渡し時期
                  </h3>
                  <p className="text-slate-700">
                    決済完了後、即座にアクセス権限を付与<br />
                    <span className="text-sm text-slate-500">
                      デジタル商品のため物理的な配送はありません。<br />
                      決済確認後、すぐにサービスをご利用いただけます。
                    </span>
                  </p>
                </div>
              </div>

              {/* 返品・交換ポリシー（Exchanges & Returns Policy） */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  返品・交換について
                </h3>
                <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">
                      ＜お客様都合による返品・交換＞
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      デジタル商品の性質上、お客様都合による返品・返金は原則として承っておりません。<br />
                      決済完了後のキャンセルはできませんので、ご購入前に十分ご検討ください。<br />
                      サービス内容について不明な点がございましたら、購入前にお気軽にお問い合わせください。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">
                      ＜不良品・サービス欠陥による返品・交換＞
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      商品に重大な欠陥がある場合や、サービスが正常に提供されない場合は、<br />
                      購入日から30日以内にメール（sobota@nobody-info.com）にてご連絡ください。<br />
                      確認後、当社負担にて全額返金または同等のサービス提供を行います。
                    </p>
                  </div>
                </div>
              </div>

              {/* サービス内容詳細 */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">サービス内容詳細</h3>
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-3">ざせきくん - 出席管理システム</h4>
                  <p className="text-slate-700 mb-3 text-sm">
                    教育機関向けの位置情報ベース出席管理システムです。管理者は講義ごとに位置情報と範囲を設定、学生はフォームから簡単に出席登録できます。
                  </p>
                  <ul className="space-y-2 text-slate-700 text-sm">
                    <li>• 位置情報ベースの出席管理機能</li>
                    <li>• カスタマイズ可能なフォーム作成機能（有料オプション）</li>
                    <li>• Googleスプレッドシート連携機能</li>
                    <li>• 管理者向けダッシュボード</li>
                    <li>• スマートフォン最適化インターフェース</li>
                    <li>• 1回買い切りライセンス（永続利用可能）</li>
                  </ul>
                </div>
              </div>

              {/* 動作環境（Operating environment） */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">動作環境</h3>
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-3">推奨環境</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                    <div>
                      <h5 className="font-medium mb-2">PC環境</h5>
                      <ul className="space-y-1">
                        <li>• Windows 10以上 / macOS 10.15以上</li>
                        <li>• Chrome 90以上 / Firefox 88以上 / Safari 14以上</li>
                        <li>• インターネット接続環境</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">モバイル環境</h5>
                      <ul className="space-y-1">
                        <li>• iOS 12以上 / Android 8.0以上</li>
                        <li>• Chrome / Safari（最新版推奨）</li>
                        <li>• GPS機能対応端末</li>
                        <li>• インターネット接続環境</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* お問い合わせ */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">お問い合わせ</h3>
                <div className="bg-green-50 p-6 rounded-lg">
                  <p className="text-slate-700 mb-4">
                    商品やサービスに関するご質問、返品・交換のご相談は、下記連絡先までお気軽にお問い合わせください。
                  </p>
                  <div className="space-y-2 text-sm">
                    <p><strong>メールアドレス:</strong> sobota@nobody-info.com</p>
                    <p><strong>対応時間:</strong> 平日 9:00-18:00（土日祝日を除く）</p>
                    <p><strong>回答期間:</strong> 通常2営業日以内に回答いたします</p>
                    <p className="text-slate-600">
                      ※お急ぎの場合や重要なお問い合わせの場合は、メールの件名に【緊急】とご記載ください
                    </p>
                  </div>
                </div>
              </div>

              {/* 免責事項 */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">免責事項</h3>
                <div className="bg-amber-50 p-6 rounded-lg">
                  <p className="text-slate-700 text-sm leading-relaxed">
                    本サービスは教育機関向けの出席管理システムです。サービス利用により生じた損害について、
                    当社は一切の責任を負いません。また、Googleスプレッドシートの仕様変更等により、
                    一部機能が制限される場合があります。サービス内容は予告なく変更される場合があります。
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
