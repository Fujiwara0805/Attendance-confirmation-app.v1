import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください' },
        { status: 400 }
      )
    }

    const emailNormalized = email.toLowerCase().trim()
    const supabase = createServerClient()

    // ユーザーの存在確認
    const { data: user } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', emailNormalized)
      .single()

    // ユーザーが見つからなくても同じレスポンスを返す（セキュリティ）
    if (!user) {
      return NextResponse.json({
        message: 'メールアドレスが登録されている場合、パスワードリセット用のリンクを表示します。',
      })
    }

    // リセットトークン生成
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1時間有効

    // 既存のトークンを削除してから新しいトークンを挿入
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_email', emailNormalized)

    const { error } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_email: emailNormalized,
        token,
        expires_at: expiresAt,
      })

    if (error) {
      console.error('Token insert error:', error)
      return NextResponse.json(
        { error: 'トークンの生成に失敗しました' },
        { status: 500 }
      )
    }

    // リセットURL生成
    const baseUrl = req.nextUrl.origin
    const resetUrl = `${baseUrl}/admin/reset-password?token=${token}`

    return NextResponse.json({
      message: 'パスワードリセットリンクを生成しました。',
      resetUrl,
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
