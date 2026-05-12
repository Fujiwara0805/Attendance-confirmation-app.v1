import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { upsertSubscription, getUserSubscription } from '@/lib/subscription';

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
        }
        break;
      }

      // サブスクリプション更新（更新・キャンセル予約など）
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
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
        const email = await getInvoiceEmail(invoice);
        if (email) {
          await upsertSubscription(email, {
            status: 'past_due',
          });
          console.log(`Payment failed for ${email}`);
        }
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
