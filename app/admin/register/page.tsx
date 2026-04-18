'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import {
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Users,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'

export default function AdminRegisterPage() {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'complete'>('form')
  const router = useRouter()

  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        router.push('/admin')
      }
    })
  }, [router])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    if (!email.trim()) {
      setError('メールアドレスを入力してください')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('有効なメールアドレスを入力してください')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登録に失敗しました')
        return
      }

      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setStep('complete')
      } else {
        router.push('/admin')
      }
    } catch {
      setError(
        '登録中にエラーが発生しました。しばらくしてから再度お試しください。'
      )
    } finally {
      setLoading(false)
    }
  }

  // ─── Complete screen ───
  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 px-8 py-10 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-50 mb-6"
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              登録が完了しました！
            </h2>
            <p className="text-slate-500 mt-3 leading-relaxed">
              アカウントが作成されました。
              <br />
              ログイン画面からログインしてください。
            </p>
            <Link href="/admin/login" className="block mt-8">
              <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200/50 font-semibold">
                ログイン画面へ
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  const benefits = [
    {
      icon: Users,
      title: '参加者管理がワンストップ',
      desc: '招待フォーム、事前登録、QRコード発行まで一気通貫。',
    },
    {
      icon: MessageSquare,
      title: '双方向コミュニケーション',
      desc: 'リアルタイムQ&Aとライブ投票で会場を巻き込む。',
    },
    {
      icon: BarChart3,
      title: 'データをすぐに可視化',
      desc: 'CSV / Excelエクスポートで分析もスムーズ。',
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
            {/* Back link */}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              ログイン画面に戻る
            </Link>

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
                新規アカウント登録
              </h1>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                管理者アカウントを作成して、
                <br className="sm:hidden" />
                ざせきくんの全機能をご利用ください。
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-sm font-semibold text-slate-700"
                >
                  名前 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="例: 田中太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-semibold text-slate-700"
                >
                  メールアドレス <span className="text-red-500">*</span>
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
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700"
                >
                  パスワード <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="6文字以上で入力"
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
                <p className="text-xs text-slate-400 mt-1">
                  半角英数字6文字以上
                </p>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="passwordConfirm"
                  className="text-sm font-semibold text-slate-700"
                >
                  パスワード（確認） <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="passwordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="もう一度入力してください"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
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
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    登録中...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    アカウントを作成
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-slate-500 pt-2">
                すでにアカウントをお持ちですか？{' '}
                <Link
                  href="/admin/login"
                  className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                >
                  ログイン
                </Link>
              </p>
            </form>
          </motion.div>
        </div>

        {/* ─── Right: Brand Panel ─── */}
        <div className="hidden lg:block relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl" />

          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10 h-full flex flex-col justify-between p-14">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-white bg-white/15 border border-white/20 rounded-full px-3.5 py-1.5 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5" />
                無料プランから、すぐに開始
              </span>
              <h2 className="mt-6 text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                今すぐ無料で、
                <br />
                ざせきくんを
                <br />
                始めましょう。
              </h2>
              <p className="mt-5 text-base text-indigo-100/90 leading-relaxed max-w-md">
                初期費用ゼロ、セットアップは1分。
                <br />
                まずは無料プランで、全ての機能を
                <br />
                体験してください。
              </p>
            </motion.div>

            {/* Plan preview card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="my-8 bg-white rounded-2xl shadow-2xl p-6 ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                    Free プラン
                  </p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    ¥0
                    <span className="text-sm font-normal text-slate-400 ml-1">
                      / 月
                    </span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <ul className="space-y-2.5 mt-4">
                {[
                  'フォーム 3個まで作成',
                  'ルーム 2個まで作成',
                  'Q&A・投票機能',
                  'CSV / Excelエクスポート',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-slate-600"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="space-y-3"
            >
              {benefits.map((b) => (
                <div
                  key={b.title}
                  className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/15"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {b.title}
                    </p>
                    <p className="text-xs text-indigo-100/80 mt-0.5">
                      {b.desc}
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
