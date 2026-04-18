'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import {
  Mail,
  Loader2,
  Eye,
  EyeOff,
  Home,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react'

const GoogleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
)
import Image from 'next/image'
import Link from 'next/link'

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.push('/admin')
      }
    })
  }, [router])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      await signIn('google', { callbackUrl: '/admin' })
    } catch (error) {
      console.error('ログインエラー:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください')
      return
    }

    setEmailLoading(true)
    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('メールアドレスまたはパスワードが正しくありません')
      } else {
        router.push('/admin')
      }
    } catch {
      setError('ログイン中にエラーが発生しました')
    } finally {
      setEmailLoading(false)
    }
  }

  const highlights = [
    {
      icon: ShieldCheck,
      title: '位置情報で不正を防止',
      desc: 'GPS連携で対象エリア内の参加者だけが登録可能。',
    },
    {
      icon: Zap,
      title: 'QRコードで即完了',
      desc: 'ログイン不要、読み取るだけで参加できる。',
    },
    {
      icon: Sparkles,
      title: '1,000人規模でも安定稼働',
      desc: '大規模イベントでも遅延ゼロの堅牢なインフラ。',
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
            {/* Logo */}
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
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                管理者ログイン
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                出席管理・Q&A・投票など、
                <br className="sm:hidden" />
                すべての機能を管理できます。
              </p>
            </div>

            <div className="space-y-4">
              {/* Google */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 text-base font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-sm transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <GoogleIcon className="w-5 h-5 mr-3" />
                      Googleでログイン
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                    または
                  </span>
                </div>
              </div>

              {/* Email form */}
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onSubmit={handleEmailLogin}
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
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-sm font-semibold text-slate-700"
                    >
                      パスワード
                    </Label>
                    <Link
                      href="/admin/forgot-password"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                    >
                      お忘れですか？
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="パスワードを入力"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-11 rounded-xl border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
                  disabled={emailLoading}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200/50 font-semibold transition-all active:scale-[0.98]"
                >
                  {emailLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  メールアドレスでログイン
                </Button>
              </motion.form>

              {/* Register */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center pt-2"
              >
                <p className="text-sm text-slate-500">
                  初めてご利用の方は{' '}
                  <Link
                    href="/admin/register"
                    className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                  >
                    新規アカウント登録
                  </Link>
                </p>
              </motion.div>

              {/* Home */}
              <div className="pt-4 text-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  ホームに戻る
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ─── Right: Brand Panel ─── */}
        <div className="hidden lg:block relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700">
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 h-full flex flex-col justify-between p-14">
            {/* Top: tagline */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-white bg-white/15 border border-white/20 rounded-full px-3.5 py-1.5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Event Engagement Platform
              </span>
              <h2 className="mt-6 text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                全ての学習機会を
                <br />
                「受け取る」から
                <br />
                「共に作る」へ。
              </h2>
              <p className="mt-5 text-base text-indigo-100/90 leading-relaxed max-w-md">
                出席管理・招待フォーム・
                <br />
                リアルタイムQ&A・ライブ投票を
                <br />
                1つのプラットフォームで。
              </p>
            </motion.div>

            {/* Middle: floating cards */}
            <div className="relative my-8 h-48 xl:h-56">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="absolute top-0 left-0 w-64 bg-white rounded-2xl shadow-2xl p-4 ring-1 ring-black/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      出席登録完了
                    </p>
                    <p className="text-xs text-slate-500">
                      現在 128 / 150 人 参加中
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="absolute bottom-0 right-0 w-64 bg-white rounded-2xl shadow-2xl p-4 ring-1 ring-black/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      新しい質問が届きました
                    </p>
                    <p className="text-xs text-slate-500">Q&Aルーム · 2分前</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bottom: highlights */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="space-y-3"
            >
              {highlights.map((h) => (
                <div
                  key={h.title}
                  className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/15"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <h.icon className="w-[18px] h-[18px] text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {h.title}
                    </p>
                    <p className="text-xs text-indigo-100/80 mt-0.5">
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
