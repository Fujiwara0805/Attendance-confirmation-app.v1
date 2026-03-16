import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { upsertSubscription } from '@/lib/subscription';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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

        if (session.mode === 'subscription' && session.customer_email) {
          await upsertSubscription(session.customer_email, {
            plan: 'paid',
            status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          });
          console.log(`Pro subscription started for ${session.customer_email}`);
        }
        break;
      }

      // サブスクリプション更新（更新・キャンセル予約など）
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);

        if ('email' in customer && customer.email) {
          const status = subscription.cancel_at_period_end ? 'cancelled' : 'active';
          await upsertSubscription(customer.email, {
            plan: subscription.status === 'active' ? 'paid' : 'free',
            status,
            stripe_subscription_id: subscription.id,
            current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
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
        if (invoice.customer_email) {
          await upsertSubscription(invoice.customer_email, {
            status: 'past_due',
          });
          console.log(`Payment failed for ${invoice.customer_email}`);
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
