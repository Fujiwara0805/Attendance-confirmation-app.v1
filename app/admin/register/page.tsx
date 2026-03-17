'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { UserPlus, Loader2, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

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

    // バリデーション
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
      // 1. 新規登録
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

      // 2. 登録成功 → 自動ログイン
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        // 登録は成功したがログインに失敗 → ログイン画面へ誘導
        setStep('complete')
      } else {
        // 登録＋ログイン成功 → 管理画面へ
        router.push('/admin')
      }
    } catch {
      setError('登録中にエラーが発生しました。しばらくしてから再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  // 登録完了画面（自動ログインに失敗した場合のフォールバック）
  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-xl border-0 text-center">
            <CardContent className="pt-10 pb-8 space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
              >
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">登録が完了しました！</h2>
                <p className="text-slate-600 mt-2">
                  アカウントが作成されました。
                  <br />
                  ログイン画面からログインしてください。
                </p>
              </div>
              <Link href="/admin/login">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  ログイン画面へ
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* 戻るリンク */}
        <div className="mb-4">
          <Link href="/admin/login">
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" />
              ログイン画面に戻る
            </Button>
          </Link>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4 p-3 bg-gradient-to-br rounded-xl shadow-lg w-fit"
            >
              <Image
                src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                alt="ざせきくん"
                width={80}
                height={80}
                className="rounded"
              />
            </motion.div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              新規アカウント登録
            </CardTitle>
            <p className="text-slate-600 mt-2 text-sm">
              管理者アカウントを作成して、
              <br className="sm:hidden" />
              ざせきくんの全機能をご利用ください
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {/* 名前 */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                  名前 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="例: 田中太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                  autoFocus
                />
              </div>

              {/* メールアドレス */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  メールアドレス <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* パスワード */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  パスワード <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="6文字以上で入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">半角英数字6文字以上</p>
              </div>

              {/* パスワード確認 */}
              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-700">
                  パスワード（確認） <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="passwordConfirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="もう一度入力してください"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* エラー表示 */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              {/* 登録ボタン */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium mt-2"
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

              {/* ログインリンク */}
              <p className="text-center text-sm text-slate-500 pt-2">
                すでにアカウントをお持ちですか？{' '}
                <Link
                  href="/admin/login"
                  className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                >
                  ログイン
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
