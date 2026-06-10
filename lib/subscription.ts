import { createServerClient } from '@/lib/supabase';
import Stripe from 'stripe';

// プラン制限
export const PLAN_LIMITS = {
  free: { maxForms: 2, maxRooms: 1, maxPolls: 2 },
  paid: { maxForms: Infinity, maxRooms: Infinity, maxPolls: Infinity },
  enterprise: { maxForms: Infinity, maxRooms: Infinity, maxPolls: Infinity },
} as const;

export type PlanType = 'free' | 'paid' | 'enterprise';

export interface SubscriptionInfo {
  plan: PlanType;
  status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
}

export interface UsageInfo {
  formCount: number;
  roomCount: number;
}

export interface PlanInfo {
  subscription: SubscriptionInfo;
  usage: UsageInfo;
  limits: { maxForms: number; maxRooms: number };
  canCreateForm: boolean;
  canCreateRoom: boolean;
}

const ENTITLED_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function getSubscriptionTimestamps(subscription: Stripe.Subscription) {
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

function getPlanFromStripeSubscription(subscription: Stripe.Subscription): PlanType {
  // 正: metadata.productType で判定する（Checkout作成時に必ず付与される）
  const productType = subscription.metadata?.productType;
  if (productType === 'enterprise_subscription') {
    return 'enterprise';
  }
  if (productType === 'pro_subscription') {
    return 'paid';
  }

  // 旧: metadata を持たないレガシーサブスクのみ金額で判定する。
  // 価格改定時に壊れるため、Stripe Dashboard で metadata 補正が済み次第このフォールバックは削除する。
  console.warn(
    `[subscription] metadata.productType がないサブスクを金額で判定しました: ${subscription.id}`
  );
  const unitAmount = subscription.items.data[0]?.price?.unit_amount;
  return unitAmount === 2000 ? 'enterprise' : 'paid';
}

function normalizeStripeStatus(status: Stripe.Subscription.Status): SubscriptionInfo['status'] {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled' || status === 'unpaid') return 'cancelled';
  return 'incomplete';
}

// ユーザーのサブスクリプション情報を取得
export async function getUserSubscription(email: string): Promise<SubscriptionInfo> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_email', email)
    .single();

  if (!data) {
    return { plan: 'free', status: 'active' };
  }

  // 有効期限切れチェック
  if ((data.plan === 'paid' || data.plan === 'enterprise') && data.current_period_end) {
    const now = new Date();
    const periodEnd = new Date(data.current_period_end);
    if (now > periodEnd && data.status !== 'active') {
      return { plan: 'free', status: 'active' };
    }
  }

  return {
    plan: data.plan as PlanType,
    status: data.status,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    currentPeriodEnd: data.current_period_end,
  };
}

// ユーザーの使用量を取得
export async function getUserUsage(email: string): Promise<UsageInfo> {
  const supabase = createServerClient();

  const { data } = await supabase.rpc('get_user_usage', { p_email: email });

  if (!data) {
    return { formCount: 0, roomCount: 0 };
  }

  return {
    formCount: data.form_count || 0,
    roomCount: data.room_count || 0,
  };
}

// フォーム作成可能かチェック
export async function canCreateForm(email: string): Promise<boolean> {
  const subscription = await getUserSubscription(email);
  const usage = await getUserUsage(email);
  const limits = PLAN_LIMITS[subscription.plan];

  return usage.formCount < limits.maxForms;
}

// ルーム作成可能かチェック
export async function canCreateRoom(email: string): Promise<boolean> {
  const subscription = await getUserSubscription(email);
  const usage = await getUserUsage(email);
  const limits = PLAN_LIMITS[subscription.plan];

  return usage.roomCount < limits.maxRooms;
}

// フルプラン情報を取得
export async function getUserPlanInfo(email: string): Promise<PlanInfo> {
  const subscription = await getUserSubscription(email);
  const usage = await getUserUsage(email);
  const limits = PLAN_LIMITS[subscription.plan];

  return {
    subscription,
    usage,
    limits,
    canCreateForm: usage.formCount < limits.maxForms,
    canCreateRoom: usage.roomCount < limits.maxRooms,
  };
}

// Stripe上で支払い済みだがWebhookを取りこぼした場合にDBを補正する
export async function syncUserSubscriptionFromStripe(
  email: string,
  stripe: Stripe
): Promise<SubscriptionInfo | null> {
  const customers = await stripe.customers.list({
    email,
    limit: 10,
  });

  const activeSubscriptions: Array<{
    customerId: string;
    subscription: Stripe.Subscription;
  }> = [];

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
    });

    for (const subscription of subscriptions.data) {
      if (ENTITLED_STRIPE_STATUSES.has(subscription.status)) {
        activeSubscriptions.push({
          customerId: customer.id,
          subscription,
        });
      }
    }
  }

  const latest = activeSubscriptions.sort(
    (a, b) => b.subscription.created - a.subscription.created
  )[0];

  if (!latest) {
    return null;
  }

  const plan = getPlanFromStripeSubscription(latest.subscription);
  const period = getSubscriptionTimestamps(latest.subscription);

  await upsertSubscription(email, {
    plan,
    status: normalizeStripeStatus(latest.subscription.status),
    stripe_customer_id: latest.customerId,
    stripe_subscription_id: latest.subscription.id,
    ...period,
  });

  return getUserSubscription(email);
}

// サブスクリプションをupsert（webhook用）
export async function upsertSubscription(
  email: string,
  data: Partial<{
    plan: PlanType;
    status: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    current_period_start: string;
    current_period_end: string;
  }>
) {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_email: email,
      ...data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    });

  if (error) {
    console.error('Failed to upsert subscription:', error);
    throw error;
  }
}
