import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'トークンと新しいパスワードは必須です' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上で入力してください' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // トークンの検証
    const { data: tokenData } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (!tokenData) {
      return NextResponse.json(
        { error: 'リセットリンクが無効です。もう一度パスワードリセットを行ってください。' },
        { status: 400 }
      )
    }

    // 有効期限チェック
    if (new Date() > new Date(tokenData.expires_at)) {
      // 期限切れトークンを削除
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('token', token)

      return NextResponse.json(
        { error: 'リセットリンクの有効期限が切れています。もう一度パスワードリセットを行ってください。' },
        { status: 400 }
      )
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 12)

    // パスワード更新
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ password_hash: passwordHash })
      .eq('email', tokenData.user_email)

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: 'パスワードの更新に失敗しました' },
        { status: 500 }
      )
    }

    // 使用済みトークンを削除
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token', token)

    return NextResponse.json({
      message: 'パスワードが正常にリセットされました。',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
