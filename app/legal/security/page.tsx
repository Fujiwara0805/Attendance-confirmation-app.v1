import Link from 'next/link';
import Image from 'next/image';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export const metadata = {
  title: 'セキュリティとデータの取り扱い - ざせきくん',
  description:
    'ざせきくんにおけるデータの保存先、保持方針、位置情報の扱い、削除手順について、組織導入をご検討の担当者向けに説明します。',
};

// 組織導入の担当者が稟議・確認に使える、平易なデータ取り扱い説明ページ。
// 戦略上の原則: 過大な約束をしない（「運用証跡」の範囲を正直に示す）。
export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Image src={LOGO_URL} alt="ざせきくん" width={44} height={44} className="rounded-2xl ring-1 ring-black/5" />
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              セキュリティとデータの取り扱い
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">組織導入をご検討の担当者さま向けのご説明</p>
          </div>
        </div>

        <div className="space-y-8">
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            このページは、大学・企業・団体で「ざせきくん」の導入をご検討いただく際に確認されることの多い、
            データの保存先・保持方針・位置情報の扱い・削除手順をまとめたものです。法的な定めは
            <Link href="/legal/privacy" className="text-indigo-600 hover:underline">プライバシーポリシー</Link>
            および
            <Link href="/legal/terms" className="text-indigo-600 hover:underline">利用規約</Link>
            をご参照ください。
          </p>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">1. データの保存先</h2>
            <ul className="list-disc list-inside text-sm sm:text-base text-slate-600 space-y-1.5 leading-relaxed">
              <li>アプリケーションデータ（出席記録、質問、投票結果等）は Supabase（データベース所在地: 東京リージョン）に保存されます。</li>
              <li>パスワードは bcrypt によりハッシュ化して保存され、平文では保持しません。</li>
              <li>決済情報（カード番号等）は Stripe が保持し、当社のデータベースには保存されません。</li>
              <li>通信はすべて TLS（HTTPS）で暗号化されます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">2. 参加者データの範囲</h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              参加者（学生・受講者・イベント参加者）はアカウント登録を行いません。保存されるのは、主催者が設定したフォーム項目に参加者自身が入力した内容（氏名・学籍番号等）、Q&A・投票への投稿内容、および出席登録時の位置判定結果のみです。これらは該当フォーム・ルームを作成した主催者だけが閲覧できます。
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">3. 位置情報の扱い</h2>
            <ul className="list-disc list-inside text-sm sm:text-base text-slate-600 space-y-1.5 leading-relaxed">
              <li>位置情報は、主催者が位置確認を有効にしたフォームでのみ、参加者のブラウザの許可を得て取得します。</li>
              <li>用途は「対象エリア内からの登録かどうかの確認」のみです。継続的な追跡は行いません。</li>
              <li>保存されるのは登録時点の座標と判定結果で、主催者のみが確認できます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">4. 出席記録の性質について（正直なご説明）</h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              ざせきくんの出席記録は、QRコード・位置情報・連続登録の制限（クールダウン）を組み合わせて「不正のコストを上げる」仕組みであり、紙やExcelよりはるかに確実な<strong>運用上の記録</strong>を残せます。一方で、参加者の本人認証（学認・SSO等）は行わないため、厳格な本人確認を法的に要求される用途（単位認定の唯一の根拠、法定研修の証明等）には、組織の規程に照らした確認をお願いしています。誇張した説明をしないことを、私たちは大切にしています。
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">5. データの保持と削除</h2>
            <ul className="list-disc list-inside text-sm sm:text-base text-slate-600 space-y-1.5 leading-relaxed">
              <li>フォーム・ルームのデータは、主催者が削除するまで保持されます。削除は管理画面からいつでも実行できます。</li>
              <li>フォーム・ルームを削除すると、紐づく出席記録・質問・投票データも削除されます。</li>
              <li>アカウントを削除すると、作成したすべてのデータが削除されます（管理画面のアカウント設定から実行できます）。</li>
              <li>削除後のデータ復元はできません。必要なデータは事前にCSV/JSONでエクスポートしてください。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">6. 外部委託先</h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              サービス提供のため、次の事業者を利用しています: Supabase（データベース・リアルタイム配信）、Vercel（ホスティング）、Stripe（決済）、Google（OAuth認証）、Cloudinary（画像配信）。各社との通信は暗号化されています。
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">7. お支払い・書類対応</h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              クレジットカード決済のほか、法人・教育機関向けに銀行振込（請求書払い）に対応しています。見積書・請求書・納品書の発行も可能です。詳しくは
              <Link href="/contact" className="text-indigo-600 hover:underline">お問い合わせ</Link>
              ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-3">8. ご質問・確認事項</h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              セキュリティチェックシートへの回答など、導入にあたっての確認は
              <Link href="/contact" className="text-indigo-600 hover:underline">お問い合わせフォーム</Link>
              からご連絡ください。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200">
          <Link href="/" className="text-sm text-indigo-600 hover:underline">
            ← トップページへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
