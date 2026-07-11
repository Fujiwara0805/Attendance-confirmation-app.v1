import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';
import { normalizeEmail } from '@/lib/organization';
import { getPersonalSubscription, upsertSubscription } from '@/lib/subscription';

// 紹介（リファラル）制度
// - 紹介リンク: /admin/register?referral=CODE
// - 被紹介者: Pro 初回 Checkout に 100%オフ once クーポンを自動適用（初月無料）
// - 紹介者: 成立（被紹介者の初回Checkout完了）ごとに Pro 1ヶ月無料
//   （Stripe課金中なら次回請求にクーポン / それ以外はDB付与で自然失効）

export const REFERRAL_COUPON_ID = 'zaseki_kun_referral_1m_free';
export const REFERRAL_MAX_REWARDS_PER_YEAR = 3;
export const REFERRAL_CODE_REGEX = /^[A-Z0-9]{8}$/;
export const REFERRAL_COOKIE_NAME = 'zaseki_referral';

// 紛らわしい文字（0/O, 1/I/L）を除いた文字集合
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// 自分の紹介コードを取得（無ければ発行）
export async function getOrCreateReferralCode(email: string): Promise<string> {
  const supabase = createServerClient();
  const owner = normalizeEmail(email);

  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('owner_email', owner)
    .single();
  if (existing?.code) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from('referral_codes')
      .insert({ code, owner_email: owner });
    if (!error) return code;
    if (error.code === '23505') {
      // code 衝突なら再生成、owner_email 衝突なら並行発行済みの行を返す
      const { data: race } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('owner_email', owner)
        .single();
      if (race?.code) return race.code;
      continue;
    }
    throw error;
  }
  throw new Error('紹介コードの発行に失敗しました');
}

// 紹介経由の登録を記録する。登録処理を妨げないよう、失敗は握りつぶしてログのみ。
// - 自己紹介（コード所有者 = 被紹介者）は記録しない
// - 同じ被紹介メールの2回目以降は unique 制約で弾かれ、静かに無視する
export async function recordReferralRegistration(
  code: string,
  referredEmail: string
): Promise<void> {
  try {
    const normalized = code.toUpperCase().trim();
    if (!REFERRAL_CODE_REGEX.test(normalized)) return;

    const supabase = createServerClient();
    const referred = normalizeEmail(referredEmail);

    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('code, owner_email')
      .eq('code', normalized)
      .single();
    if (!codeRow) return;
    if (codeRow.owner_email === referred) return; // 自己紹介ブロック

    const { error } = await supabase.from('referral_events').insert({
      referral_code: codeRow.code,
      referrer_email: codeRow.owner_email,
      referred_email: referred,
    });
    if (error && error.code !== '23505') {
      console.error('[referral] 紹介登録の記録に失敗しました:', error);
    }
  } catch (error) {
    console.error('[referral] 紹介登録の記録に失敗しました:', error);
  }
}

// 既存アカウントへの紹介コード適用（アカウント設定画面の入力から呼ぶ）。
// 登録フローの recordReferralRegistration と違い、結果をユーザーに提示するため
// 失敗理由を明示的に返す。入力は紹介URL全体でもコード単体でも受け付ける。
export async function applyReferralCode(
  rawInput: string,
  referredEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let input = rawInput.trim();
  try {
    input = new URL(input).searchParams.get('referral') ?? '';
  } catch {
    // URL でなければコード単体とみなす
  }
  const normalized = input.toUpperCase().trim();
  if (!REFERRAL_CODE_REGEX.test(normalized)) {
    return { ok: false, error: '紹介コードの形式が正しくありません。紹介リンクをそのまま貼り付けてください' };
  }

  const supabase = createServerClient();
  const referred = normalizeEmail(referredEmail);

  const { data: codeRow } = await supabase
    .from('referral_codes')
    .select('code, owner_email')
    .eq('code', normalized)
    .single();
  if (!codeRow) {
    return { ok: false, error: '紹介コードが見つかりません' };
  }
  if (codeRow.owner_email === referred) {
    return { ok: false, error: 'ご自身の紹介コードは利用できません' };
  }

  const { error } = await supabase.from('referral_events').insert({
    referral_code: codeRow.code,
    referrer_email: codeRow.owner_email,
    referred_email: referred,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: '既に紹介が適用されています' };
    }
    console.error('[referral] 紹介コードの適用に失敗しました:', error);
    return { ok: false, error: '紹介コードの適用に失敗しました。時間をおいて再度お試しください' };
  }
  return { ok: true };
}

// 被紹介者としての状態（アカウント設定画面の表示用）
export async function getReferredStatus(
  email: string
): Promise<'none' | 'registered' | 'converted'> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('referral_events')
    .select('status')
    .eq('referred_email', normalizeEmail(email))
    .single();
  if (data?.status === 'registered' || data?.status === 'converted') return data.status;
  return 'none';
}

