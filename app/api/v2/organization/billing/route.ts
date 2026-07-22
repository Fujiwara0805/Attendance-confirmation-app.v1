// /api/v2/organization/billing - 組織のアカウント課金（Checkout・アカウント数変更・ポータル）
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  ORG_MIN_SEATS,
  ORG_SEAT_UNIT_PRICE,
  countUsedSeats,
  requireOrgRole,
} from '@/lib/organization';
import {
  TERMS_ACCEPTANCE_REQUIRED_CODE,
  TERMS_DOCUMENT_ID,
  TERMS_DOCUMENT_SHA256,
  TERMS_VERSION,
} from '@/lib/terms';
import { hasAcceptedLatestTerms } from '@/lib/terms.server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

function getAppUrl(request: Request) {
  return process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await requireOrgRole(user.email, ['owner', 'admin']);
    if (!membership) {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }

    const body = await request.json();
    const action = body?.action;
    const org = membership.organization;
    const supabase = createServerClient();

    // --- クレカ課金の開始（Stripe Checkout、quantity = アカウント数） ---
    if (action === 'checkout') {
      if (!(await hasAcceptedLatestTerms(user.email))) {
        return NextResponse.json(
          {
            code: TERMS_ACCEPTANCE_REQUIRED_CODE,
            error: '有料プランへ加入するには、現在の利用規約への同意が必要です',
            termsVersion: TERMS_VERSION,
          },
          { status: 428 }
        );
      }

      const seats = Number.parseInt(String(body?.seats), 10);
      if (!Number.isFinite(seats) || seats < ORG_MIN_SEATS || seats > 1000) {
        return NextResponse.json(
          { error: `アカウント数は${ORG_MIN_SEATS}〜1000で指定してください` },
          { status: 400 }
        );
      }

      if (
        org.billing_type === 'stripe_subscription' &&
        org.stripe_subscription_id &&
        (org.subscription_status === 'active' || org.subscription_status === 'past_due')
      ) {
        return NextResponse.json(
          { error: '既に有効なサブスクリプションがあります。アカウント数の変更は「アカウント数を変更」から行ってください' },
          { status: 400 }
        );
      }

      const usedSeats = await countUsedSeats(org.id);
      if (seats < usedSeats) {
        return NextResponse.json(
          { error: `現在${usedSeats}アカウントを使用中です。それ以上のアカウント数を指定してください` },
          { status: 400 }
        );
      }

      // 組織専用の Stripe Customer（個人の Customer とは分離する）
      let customerId = org.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: org.name,
          email: user.email,
          metadata: {
            service: 'zaseki_kun',
            organizationId: org.id,
          },
        });
        customerId = customer.id;
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('id', org.id);
      }

      const appUrl = getAppUrl(request);
      const orgMetadata = {
        userId: user.email,
        organizationId: org.id,
        productType: 'org_subscription',
        service: 'zaseki_kun',
        termsVersion: TERMS_VERSION,
        termsDocumentId: TERMS_DOCUMENT_ID,
        termsDocumentSha256: TERMS_DOCUMENT_SHA256,
      };

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        customer_update: {
          name: 'auto',
          address: 'auto',
        },
        tax_id_collection: {
          enabled: true,
        },
        line_items: [
          {
            price_data: {
              currency: 'jpy',
              product_data: {
                name: 'ざせきくん エンタープライズ（組織）プラン',
                description:
                  '組織のメンバー全員がフォーム・ルーム・履歴無制限で利用できるアカウント課金プランです（1アカウント/月）。',
                images: ['https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png'],
                metadata: {
                  category: 'software',
                  type: 'digital_service',
                  service_type: 'education_management',
                  app_name: 'zaseki_kun',
                },
              },
              unit_amount: ORG_SEAT_UNIT_PRICE,
              recurring: {
                interval: 'month',
              },
            },
            quantity: seats,
          },
        ],
        mode: 'subscription',
        success_url: `${appUrl}/admin/organization?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/admin/organization?billing=cancelled`,
        metadata: orgMetadata,
        subscription_data: {
          metadata: orgMetadata,
        },
        locale: 'ja',
        automatic_tax: {
          enabled: false,
        },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    // --- アカウント数の変更（日割り調整あり） ---
    if (action === 'update_seats') {
      const seats = Number.parseInt(String(body?.seats), 10);
      if (!Number.isFinite(seats) || seats < ORG_MIN_SEATS || seats > 1000) {
        return NextResponse.json(
          { error: `アカウント数は${ORG_MIN_SEATS}〜1000で指定してください` },
          { status: 400 }
        );
      }

      if (org.billing_type !== 'stripe_subscription' || !org.stripe_subscription_id) {
        return NextResponse.json(
          { error: 'クレジットカード決済のサブスクリプションがありません。銀行振込契約のアカウント変更はお問い合わせください' },
          { status: 400 }
        );
      }

      // 削減時は使用中アカウントを下回らせない（Stripe 更新後に矛盾を作らない）
      const usedSeats = await countUsedSeats(org.id);
      if (seats < usedSeats) {
        return NextResponse.json(
          { error: `現在${usedSeats}アカウントを使用中のため、${seats}アカウントには削減できません。先にメンバーまたは招待を減らしてください` },
          { status: 400 }
        );
      }

      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const item = subscription.items.data[0];
      if (!item) {
        return NextResponse.json({ error: 'サブスクリプションの取得に失敗しました' }, { status: 500 });
      }

      await stripe.subscriptionItems.update(item.id, {
        quantity: seats,
        proration_behavior: 'create_prorations',
      });

      // 正は webhook（customer.subscription.updated）の同期だが、UI 即時反映のため楽観更新する
      await supabase
        .from('organizations')
        .update({ seat_limit: seats, updated_at: new Date().toISOString() })
        .eq('id', org.id);

      return NextResponse.json({ success: true, seatLimit: seats });
    }

    // --- Stripe Billing Portal（請求書・支払い方法・解約の管理） ---
    if (action === 'portal') {
      if (!org.stripe_customer_id) {
        return NextResponse.json({ error: 'サブスクリプションが見つかりません' }, { status: 404 });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${getAppUrl(request)}/admin/organization`,
        ...(process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID
          ? { configuration: process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID }
          : {}),
      });

      return NextResponse.json({ url: portalSession.url });
    }

    return NextResponse.json({ error: '不明なアクションです' }, { status: 400 });
  } catch (error) {
    console.error('Organization billing error:', error);
    return NextResponse.json({ error: '処理に失敗しました' }, { status: 500 });
  }
}
