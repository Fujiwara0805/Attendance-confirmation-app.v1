import { getServerSession } from 'next-auth/next'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import type { NextAuthOptions } from 'next-auth'
import { createServerClient } from '@/lib/supabase'
import { autoJoinOrganizationByDomain } from '@/lib/organization'
import { hasPersonalPaidHistory, recordReferralRegistration, REFERRAL_COOKIE_NAME } from '@/lib/referral'

// Google 登録は /admin/login 経由のため、register ページが Cookie に保存した紹介コードを
// サインイン時に読み取って記録する。個人プランの課金・特典履歴があるユーザーには適用しない。
// 失敗してもログインを妨げない。
async function recordReferralFromCookie(email: string) {
  const referral = cookies().get(REFERRAL_COOKIE_NAME)?.value
  if (!referral) return

  if (await hasPersonalPaidHistory(email)) return

  await recordReferralRegistration(referral, email)
  try {
    cookies().delete(REFERRAL_COOKIE_NAME)
  } catch {
    // Cookie 削除不可の実行コンテキストでも記録側の unique 制約で二重記録は防がれる
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const supabase = createServerClient()
        const { data: user, error } = await supabase
          .from('admin_users')
          .select('id, email, name, password_hash')
          .eq('email', credentials.email.toLowerCase().trim())
          .single()

        if (error || !user) return null

        const isValid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google ログイン時、組織の許可ドメインに一致すれば自動参加させる。
      // 自動参加の失敗でログイン自体を妨げない。
      if (account?.provider === 'google' && user?.email) {
        try {
          await autoJoinOrganizationByDomain(user.email)
        } catch (error) {
          console.error('[auth] ドメイン自動参加に失敗しました:', error)
        }
        try {
          await recordReferralFromCookie(user.email)
        } catch (error) {
          console.error('[auth] 紹介コードの記録に失敗しました:', error)
        }
      }
      return true // すべてのアカウントを許可
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
      }
      return token
    }
  },
  pages: {
    signIn: '/admin/login',
  },
  session: {
    strategy: 'jwt',
  },
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user || null
}
