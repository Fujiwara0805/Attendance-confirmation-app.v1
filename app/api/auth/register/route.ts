import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、名前は必須です' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上で入力してください' },
        { status: 400 }
      )
    }

    const emailNormalized = email.toLowerCase().trim()

    const supabase = createServerClient()

    // 既存ユーザーチェック
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', emailNormalized)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      )
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 12)

    // ユーザー作成
    const { data: user, error } = await supabase
      .from('admin_users')
      .insert({
        email: emailNormalized,
        password_hash: passwordHash,
        name: name.trim(),
      })
      .select('id, email, name')
      .single()

    if (error) {
      console.error('User creation error:', error)
      return NextResponse.json(
        { error: 'ユーザー登録に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
