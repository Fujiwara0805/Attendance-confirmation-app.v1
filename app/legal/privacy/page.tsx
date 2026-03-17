import Link from 'next/link';
import Image from 'next/image';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Image src={LOGO_URL} alt="ざせきくん" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">プライバシーポリシー</h1>
            <p className="text-sm text-slate-500">ざせきくん（株式会社Nobody）</p>
          </div>
        </div>

        <div className="prose prose-slate prose-sm max-w-none space-y-8">
          <p className="text-sm text-slate-600 leading-relaxed">
            株式会社Nobody（以下「当社」といいます）は、当社が提供するサービス「ざせきくん」（以下「本サービス」といいます）における利用者の個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">1. 個人情報の定義</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本ポリシーにおいて「個人情報」とは、生存する個人に関する情報であって、氏名、メールアドレス、その他の記述等により特定の個人を識別できるもの、または個人識別符号が含まれるものをいいます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">2. 個人情報の収集</h2>
            <p className="text-sm text-slate-600 leading-relaxed">当社は、本サービスの提供にあたり、以下の個人情報を収集する場合があります。</p>
            <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
              <li>管理者アカウント登録時：氏名、メールアドレス、パスワード（ハッシュ化して保存）</li>
              <li>Google OAuth認証時：Googleアカウントに紐づく氏名、メールアドレス</li>
              <li>出席登録時：利用者が入力した氏名、学籍番号、所属等の情報</li>
              <li>Q&A・投票機能利用時：投稿内容、投票内容</li>
              <li>位置情報：出席登録時にGPS情報を取得する場合があります（利用者の同意のもと）</li>
              <li>アクセスログ：IPアドレス、ブラウザ情報、アクセス日時</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">3. 利用目的</h2>
            <p className="text-sm text-slate-600 leading-relaxed">収集した個人情報は、以下の目的のために利用します。</p>
            <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
              <li>本サービスの提供・運営・改善</li>
              <li>管理者アカウントの認証・管理</li>
              <li>出席管理機能の提供（位置情報による認証を含む）</li>
              <li>Q&A・投票機能の提供</li>
              <li>利用状況の分析・統計データの作成</li>
              <li>お問い合わせへの対応</li>
              <li>重要なお知らせの送付</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">4. 第三者提供</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              当社は、以下の場合を除き、利用者の個人情報を第三者に提供することはありません。
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
              <li>利用者の同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命・身体・財産の保護のために必要な場合</li>
              <li>サービス提供に必要な委託先（Supabase、Google、Stripe等）への提供</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">5. 個人情報の管理</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              当社は、個人情報の正確性を保ち、不正アクセス・紛失・破壊・改ざんおよび漏洩などを防止するため、適切なセキュリティ対策を講じます。データはSupabase上に暗号化して保存され、パスワードはbcryptによりハッシュ化されます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">6. Cookieの使用</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              本サービスでは、ログイン状態の維持およびサービスの利便性向上のためにCookieを使用しています。利用者はブラウザの設定によりCookieの受け入れを拒否できますが、その場合、本サービスの一部機能が利用できなくなる場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">7. お問い合わせ窓口</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              個人情報の開示・訂正・削除等のご請求、またはご質問・ご意見は、以下までご連絡ください。
            </p>
            <div className="mt-3 p-4 bg-slate-50 rounded-lg text-sm text-slate-600 space-y-1">
              <p>株式会社Nobody</p>
              <p>〒870-1192 大分県大分市大字旦野原700番地 大分大学研究マネジメント機構4階423</p>
              <p>代表者: 藤原 泰樹</p>
              <p>メール: <a href="mailto:sobota@nobody-info.com" className="text-indigo-600 hover:underline">sobota@nobody-info.com</a></p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-3">8. ポリシーの改定</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              当社は、必要に応じて本ポリシーを改定することがあります。重要な変更がある場合は、本サービス上で通知します。改定後のポリシーは、本ページに掲載した時点から効力を生じるものとします。
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
