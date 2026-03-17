'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Chrome, Shield, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }
    if (mode === 'register' && !name.trim()) {
      setError('名前を入力してください')
      return
    }

    setEmailLoading(true)
    try {
      if (mode === 'register') {
        // 新規登録
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '登録に失敗しました')
          return
        }
      }

      // ログイン
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
      setError('認証中にエラーが発生しました')
    } finally {
      setEmailLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-4 p-3 bg-gradient-to-br rounded-xl shadow-lg w-fit"
            >
              <Image
                src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                alt="ざせきくん"
                width={100}
                height={100}
                className="rounded"
              />
            </motion.div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              管理者ログイン
            </CardTitle>
            <p className="text-slate-600 mt-2">
              出席管理・Q&A・投票など、
              <br className="sm:hidden" />
              すべての機能を管理できます
            </p>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Google ログイン */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm transition-all duration-200"
                variant="outline"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Chrome className="w-5 h-5 mr-3 text-blue-600" />
                    Googleでログイン
                  </>
                )}
              </Button>
            </motion.div>

            {/* 区切り線 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400">または</span>
              </div>
            </div>

            {/* メールアドレスログイン */}
            <motion.form
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onSubmit={handleEmailAuth}
              className="space-y-3"
            >
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700">名前</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="例: 田中太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">パスワード</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="6文字以上"
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
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={emailLoading}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {emailLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {mode === 'login' ? 'メールアドレスでログイン' : 'アカウントを作成'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                >
                  {mode === 'login' ? 'アカウントをお持ちでない方はこちら' : 'ログインはこちら'}
                </button>
              </div>
            </motion.form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm font-medium text-blue-900">管理者機能について</p>
              </div>
              <p className="text-sm text-blue-800 mt-2">
                ログインすると、
                <br className="sm:hidden" />
                フォームの作成・編集・削除、
                <br className="sm:hidden" />
                Q&Aルームの管理、
                <br className="sm:hidden" />
                出席データのエクスポートが可能になります。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4"
            >
              <p className="text-sm text-amber-800">
                <strong>参加者の方へ:</strong> 出席登録やQ&A・投票への参加にログインは不要です。
                <br className="sm:hidden" />
                共有されたURLまたはQRコードからアクセスしてください。
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
