import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserPlanInfo, syncUserSubscriptionFromStripe, upsertSubscription } from '@/lib/subscription';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

function getAppUrl(request: Request) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const stripeSubscription = subscription as any;

  return {
    current_period_start: stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
      : undefined,
    current_period_end: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : undefined,
  };
}

// GET: ユーザーのサブスクリプション・使用量情報を取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    let planInfo = await getUserPlanInfo(session.user.email);

    if (
      planInfo.subscription.plan === 'free' ||
      planInfo.subscription.status === 'incomplete'
    ) {
      await syncUserSubscriptionFromStripe(session.user.email, stripe);
      planInfo = await getUserPlanInfo(session.user.email);
    }

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
      let planInfo = await getUserPlanInfo(session.user.email);

      if (!planInfo.subscription.stripeCustomerId) {
        await syncUserSubscriptionFromStripe(session.user.email, stripe);
        planInfo = await getUserPlanInfo(session.user.email);
      }

      if (!planInfo.subscription.stripeCustomerId) {
        return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 404 });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: planInfo.subscription.stripeCustomerId,
        return_url: `${getAppUrl(request)}/admin`,
        ...(process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID
          ? { configuration: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID }
          : {}),
      });

      return NextResponse.json({ url: portalSession.url });
    }

    if (action === 'cancel') {
      let planInfo = await getUserPlanInfo(session.user.email);

      if (!planInfo.subscription.stripeSubscriptionId || !planInfo.subscription.stripeCustomerId) {
        await syncUserSubscriptionFromStripe(session.user.email, stripe);
        planInfo = await getUserPlanInfo(session.user.email);
      }

      if (!planInfo.subscription.stripeSubscriptionId || !planInfo.subscription.stripeCustomerId) {
        return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 404 });
      }

      const subscription = await stripe.subscriptions.update(
        planInfo.subscription.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

      await upsertSubscription(session.user.email, {
        plan: planInfo.subscription.plan,
        status: 'cancelled',
        stripe_customer_id: planInfo.subscription.stripeCustomerId,
        stripe_subscription_id: subscription.id,
        ...getSubscriptionPeriod(subscription),
      });

      const updatedPlanInfo = await getUserPlanInfo(session.user.email);
      return NextResponse.json(updatedPlanInfo);
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
  } catch (error) {
    console.error('Subscription action error:', error);
    return NextResponse.json({ error: '処理に失敗しました' }, { status: 500 });
  }
}
