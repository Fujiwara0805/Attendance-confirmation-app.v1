import { createServerClient } from '@/lib/supabase';

// プラン制限
export const PLAN_LIMITS = {
  free: { maxForms: 3, maxRooms: 2 },
  paid: { maxForms: Infinity, maxRooms: Infinity },
  enterprise: { maxForms: Infinity, maxRooms: Infinity },
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
