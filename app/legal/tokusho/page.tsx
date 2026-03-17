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

              {/* 必須項目 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 販売業者 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    販売業者
                  </h3>
                  <p className="text-slate-700 font-medium">株式会社Nobody</p>
                </div>

                {/* 運営統括責任者 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    運営統括責任者
                  </h3>
                  <p className="text-slate-700">代表取締役 藤原 泰樹</p>
                </div>

                {/* 所在地 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-600" />
                    所在地
                  </h3>
                  <p className="text-slate-700">
                    大分県大分市大字旦野原700番地<br />
                  大分大学研究マネジメント機構4階423<br />
                    <span className="text-sm text-slate-500">
                      （詳細住所についてはご請求があり次第遅滞なく開示いたします）
                    </span>
                  </p>
                </div>

                {/* 電話番号 */}
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

                {/* メールアドレス */}
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
                      href="https://zasekikun.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 underline"
                    >
                      https://zaseki-kun.com
                    </a>
                  </p>
                </div>

                {/* 販売価格 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-indigo-600" />
                    販売価格（消費税込み）
                  </h3>
                  <p className="text-slate-700">
                    Proプラン（月額サブスクリプション）: <span className="font-bold text-lg">¥550</span> / 月<br />
                    Freeプラン: <span className="font-bold">¥0</span><br />
                    <span className="text-sm text-slate-500">
                      各プランの詳細はサービスサイトの料金ページに表示
                    </span>
                  </p>
                </div>

                {/* 商品代金以外の必要料金 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-600" />
                    商品代金以外の必要料金
                  </h3>
                  <p className="text-slate-700">
                    送料: なし（デジタルサービスのため）<br />
                    決済手数料: なし<br />
                    <span className="text-sm text-slate-500">
                      表示価格以外の追加料金は一切発生いたしません
                    </span>
                  </p>
                </div>

                {/* 支払方法 */}
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

                {/* 支払時期 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    支払時期
                  </h3>
                  <p className="text-slate-700">
                    サブスクリプション契約時に初回決済。<br />
                    以降、毎月自動更新・決済。<br />
                    <span className="text-sm text-slate-500">
                      解約はいつでも可能。解約後も契約期間終了まで利用可能。
                    </span>
                  </p>
                </div>

                {/* 商品の引渡し時期 */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-600" />
                    サービスの提供時期
                  </h3>
                  <p className="text-slate-700">
                    決済完了後、即座にサービスをご利用可能<br />
                    <span className="text-sm text-slate-500">
                      クラウドサービスのため物理的な配送はありません。
                    </span>
                  </p>
                </div>
              </div>

              {/* 返品・交換ポリシー */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  返品・解約について
                </h3>
                <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">
                      ＜サブスクリプションの解約＞
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      Proプランのサブスクリプションはいつでも解約可能です。<br />
                      解約後も契約期間の残り日数分はサービスを継続してご利用いただけます。<br />
                      日割り返金は行っておりません。
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">
                      ＜サービス障害による返金＞
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      サービスに重大な障害があり正常に提供されない場合は、
                      <br className="sm:hidden" />
                      メール（sobota@nobody-info.com）にてご連絡ください。<br />
                      確認後、当社負担にて該当期間分の返金を行います。
                    </p>
                  </div>
                </div>
              </div>

              {/* サービス内容詳細 */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">サービス内容詳細</h3>
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-slate-800 mb-3">ざせきくん — イベント運営プラットフォーム</h4>
                  <p className="text-slate-700 mb-3 text-sm">
                    出席管理・リアルタイムQ&A・ライブ投票・カスタムフォームを
                    <br className="sm:hidden" />
                    ワンストップで提供するクラウドサービスです。
                  </p>
                  <ul className="space-y-2 text-slate-700 text-sm">
                    <li>• 位置情報ベースの出席管理機能</li>
                    <li>• リアルタイムQ&A（匿名投稿・いいね機能）</li>
                    <li>• ライブ投票（リアルタイム集計・結果表示）</li>
                    <li>• カスタムフォーム作成機能</li>
                    <li>• QRコード生成・共有機能</li>
                    <li>• CSV/Excelデータエクスポート機能</li>
                    <li>• 管理者向けダッシュボード</li>
                    <li>• スマートフォン最適化インターフェース</li>
                    <li>• Supabaseによるリアルタイムデータ同期</li>
                  </ul>
                </div>
              </div>

              {/* 動作環境 */}
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
                    サービスに関するご質問・ご相談は、
                    <br className="sm:hidden" />
                    下記連絡先までお気軽にお問い合わせください。
                  </p>
                  <div className="space-y-2 text-sm">
                    <p><strong>メールアドレス:</strong> sobota@nobody-info.com</p>
                    <p><strong>事業内容:</strong> SaaS開発・運営 / DXコンサルティング</p>
                    <p><strong>対応時間:</strong> 平日 9:00-18:00（土日祝日を除く）</p>
                    <p><strong>回答期間:</strong> 通常2営業日以内に回答いたします</p>
                  </div>
                </div>
              </div>

              {/* 免責事項 */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">免責事項</h3>
                <div className="bg-amber-50 p-6 rounded-lg">
                  <p className="text-slate-700 text-sm leading-relaxed">
                    本サービスは出席管理・Q&A・投票等の運営支援ツールです。
                    サービス利用により生じた損害について、
                    <br className="sm:hidden" />
                    当社は法令に基づく範囲で責任を負います。
                    サービス内容は予告なく変更される場合があります。
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
