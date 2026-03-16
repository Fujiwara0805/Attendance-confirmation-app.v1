import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserPlanInfo } from '@/lib/subscription';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

// GET: ユーザーのサブスクリプション・使用量情報を取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const planInfo = await getUserPlanInfo(session.user.email);

    return NextResponse.json(planInfo);
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'サブスクリプション情報の取得に失敗しました' }, { status: 500 });
  }
}

// POST: Stripeカスタマーポータルセッションを作成（サブスク管理用）
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'portal') {
      // カスタマーポータルセッションを作成
      const planInfo = await getUserPlanInfo(session.user.email);

      if (!planInfo.subscription.stripeCustomerId) {
        return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 404 });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: planInfo.subscription.stripeCustomerId,
        return_url: `${process.env.NEXTAUTH_URL}/admin`,
      });

      return NextResponse.json({ url: portalSession.url });
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
  } catch (error) {
    console.error('Subscription action error:', error);
    return NextResponse.json({ error: '処理に失敗しました' }, { status: 500 });
  }
}