// 未成立（registered）の紹介イベントを取得（Checkout 割引の適用判定用）
export async function getRegisteredReferralEvent(
  email: string
): Promise<{ id: string; referral_code: string; referrer_email: string } | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('referral_events')
    .select('id, referral_code, referrer_email')
    .eq('referred_email', normalizeEmail(email))
    .eq('status', 'registered')
    .single();
  return data ?? null;
}

// 紹介特典クーポン（100%オフ・1回のみ）を固定IDで取得/作成
export async function getOrCreateReferralCoupon(stripe: Stripe): Promise<string> {
  try {
    const coupon = await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
    if (coupon.valid) return coupon.id;
  } catch (error) {
    const stripeError = error as Stripe.StripeRawError;
    if (stripeError.statusCode !== 404) throw error;
  }

  const coupon = await stripe.coupons.create({
    id: REFERRAL_COUPON_ID,
    percent_off: 100,
    duration: 'once',
    name: 'ざせきくん 紹介特典（1ヶ月無料）',
  });
  return coupon.id;
}

// 紹介成立の確定と紹介者への特典付与（webhook の checkout.session.completed から呼ぶ）。
// 失敗しても webhook 処理全体は失敗させない（呼び出し側で try/catch）。
export async function convertReferralAndReward(
  stripe: Stripe,
  referredEmail: string,
  checkoutSessionId: string
): Promise<void> {
  const supabase = createServerClient();
  const referred = normalizeEmail(referredEmail);
  const nowIso = new Date().toISOString();

  // べき等な成立確定: 条件付き UPDATE で行を獲得する。
  // webhook の重複配信・並行実行でも status='registered' の行は1回しか獲得できない。
  const { data: claimed } = await supabase
    .from('referral_events')
    .update({
      status: 'converted',
      converted_at: nowIso,
      stripe_checkout_session_id: checkoutSessionId,
    })
    .eq('referred_email', referred)
    .eq('status', 'registered')
    .select('id, referrer_email');

  const event = claimed?.[0];
  if (!event) return; // 紹介なし、または既に成立処理済み

  // 年間上限チェック（超過分は成立記録だけ残して特典なし）
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { count: rewardsThisYear } = await supabase
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_email', event.referrer_email)
    .eq('status', 'converted')
    .in('reward_type', ['db_grant', 'stripe_coupon'])
    .gte('converted_at', oneYearAgo);

  if ((rewardsThisYear ?? 0) >= REFERRAL_MAX_REWARDS_PER_YEAR) {
    await supabase
      .from('referral_events')
      .update({ reward_type: 'capped' })
      .eq('id', event.id);
    console.log(`[referral] 年間上限のため特典なしで成立: ${event.referrer_email}`);
    return;
  }

  try {
    const personal = await getPersonalSubscription(event.referrer_email);

    if (personal.stripeSubscriptionId && personal.status === 'active') {
      // Stripe 課金中: 次回請求に 100%オフ（1回）を適用
      const couponId = await getOrCreateReferralCoupon(stripe);
      await stripe.subscriptions.update(personal.stripeSubscriptionId, {
        discounts: [{ coupon: couponId }],
      });
      await supabase
        .from('referral_events')
        .update({ reward_type: 'stripe_coupon' })
        .eq('id', event.id);
      console.log(`[referral] 紹介者へクーポン適用: ${event.referrer_email}`);
    } else {
      // Free / DB付与中 / 解約予約中: DB付与で1ヶ月の Pro を積み上げる。
      // status='cancelled' + period_end により既存の失効ロジックで自然に Free へ戻る
      const baseMs = personal.currentPeriodEnd
        ? Math.max(new Date(personal.currentPeriodEnd).getTime(), Date.now())
        : Date.now();
      const periodEnd = new Date(baseMs);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await upsertSubscription(event.referrer_email, {
        plan: 'paid',
        status: 'cancelled',
        current_period_start: nowIso,
        current_period_end: periodEnd.toISOString(),
      });
      await supabase
        .from('referral_events')
        .update({ reward_type: 'db_grant' })
        .eq('id', event.id);
      console.log(`[referral] 紹介者へ1ヶ月付与: ${event.referrer_email} (〜${periodEnd.toISOString()})`);
    }
  } catch (error) {
    // 特典付与に失敗しても成立は確定済み。failed を記録して手動救済できるようにする
    console.error(`[referral] 紹介者特典の付与に失敗しました (${event.referrer_email}):`, error);
    await supabase
      .from('referral_events')
      .update({ reward_type: 'failed' })
      .eq('id', event.id);
  }
}

// アカウント画面用の統計
export async function getReferralStats(email: string): Promise<{
  convertedCount: number;
  rewardsThisYear: number;
}> {
  const supabase = createServerClient();
  const owner = normalizeEmail(email);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const [convertedRes, rewardsRes] = await Promise.all([
    supabase
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_email', owner)
      .eq('status', 'converted'),
    supabase
      .from('referral_events')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_email', owner)
      .eq('status', 'converted')
      .in('reward_type', ['db_grant', 'stripe_coupon'])
      .gte('converted_at', oneYearAgo),
  ]);

  return {
    convertedCount: convertedRes.count ?? 0,
    rewardsThisYear: rewardsRes.count ?? 0,
  };
}
