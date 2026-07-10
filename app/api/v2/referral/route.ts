// /api/v2/referral - 自分の紹介リンクの取得（初回アクセスで自動発行）と実績
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getOrCreateReferralCode,
  getReferralStats,
  REFERRAL_MAX_REWARDS_PER_YEAR,
} from '@/lib/referral';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const [code, stats] = await Promise.all([
      getOrCreateReferralCode(user.email),
      getReferralStats(user.email),
    ]);

    const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

    return NextResponse.json({
      code,
      url: `${baseUrl}/admin/register?referral=${code}`,
      convertedCount: stats.convertedCount,
      rewardsThisYear: stats.rewardsThisYear,
      maxRewardsPerYear: REFERRAL_MAX_REWARDS_PER_YEAR,
    });
  } catch (error) {
    console.error('Referral fetch error:', error);
    return NextResponse.json({ error: '紹介情報の取得に失敗しました' }, { status: 500 });
  }
}
