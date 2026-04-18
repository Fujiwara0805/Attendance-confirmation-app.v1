'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Send, Loader2, CheckCircle2, Building2 } from 'lucide-react';
import LPHeader from '@/app/components/LPHeader';
import LPFooter from '@/app/components/LPFooter';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: 'enterprise',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setSending(true);

    // メールで送信（mailto形式でフォールバック）
    const mailtoBody = [
      `お名前: ${formData.name}`,
      `メールアドレス: ${formData.email}`,
      formData.company ? `会社名・団体名: ${formData.company}` : '',
      formData.phone ? `電話番号: ${formData.phone}` : '',
      `お問い合わせ種別: ${formData.subject === 'enterprise' ? 'Enterprise プラン導入' : formData.subject === 'general' ? '一般的なお問い合わせ' : formData.subject === 'support' ? 'サポート・技術的な質問' : 'その他'}`,
      '',
      `お問い合わせ内容:`,
      formData.message,
    ].filter(Boolean).join('\n');

    const subjectText = formData.subject === 'enterprise'
      ? '【ざせきくん】Enterprise プラン導入のお問い合わせ'
      : `【ざせきくん】お問い合わせ - ${formData.name}様`;

    window.location.href = `mailto:sobota@nobody-info.com?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(mailtoBody)}`;

    // UI上は送信完了扱い
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1000);
  };

  const subjectOptions = [
    { value: 'enterprise', label: 'Enterprise プラン導入について' },
    { value: 'general', label: '一般的なお問い合わせ' },
    { value: 'support', label: 'サポート・技術的な質問' },
    { value: 'other', label: 'その他' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <LPHeader />

      <main className="pt-24 pb-20 px-5">
        <div className="mx-auto max-w-2xl">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            トップに戻る
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 shadow-sm flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 ring-1 ring-indigo-100 px-2.5 py-1 rounded-full mb-1.5">
                  Contact
                </p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  お問い合わせ
                </h1>
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-500 mt-3 mb-8 leading-relaxed">
              Enterprise プランの導入やその他のご相談について、お気軽にお問い合わせください。
              <br className="hidden sm:block" />
              担当者より2営業日以内にご連絡いたします。
            </p>

            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100 shadow-sm flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-3">
                  お問い合わせありがとうございます
                </h2>
                <p className="text-sm sm:text-base text-slate-500 mb-6 leading-relaxed">
                  メールクライアントが開きます。内容をご確認の上、送信してください。
                  <br className="hidden sm:block" />
                  担当者より折り返しご連絡いたします。
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  トップに戻る
                </Link>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700">
                      お名前 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="山田 太郎"
                      className="w-full h-11 sm:h-12 px-4 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700">
                      メールアドレス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="taro@example.com"
                      className="w-full h-11 sm:h-12 px-4 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700">会社名・団体名</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="株式会社○○"
                      className="w-full h-11 sm:h-12 px-4 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700">電話番号</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="090-1234-5678"
                      className="w-full h-11 sm:h-12 px-4 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-slate-700">お問い合わせ種別</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full h-11 sm:h-12 px-4 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all bg-white"
                    style={{ fontSize: '16px' }}
                  >
                    {subjectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-semibold text-slate-700">
                    お問い合わせ内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Enterprise プランの導入をご検討中の場合は、ご利用予定の規模（人数・拠点数など）やご要望をご記入ください。"
                    className="w-full px-4 py-3 text-sm sm:text-base border border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none leading-relaxed"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || !formData.name || !formData.email || !formData.message}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all h-12 px-8 rounded-xl shadow-lg shadow-indigo-200/50 disabled:opacity-40"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      送信する
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </main>

      <LPFooter />
    </div>
  );
}
