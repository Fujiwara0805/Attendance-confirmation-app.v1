import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { upsertSubscription, getUserSubscription } from '@/lib/subscription';
import { createServerClient } from '@/lib/supabase';
import { convertReferralAndReward } from '@/lib/referral';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const ENTITLED_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function normalizeStripeStatus(status: Stripe.Subscription.Status) {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid') return 'cancelled';
  return 'incomplete';
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

function getPlanFromProductType(productType?: string | null) {
  return productType === 'enterprise_subscription' ? 'enterprise' : 'paid';
}

async function getCustomerEmail(customerId?: string | null) {
  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return null;

  return customer.email;
}

async function getCheckoutSessionEmail(session: Stripe.Checkout.Session) {
  return (
    session.metadata?.userId ||
    session.customer_details?.email ||
    session.customer_email ||
    await getCustomerEmail(session.customer as string | null)
  );
}

async function getInvoiceEmail(invoice: Stripe.Invoice) {
  return invoice.customer_email || await getCustomerEmail(invoice.customer as string | null);
}

function getPlanForSubscription(
  subscription: Stripe.Subscription,
  fallbackProductType?: string | null
) {
  if (subscription.metadata?.productType || fallbackProductType) {
    return getPlanFromProductType(subscription.metadata?.productType || fallbackProductType);
  }

  const unitAmount = subscription.items.data[0]?.price?.unit_amount;
  return unitAmount === 2000 ? 'enterprise' : 'paid';
}

// ---- 組織（アカウント課金）サブスク ----
// 組織サブスクのイベントを個人 subscriptions のパスに落とすと、Customer email 経由で
// オーナー個人のプランを誤って上書きしてしまう。各ハンドラの先頭で
// metadata.productType === 'org_subscription' を判定し、organizations テーブルのみ更新する。

function normalizeOrgStatus(subscription: Stripe.Subscription) {
  if (subscription.cancel_at_period_end) return 'cancelled';
  const normalized = normalizeStripeStatus(subscription.status);
  return normalized === 'incomplete' ? 'inactive' : normalized;
}

async function syncOrganizationSubscription(
  organizationId: string,
  subscription: Stripe.Subscription
) {
  const supabase = createServerClient();
  const quantity = subscription.items.data[0]?.quantity;

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: normalizeOrgStatus(subscription),
      billing_type: 'stripe_subscription',
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      ...(typeof quantity === 'number' ? { seat_limit: quantity } : {}),
      ...getSubscriptionPeriod(subscription),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    console.error(`Failed to sync organization subscription (${organizationId}):`, error);
  } else {
    console.log(`Organization subscription synced: ${organizationId} (${subscription.status})`);
  }
}

// サブスク由来の invoice から subscription metadata を取り出す
// （2025 basil API では invoice.parent.subscription_details に入る）
function getInvoiceSubscriptionMetadata(invoice: Stripe.Invoice): Record<string, string> | null {
  const inv = invoice as any;
  return inv.parent?.subscription_details?.metadata || inv.subscription_details?.metadata || null;
}

