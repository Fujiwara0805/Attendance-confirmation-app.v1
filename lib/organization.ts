import { createServerClient } from '@/lib/supabase';

// 組織（エンタープライズ）プランの料金・制限
// UI上の呼称は「アカウント」（1アカウント=1メンバー枠）。コード内部の識別子は seat のまま
export const ORG_SEAT_UNIT_PRICE = 500; // 円/アカウント/月
export const ORG_MIN_SEATS = 2;
export const ORG_INVITATION_EXPIRY_DAYS = 7;

// ドメイン自動参加に登録できないフリーメール等のドメイン
export const BLOCKED_AUTO_JOIN_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.co.jp',
  'yahoo.com',
  'ymail.ne.jp',
  'outlook.com',
  'outlook.jp',
  'hotmail.com',
  'hotmail.co.jp',
  'live.jp',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'docomo.ne.jp',
  'ezweb.ne.jp',
  'au.com',
  'softbank.ne.jp',
  'i.softbank.jp',
]);

export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';
export type OrgBillingType = 'stripe_subscription' | 'invoice';

export interface Organization {
  id: string;
  name: string;
  owner_email: string;
  seat_limit: number;
  subscription_status: OrgSubscriptionStatus;
  billing_type: OrgBillingType | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  organization: Organization;
  role: OrgRole;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function extractDomain(email: string): string | null {
  const domain = normalizeEmail(email).split('@')[1];
  return domain || null;
}

// ユーザーが所属する組織を取得（1ユーザー=1組織）
export async function getOrganizationForUser(email: string): Promise<OrgMembership | null> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('organization_members')
    .select('role, organizations(*)')
    .eq('member_email', normalizeEmail(email))
    .single();

  if (!data?.organizations) return null;

  return {
    organization: data.organizations as unknown as Organization,
    role: data.role as OrgRole,
  };
}

// 組織サブスクが有効（メンバーに enterprise を付与できる状態）か。
// - active: Stripe サブスクは webhook が status を正に保つため status だけで判定。
//   請求書払い（invoice）は自動更新がないため current_period_end で厳密判定。
// - past_due / cancelled: 支払い猶予・解約予約中は期間終了まで利用可（個人プランと同じ挙動）。
export function isOrgEntitled(org: Organization): boolean {
  const periodEnd = org.current_period_end ? new Date(org.current_period_end).getTime() : null;
  const withinPeriod = periodEnd != null && periodEnd >= Date.now();

  if (org.subscription_status === 'active') {
    return org.billing_type === 'invoice' ? withinPeriod : true;
  }
  if (org.subscription_status === 'past_due' || org.subscription_status === 'cancelled') {
    return withinPeriod;
  }
  return false;
}

// 使用中アカウント数 = メンバー数 + 未受諾かつ未失効の招待数（招待発行時点でアカウントを消費する）
export async function countUsedSeats(organizationId: string): Promise<number> {
  const supabase = createServerClient();
  const nowIso = new Date().toISOString();

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('organization_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .gt('expires_at', nowIso),
  ]);

  return (membersRes.count ?? 0) + (invitesRes.count ?? 0);
}

// 2人が「有効なサブスクを持つ同一組織」の共同メンバーか（共有ライブラリの複製認可に使う）
export async function areOrgCoMembers(emailA: string, emailB: string): Promise<boolean> {
  const membership = await getOrganizationForUser(emailA);
  if (!membership || !isOrgEntitled(membership.organization)) return false;

  const supabase = createServerClient();
  const { count } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', membership.organization.id)
    .eq('member_email', normalizeEmail(emailB));

  return (count ?? 0) > 0;
}

// 指定ロールを持つメンバーシップを返す。所属なし・権限不足は null
export async function requireOrgRole(
  email: string,
  roles: OrgRole[]
): Promise<OrgMembership | null> {
  const membership = await getOrganizationForUser(email);
  if (!membership || !roles.includes(membership.role)) return null;
  return membership;
}

// Google ログイン時のドメイン自動参加。
// 許可ドメインに一致・未所属・アカウントに空きがある場合のみ member として参加させる。
// 失敗してもログイン自体は妨げない（呼び出し側で try/catch する）。
export async function autoJoinOrganizationByDomain(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const domain = extractDomain(normalized);
  if (!domain) return;

  const supabase = createServerClient();

  // 既所属なら何もしない（1ユーザー=1組織）
  const { count: memberCount } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('member_email', normalized);
  if ((memberCount ?? 0) > 0) return;

  const { data: domainRow } = await supabase
    .from('organization_domains')
    .select('organization_id, organizations(*)')
    .eq('domain', domain)
    .single();
  if (!domainRow?.organizations) return;

  const org = domainRow.organizations as unknown as Organization;

  // 満杯なら参加しない（アカウントが空いた後のログインで参加する）
  const usedSeats = await countUsedSeats(org.id);
  if (usedSeats >= org.seat_limit) return;

  const { error } = await supabase.from('organization_members').insert({
    organization_id: org.id,
    member_email: normalized,
    role: 'member',
  });
  // 同時ログイン等による unique 制約違反は無視（既に参加済み扱い）
  if (error && error.code !== '23505') {
    console.error('[organization] ドメイン自動参加に失敗しました:', error);
  }
}
