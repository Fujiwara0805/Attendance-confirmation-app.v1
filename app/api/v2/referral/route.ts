// /api/v2/referral - 紹介情報の取得と、既存アカウントへの紹介コード適用
// GET: Pro/Enterprise には自分の紹介リンク（初回アクセスで自動発行）と実績、
//      全ユーザーには被紹介者としての状態（referredStatus）を返す
// POST: Free ユーザーが紹介URL/コードを入力して自分に適用する（リンク経由登録と同じ扱い）
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserSubscription } from '@/lib/subscription';
import {
  applyReferralCode,
  getOrCreateReferralCode,
  getReferralStats,
  getReferredStatus,
  hasPersonalPaidHistory,
  REFERRAL_MAX_REWARDS_PER_YEAR,
} from '@/lib/referral';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const [subscription, referredStatus] = await Promise.all([
      getUserSubscription(user.email),
      getReferredStatus(user.email),
    ]);

    // Free は紹介を「受ける側」なのでリンクを発行しない（共有カードも表示されない）
    const canRefer = subscription.plan !== 'free';
    if (!canRefer) {
      return NextResponse.json({ canRefer, referredStatus });
    }

    const [code, stats] = await Promise.all([
      getOrCreateReferralCode(user.email),
      getReferralStats(user.email),
    ]);

    const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;

    return NextResponse.json({
      canRefer,
      referredStatus,
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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const input = typeof body?.code === 'string' ? body.code : '';
    if (!input.trim()) {
      return NextResponse.json({ error: '紹介リンクまたはコードを入力してください' }, { status: 400 });
    }

    // 対象は Free のみ（Pro 課金中・組織エンタープライズは対象外）
    const subscription = await getUserSubscription(user.email);
    if (subscription.plan !== 'free') {
      return NextResponse.json({ error: 'Freeプランの方のみ利用できます' }, { status: 400 });
    }

    // 規約同意のためだけに作成されたFree行は除外し、実際の課金・特典履歴で判定する。
    if (await hasPersonalPaidHistory(user.email)) {
      return NextResponse.json(
        { error: 'Proプランのご利用履歴があるため、紹介の対象外です' },
        { status: 400 }
      );
    }

    const result = await applyReferralCode(input, user.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ applied: true });
  } catch (error) {
    console.error('Referral apply error:', error);
    return NextResponse.json({ error: '紹介コードの適用に失敗しました' }, { status: 500 });
  }
}
