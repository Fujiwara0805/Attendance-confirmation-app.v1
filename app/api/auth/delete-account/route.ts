import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    const email = session.user.email.toLowerCase().trim()
    const supabase = createServerClient()

    // 関連データの削除（サブスクリプション、パスワードリセットトークン等）
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_email', email)

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_email', email)

    // ユーザー自身を削除
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('email', email)

    if (error) {
      console.error('Account deletion error:', error)
      return NextResponse.json(
        { error: 'アカウントの削除に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'アカウントが削除されました。',
    })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
