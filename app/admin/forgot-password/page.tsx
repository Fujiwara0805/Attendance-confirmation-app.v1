'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import {
  Mail,
  Loader2,
  ArrowLeft,
  CheckCircle,
  Copy,
  ExternalLink,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetUrl('')

    if (!email.trim()) {
      setError('メールアドレスを入力してください')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'エラーが発生しました')
        return
      }

      if (data.resetUrl) {
        setResetUrl(data.resetUrl)
      } else {
        setError('登録されていないメールアドレスです')
      }
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resetUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const highlights = [
    {
      icon: ShieldCheck,
      title: '安全なリセットフロー',
      desc: 'トークン検証と有効期限で、第三者の不正利用を防止。',
    },
    {
      icon: Clock,
      title: '有効期限は1時間',
      desc: 'セキュリティのため、リセットリンクは発行後1時間で失効します。',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* ─── Left: Form ─── */}
        <div className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-md"
          >
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              ログインに戻る
            </Link>

            <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
              <Image
                src={LOGO_URL}
                alt="ざせきくん"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                ざせきくん
              </span>
            </Link>

            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 mb-4">
                <KeyRound className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                パスワードリセット
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                登録済みのメールアドレスを入力してください。
                <br />
                リセット用リンクを発行します。
              </p>
            </div>

            {!resetUrl ? (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-sm font-semibold text-slate-700"
                  >
                    メールアドレス
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200/50 font-semibold transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  リセットリンクを発行
                </Button>
              </motion.form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2.5 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">
                    リセットリンクを発行しました
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    下のリンクからパスワードをリセットできます（有効期限:
                    1時間）。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="rounded-lg"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      {copied ? 'コピー済み' : 'コピー'}
                    </Button>
                    <Link href={resetUrl}>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        リセットページへ
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* ─── Right: Brand Panel ─── */}
        <div className="hidden lg:block relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 h-full flex flex-col justify-center p-14">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-white bg-white/15 border border-white/20 rounded-full px-3.5 py-1.5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Secure Reset Flow
              </span>
              <h2 className="mt-6 text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                大切なアカウントを、
                <br />
                安全に守ります。
              </h2>
              <p className="mt-5 text-base text-indigo-100/90 leading-relaxed max-w-md">
                パスワードリセットは、
                <br />
                トークン検証と有効期限により
                <br />
                安全に保護されています。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-3 mt-10"
            >
              {highlights.map((h) => (
                <div
                  key={h.title}
                  className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/15"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <h.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {h.title}
                    </p>
                    <p className="text-xs text-indigo-100/80 mt-1 leading-relaxed">
                      {h.desc}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
