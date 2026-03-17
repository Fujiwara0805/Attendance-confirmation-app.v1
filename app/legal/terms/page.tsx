import Link from 'next/link';
import Image from 'next/image';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Image src={LOGO_URL} alt="ざせきくん" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">利用規約</h1>
            <p className="text-sm text-slate-500">ざせきくん（株式会社Nobody）</p>
          </div>
        </div>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
          <p className="text-sm text-slate-600 leading-relaxed">
            本利用規約（以下「本規約」といいます）は、株式会社Nobody（以下「当社」といいます）が提供するサービス「ざせきくん」（以下「本サービス」といいます）の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスをご利用ください。
          </p>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第1条（適用範囲）</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本規約は、本サービスの利用に関する当社と利用者との間の一切の関係に適用されます。本サービスには、出席管理機能、リアルタイムQ&A機能、ライブ投票機能、カスタムフォーム機能、およびこれらに付随するすべての機能が含まれます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第2条（サービス内容）</h2>
            <p className="text-sm text-slate-600 leading-relaxed">当社は、以下のサービスを提供します。</p>
            <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
              <li>位置情報を活用した出席管理機能</li>
              <li>リアルタイムQ&A機能（匿名投稿・いいね機能を含む）</li>
              <li>ライブ投票機能</li>
              <li>カスタムフォーム作成機能</li>
              <li>QRコード生成・共有機能</li>
              <li>出席データのCSV/JSONエクスポート機能</li>
              <li>管理者ダッシュボード</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第3条（アカウント）</h2>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>管理者機能を利用する場合、Googleアカウントまたはメールアドレスによるアカウント登録が必要です。</li>
              <li>参加者（出席登録・Q&A・投票の利用者）はアカウント登録不要で本サービスを利用できます。</li>
              <li>利用者は、自己のアカウント情報を適切に管理する責任を負います。</li>
              <li>アカウントの第三者への譲渡・貸与は禁止します。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第4条（料金）</h2>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>本サービスには無料プラン（Freeプラン）と有料プラン（Proプラン：月額550円・税込）があります。</li>
              <li>有料プランの決済はStripeを通じて行われます。</li>
              <li>一度支払われた料金は、法令に定める場合を除き返金いたしません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第5条（禁止事項）</h2>
            <p className="text-sm text-slate-600 leading-relaxed">利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
            <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>当社のサーバーまたはネットワークに過度の負荷をかける行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>他の利用者の個人情報を不正に収集する行為</li>
              <li>不正アクセスまたはこれを試みる行為</li>
              <li>虚偽の情報を登録する行為</li>
              <li>当社または第三者の知的財産権を侵害する行為</li>
              <li>本サービスを商業目的で無断転用する行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第6条（免責事項）</h2>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>当社は、本サービスに事実上または法律上の瑕疵がないことを保証しません。</li>
              <li>当社は、本サービスの利用により生じた損害について、当社の故意または重大な過失による場合を除き、一切の責任を負いません。</li>
              <li>位置情報の精度に起因する出席判定の誤差について、当社は責任を負いません。</li>
              <li>利用者間または利用者と第三者との間で生じた紛争について、当社は一切関与しません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第7条（サービスの変更・中断・終了）</h2>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
              <li>当社は、利用者への事前の通知なく、本サービスの内容を変更できるものとします。</li>
              <li>当社は、以下の場合に本サービスの全部または一部を中断できるものとします。
                <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                  <li>システムの保守・点検を行う場合</li>
                  <li>天災、停電等の不可抗力による場合</li>
                  <li>その他、当社がやむを得ないと判断した場合</li>
                </ul>
              </li>
              <li>当社は、本サービスの中断により利用者に生じた損害について、一切の責任を負いません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第8条（知的財産権）</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本サービスに関する著作権、商標権その他の知的財産権は、当社または正当な権利者に帰属します。利用者は、本サービスを通じて提供される情報を、当社の事前の承諾なく、複製・転載・改変・販売等してはなりません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">第9条（準拠法・管轄裁判所）</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本規約の解釈にあたっては日本法を準拠法とします。本サービスに関して紛争が生じた場合、大分地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            制定日: 2026年3月17日
          </p>
        </div>

        <div className="mt-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
