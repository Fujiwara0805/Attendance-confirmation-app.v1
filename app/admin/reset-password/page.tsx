'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import {
  Lock,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 mb-5">
          <Lock className="w-7 h-7 text-red-500" />
        </div>
        <p className="text-slate-700 font-semibold mb-2">
          無効なリセットリンクです
        </p>
        <p className="text-sm text-slate-500 mb-6">
          もう一度パスワードリセットを実行してください。
        </p>
        <Link href="/admin/forgot-password">
          <Button
            variant="outline"
            className="rounded-xl border-slate-200 hover:bg-slate-50"
          >
            パスワードリセットをやり直す
          </Button>
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password.trim()) {
      setError('新しいパスワードを入力してください')
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'エラーが発生しました')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/admin/login')
      }, 3000)
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-10 text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          パスワードをリセットしました
        </h3>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          3秒後にログインページへ移動します...
        </p>
        <Link href="/admin/login" className="block mt-6">
          <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200/50 font-semibold">
            今すぐログインページへ
          </Button>
        </Link>
      </motion.div>
    )
  }

  return (
    <>
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
          <Lock className="w-6 h-6 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          新しいパスワードを設定
        </h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          6文字以上の新しいパスワードを入力してください。
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-semibold text-slate-700"
          >
            新しいパスワード
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pr-11 rounded-xl border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              autoFocus
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

        <div className="space-y-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-semibold text-slate-700"
          >
            パスワード（確認）
          </Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="もう一度入力"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Lock className="w-4 h-4 mr-2" />
          )}
          パスワードを変更
        </Button>
      </motion.form>
    </>
  )
}

export default function ResetPasswordPage() {
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
            <Suspense
              fallback={
                <div className="flex justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>
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
                Step 2 / 2
              </span>
              <h2 className="mt-6 text-4xl xl:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                新しいパスワードで、
                <br />
                ログインを再開。
              </h2>
              <p className="mt-5 text-base text-indigo-100/90 leading-relaxed max-w-md">
                推測されにくい、他のサービスと
                <br />
                異なるパスワードの設定をおすすめします。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/15"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    パスワード作成のヒント
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs text-indigo-100/80 leading-relaxed">
                    <li>・ 英数字・記号を組み合わせる</li>
                    <li>・ 6文字以上（推奨: 12文字以上）</li>
                    <li>・ 他サービスと使い回さない</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
