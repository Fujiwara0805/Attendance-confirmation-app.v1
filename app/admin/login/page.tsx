'use client'

import { signIn, getSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Chrome, Shield, Settings, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 既にログインしている場合は管理者画面にリダイレクト
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* 戻るボタン */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              出席管理画面に戻る
            </Button>
          </Link>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-4 p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg w-fit"
            >
              <Settings className="h-8 w-8 text-white" />
            </motion.div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              管理者ログイン
            </CardTitle>
            <p className="text-slate-600 mt-2">
              講義管理にはGoogleアカウントでのログインが必要です
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
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
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Chrome className="w-5 h-5 mr-3 text-blue-600" />
                    Googleでログイン
                  </>
                )}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <p className="text-sm font-medium text-blue-900">管理者機能について</p>
              </div>
              <p className="text-sm text-blue-800 mt-2">
                管理者としてログインすると、講義の追加・編集・削除が可能になります。
                あなたが作成した講義のみを管理できます。
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4"
            >
              <p className="text-sm text-amber-800">
                <strong>注意:</strong> 出席管理フォームはログイン不要でご利用いただけます。
                学生の皆さんは通常通りアクセスしてください。
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