async function activateInstitutionalInvoice(invoice: Stripe.Invoice) {
  if (invoice.metadata?.billing_flow !== 'institutional_billing') return;

  // 組織（アカウント課金）の銀行振込: organizations を有効化し、個人 subscriptions には触れない
  if (invoice.metadata.productType === 'org_subscription' && invoice.metadata.organizationId) {
    const supabase = createServerClient();
    const seatCount = Number.parseInt(invoice.metadata.seatCount || '', 10);
    const { error } = await supabase
      .from('organizations')
      .update({
        subscription_status: 'active',
        billing_type: 'invoice',
        stripe_customer_id: invoice.customer as string,
        ...(Number.isFinite(seatCount) && seatCount > 0 ? { seat_limit: seatCount } : {}),
        current_period_start: invoice.metadata.periodStart,
        current_period_end: invoice.metadata.periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.metadata.organizationId);

    if (error) {
      console.error(
        `Failed to activate org institutional invoice (${invoice.metadata.organizationId}):`,
        error
      );
    } else {
      console.log(
        `Institutional org invoice paid for ${invoice.metadata.organizationId}: ${invoice.id}`
      );
    }
    return;
  }

  const email = invoice.metadata.userId || await getInvoiceEmail(invoice);
  if (!email) {
    console.error('Institutional invoice paid without resolvable email:', invoice.id);
    return;
  }

  const productType = invoice.metadata.productType;
  const plan = productType === 'enterprise_subscription' ? 'enterprise' : 'paid';

  await upsertSubscription(email, {
    plan,
    status: 'active',
    stripe_customer_id: invoice.customer as string,
    current_period_start: invoice.metadata.periodStart,
    current_period_end: invoice.metadata.periodEnd,
  });

  console.log(`Institutional ${plan} invoice paid for ${email}: ${invoice.id}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = headers().get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    switch (event.type) {
      // サブスクリプション開始（チェックアウト完了）
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription') {
          // 組織サブスク: organizations のみ更新し、個人 subscriptions には触れない
          if (session.metadata?.productType === 'org_subscription') {
            const organizationId = session.metadata.organizationId;
            const orgSubscription = session.subscription
              ? await stripe.subscriptions.retrieve(session.subscription as string)
              : null;
            if (organizationId && orgSubscription) {
              await syncOrganizationSubscription(organizationId, orgSubscription);
            } else {
              console.error('Org checkout completed without organizationId/subscription:', session.id);
            }
            break;
          }

          const email = await getCheckoutSessionEmail(session);
          const subscription = session.subscription
            ? await stripe.subscriptions.retrieve(session.subscription as string)
            : null;

          if (!email) {
            console.error('Checkout session completed without resolvable email:', session.id);
            break;
          }

          const plan = subscription
            ? getPlanForSubscription(subscription, session.metadata?.productType)
            : getPlanFromProductType(session.metadata?.productType);

          await upsertSubscription(email, {
            plan,
            status: subscription ? normalizeStripeStatus(subscription.status) : 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            ...(subscription ? getSubscriptionPeriod(subscription) : {}),
          });
          console.log(`${plan === 'enterprise' ? 'Enterprise' : 'Pro'} subscription started for ${email}`);

          // 紹介成立の確定と紹介者特典の付与（べき等。紹介なしなら何もしない）
          try {
            await convertReferralAndReward(stripe, email, session.id);
          } catch (referralError) {
            console.error('[referral] 紹介成立処理に失敗しました:', referralError);
          }
        }
        break;
      }

      // サブスクリプション更新（更新・キャンセル予約など）
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // 組織サブスク: organizations のみ更新（seat_limit も quantity から同期）
        if (subscription.metadata?.productType === 'org_subscription') {
          const organizationId = subscription.metadata.organizationId;
          if (organizationId) {
            await syncOrganizationSubscription(organizationId, subscription);
          } else {
            console.error('Org subscription updated without organizationId:', subscription.id);
          }
          break;
        }

        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if ('email' in customer && customer.email) {
          const status = subscription.cancel_at_period_end ? 'cancelled' : 'active';
          // metadataがない既存サブスクでは現在のプランタイプを維持する
          const currentSub = await getUserSubscription(customer.email);
          const currentPlan = getPlanForSubscription(
            subscription,
            currentSub.plan === 'enterprise' ? 'enterprise_subscription' : 'pro_subscription'
          );
          await upsertSubscription(customer.email, {
            plan: ENTITLED_STRIPE_STATUSES.has(subscription.status) ? currentPlan : 'free',
            status: subscription.cancel_at_period_end ? status : normalizeStripeStatus(subscription.status),
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            ...getSubscriptionPeriod(subscription),
          });
          console.log(`Subscription updated for ${customer.email}: ${status}`);
        }
        break;
      }

      // サブスクリプション削除（完全キャンセル）
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // 組織サブスク: 即時に組織プランの適用を終了させる
        if (subscription.metadata?.productType === 'org_subscription') {
          const organizationId = subscription.metadata.organizationId;
          if (organizationId) {
            const endedAt = (subscription as any).ended_at
              ? new Date((subscription as any).ended_at * 1000).toISOString()
              : new Date().toISOString();
            const supabase = createServerClient();
            const { error } = await supabase
              .from('organizations')
              .update({
                subscription_status: 'cancelled',
                current_period_end: endedAt,
                updated_at: new Date().toISOString(),
              })
              .eq('id', organizationId);
            if (error) {
              console.error(`Failed to cancel organization subscription (${organizationId}):`, error);
            } else {
              console.log(`Organization subscription cancelled: ${organizationId}`);
            }
          } else {
            console.error('Org subscription deleted without organizationId:', subscription.id);
          }
          break;
        }

        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if ('email' in customer && customer.email) {
          await upsertSubscription(customer.email, {
            plan: 'free',
            status: 'cancelled',
          });
          console.log(`Subscription cancelled for ${customer.email}`);
        }
        break;
      }

      // 支払い失敗
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // 組織サブスクの請求失敗: 組織を past_due に（個人 subscriptions には触れない）
        const orgMeta = getInvoiceSubscriptionMetadata(invoice);
        if (orgMeta?.productType === 'org_subscription' && orgMeta.organizationId) {
          const supabase = createServerClient();
          const { error } = await supabase
            .from('organizations')
            .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', orgMeta.organizationId);
          if (error) {
            console.error(`Failed to mark organization past_due (${orgMeta.organizationId}):`, error);
          } else {
            console.log(`Organization payment failed: ${orgMeta.organizationId}`);
          }
          break;
        }

        const email = await getInvoiceEmail(invoice);
        if (email) {
          await upsertSubscription(email, {
            status: 'past_due',
          });
          console.log(`Payment failed for ${email}`);
        }
        break;
      }

      // 銀行振込払いの請求書支払い完了
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await activateInstitutionalInvoice(invoice);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
