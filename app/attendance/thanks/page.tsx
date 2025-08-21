'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const COMPANY_NAME = '株式会社Nobody';
// 連絡先は必要に応じて置き換えてください
const CONTACT_EMAIL = 'sobota@nobody-info.com';
const WEBSITE_URL = 'https://labo-info.vercel.app/';

export default function ThanksShowcase() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-10"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-indigo-700">送信ありがとうございました</h1>
          <p className="mt-2 text-slate-600">
            {COMPANY_NAME} が開発するアプリをご紹介します。
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl bg-white shadow-md border border-blue-100 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                <a href="https://tokudoku.com" target="_blank" rel="noreferrer">
                  <Image
                    src="https://res.cloudinary.com/dz9trbwma/image/upload/v1749032362/icon_n7nsgl.png"
                    alt="トクドク"
                    width={60}
                    height={60}
                    className="rounded cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </a>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">トクドク<br />（掲示板アプリ）</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            🚀 学生生活をもっと楽しく、もっと便利に！
            利用者の半径5km限定の掲示板「おとく板」なら、アルバイトやサークル活動、講義情報やその日のテスト対策情報までリアルタイムで共有が可能です。また、投稿は 最大12時間で自動削除されるから、いつ見ても“いま欲しい”最新情報だけが集まります。さらに投稿に「おすそわけ機能」を追加することで、投稿を見た人から応援金を受け取れる仕組みもあります。
               <br />
               <span className="font-medium text-blue-600">
                 今すぐアクセス → 
                 <a href="https://tokudoku.com" target="_blank" rel="noreferrer" className="underline hover:text-blue-800">
                   https://tokudoku.com
                 </a>
               </span>
             </p>
             <ul className="mt-4 text-xs text-slate-700 list-disc pl-5 space-y-1.5">
               <li>利用者から周辺5km圏内の投稿のみを表示する「おとく板」</li>
               <li>投稿に「おすそわけ機能」を追加で、生活資金の足しなる</li>
               <li>投稿は、最大12時間で自動削除されるので常に情報が新しい</li>
               <li>学生生活の中で必要な情報をキャンパスメイトと共有できる</li>
               <li>メモ機能は、サークル活動の際のTODO管理にも最適</li>
             </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-white shadow-md border border-indigo-100 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                <Image
                  src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                  alt="ざせきくん"
                  width={60}
                  height={60}
                  className="rounded"
                />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">ざせきくん<br />（出席管理アプリ）</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              管理者は講義ごとに位置情報と範囲を設定、学生はフォームから簡単に出席登録できます。Googleスプレッドシート連携で集計もスムーズ。
            </p>
            <ul className="mt-4 text-sm text-slate-700 list-disc pl-5 space-y-1.5">
              <li>位置情報判定（半径設定）</li>
              <li>Google Sheets 連携</li>
              <li>スマホ最適化フォーム</li>
            </ul>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8 rounded-xl bg-white shadow-md border border-slate-200 p-6"
        >
          <h3 className="text-lg font-semibold text-slate-900">お問い合わせ</h3>
          <p className="mt-2 text-sm text-slate-600">
            本サービスやアプリに関するご相談は、{COMPANY_NAME} までお気軽にご連絡ください。
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="text-slate-500">メール</div>
              <a className="text-slate-900 font-medium underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="text-slate-500">ウェブサイト</div>
              <a className="text-slate-900 font-medium underline" href={WEBSITE_URL} target="_blank" rel="noreferrer">
                {WEBSITE_URL}
              </a>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ページ上部に戻る
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
