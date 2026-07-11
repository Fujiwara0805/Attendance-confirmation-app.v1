'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  Loader2,
  Sparkles,
  UserX,
  Settings as SettingsIcon,
  ShieldAlert,
  Building2,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomModal } from '@/components/ui/custom-modal';
import { useToast } from '@/hooks/use-toast';
import AdminShell, {
  readCachedAdminShellPlanInfo,
  type AdminShellPlanInfo,
  writeCachedAdminShellPlanInfo,
} from '../components/AdminShell';

type PlanInfo = AdminShellPlanInfo & {
  canCreateForm: boolean;
  canCreateRoom: boolean;
};

const PLAN_DISPLAY: Record<'free' | 'paid' | 'enterprise', { label: string; description: string }> = {
  free: { label: 'Free', description: '無料プラン（基本機能）' },
  paid: { label: 'Pro', description: '月額550円 / フォーム・ルーム拡張' },
  enterprise: { label: 'Enterprise', description: '法人向けプラン（個別契約） / 無制限' },
};

interface ReferralInfo {
  // Free は紹介を「受ける側」（canRefer=false、リンク未発行）、Pro/Enterprise は「配る側」
  canRefer: boolean;
  referredStatus: 'none' | 'registered' | 'converted';
  code?: string;
  url?: string;
  convertedCount?: number;
  rewardsThisYear?: number;
  maxRewardsPerYear?: number;
}

type AccountColorTheme = {
  headerBg: string;
  headerBorder: string;
  iconBg: string;
  iconBorder: string;
  accent: string;
  titleText: string;
  descriptionText: string;
  strongText: string;
  infoBg: string;
  infoBorder: string;
  infoText: string;
};

const ACCOUNT_COLOR_THEME: AccountColorTheme = {
  headerBg: '#ebf3ff',
  headerBorder: '#aac8ff',
  iconBg: '#dce8ff',
  iconBorder: '#aac8ff',
  accent: '#2864f0',
  titleText: '#323232',
  descriptionText: '#595959',
  strongText: '#23418c',
  infoBg: '#ebf3ff',
  infoBorder: '#aac8ff',
  infoText: '#23418c',
};

function AccountPageHeader() {
  return (
    <div
      className="border-b"
      style={{ backgroundColor: ACCOUNT_COLOR_THEME.headerBg, borderColor: ACCOUNT_COLOR_THEME.headerBorder }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
            style={{
              backgroundColor: ACCOUNT_COLOR_THEME.iconBg,
              borderColor: ACCOUNT_COLOR_THEME.iconBorder,
              color: ACCOUNT_COLOR_THEME.accent,
            }}
          >
            <SettingsIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1
              className="truncate text-lg font-bold leading-tight sm:text-xl"
              style={{ color: ACCOUNT_COLOR_THEME.titleText }}
            >
              アカウント設定
            </h1>
            <p
              className="mt-0.5 truncate text-xs sm:text-sm"
              style={{ color: ACCOUNT_COLOR_THEME.descriptionText }}
            >
              プラン・請求・アカウント情報を管理します。
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/faq#account"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#aac8ff] bg-white text-[#2864f0] transition-colors hover:bg-[#ebf3ff]"
            aria-label="アカウント設定のヘルプを開く"
            title="アカウント設定のヘルプ"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSubscriptionActionPending, setIsSubscriptionActionPending] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);

  const showToast = useCallback(
    (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
      toast({ title, description, variant, duration: 1500 });
    },
    [toast]
  );

  const fetchPlanInfo = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const res = await fetch('/api/v2/subscription');
      if (res.ok) {
        const data = await res.json();
        setPlanInfo(data);
        writeCachedAdminShellPlanInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch plan info:', error);
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    const cached = readCachedAdminShellPlanInfo();
    if (cached) {
      setPlanInfo(cached as PlanInfo);
      setLoadingPlan(false);
      return;
    }
    fetchPlanInfo();
  }, [session, status, router, fetchPlanInfo]);

  // 紹介リンク（初回アクセスで自動発行）
  useEffect(() => {
    if (status === 'loading' || !session) return;
    (async () => {
      try {
        const res = await fetch('/api/v2/referral');
        if (res.ok) {
          setReferral(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch referral info:', error);
      }
    })();
  }, [session, status]);

  const handleCopyReferralUrl = async () => {
    if (!referral?.url) return;
    try {
      await navigator.clipboard.writeText(referral.url);
      showToast('コピーしました', '紹介リンクをクリップボードにコピーしました。');
    } catch {
      showToast('エラー', 'コピーに失敗しました', 'destructive');
    }
  };

  // 紹介URL/コードを自分に適用（Freeユーザー向け）。成立後の挙動はリンク経由登録と同じ
  const handleApplyReferral = async () => {
    const input = referralCodeInput.trim();
    if (!input) return;
    setIsApplyingReferral(true);
    try {
      const res = await fetch('/api/v2/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('エラー', data.error || '紹介コードの適用に失敗しました', 'destructive');
        return;
      }
      setReferral((prev) =>
        prev
          ? { ...prev, referredStatus: 'registered' }
          : { canRefer: false, referredStatus: 'registered' }
      );
      setReferralCodeInput('');
      showToast('紹介を適用しました', 'Pro プランへのアップグレード時に初月無料が適用されます。');
    } catch {
      showToast('エラー', '紹介コードの適用に失敗しました', 'destructive');
    } finally {
      setIsApplyingReferral(false);
    }
  };

  const handleUpgrade = async () => {
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'pro_subscription',
          successUrl: `${window.location.origin}/admin/account?payment=success`,
          cancelUrl: `${window.location.origin}/admin/account?payment=cancelled`,
        }),
      });
      if (!res.ok) throw new Error('決済セッションの作成に失敗しました');
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Upgrade error:', error);
      showToast('エラー', '決済処理中にエラーが発生しました', 'destructive');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setIsSubscriptionActionPending(true);
    try {
      const res = await fetch('/api/v2/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '請求情報ページを開けませんでした');
      }
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      showToast(
        'エラー',
        error instanceof Error ? error.message : '請求情報ページを開けませんでした',
        'destructive'
      );
    } finally {
      setIsSubscriptionActionPending(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsSubscriptionActionPending(true);
    try {
      const res = await fetch('/api/v2/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '解約処理に失敗しました');
      }
      setPlanInfo(data);
      setIsCancelModalOpen(false);
      showToast('解約を受け付けました', '現在の請求期間が終了するまでProプランを利用できます。');
    } catch (error) {
      console.error('Cancel subscription error:', error);
      showToast(
        'エラー',
        error instanceof Error ? error.message : '解約処理に失敗しました',
        'destructive'
      );
    } finally {
      setIsSubscriptionActionPending(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        showToast('エラー', data.error || 'アカウントの削除に失敗しました', 'destructive');
        return;
      }
      signOut({ callbackUrl: '/admin/login' });
    } catch {
      showToast('エラー', 'アカウントの削除中にエラーが発生しました', 'destructive');
    } finally {
      setDeletingAccount(false);
      setShowDeleteAccountModal(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      showToast('決済完了', 'Proプランへのアップグレードが完了しました！');
      fetchPlanInfo();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      showToast('決済キャンセル', '決済がキャンセルされました', 'destructive');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchPlanInfo, showToast]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const subscription = planInfo?.subscription;
  const currentPeriodEndLabel = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ja-JP')
    : null;
  // 組織プラン適用中は表示・操作を組織管理へ誘導する（個人サブスクの解約/ポータルとは別扱い）
  const isOrgPlan = subscription?.source === 'organization';
  const displayPlan = isOrgPlan
    ? {
        label: 'Enterprise',
        description: `組織「${subscription?.organization?.name ?? ''}」のプランが適用中 / 無制限`,
      }
    : PLAN_DISPLAY[subscription?.plan ?? 'free'];
  const isPaidPlan = subscription?.plan === 'paid' || subscription?.plan === 'enterprise';

  return (
    <AdminShell activeSection="account" planInfo={planInfo}>
      <AccountPageHeader />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">

        {/* Account info + Plan info (2 separate cards, side by side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Account info card */}
          <section className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <SettingsIcon className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500">
                アカウント情報
              </h2>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-base font-semibold shrink-0">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {session.user?.name || '-'}
                </p>
                <p className="text-xs text-slate-500 truncate leading-tight mt-1">
                  {session.user?.email || '-'}
                </p>
              </div>
            </div>
          </section>

          {/* Plan info card */}
          <section
            className={`rounded-2xl shadow-sm ring-1 overflow-hidden ${
              subscription?.plan === 'enterprise'
                ? 'bg-slate-900 text-white ring-slate-900/40'
                : subscription?.plan === 'paid'
                ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white ring-indigo-700/30'
                : 'bg-white ring-black/5'
            }`}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isPaidPlan ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h2
                  className={`text-xs font-semibold tracking-wide uppercase ${
                    isPaidPlan ? 'text-white/70' : 'text-slate-500'
                  }`}
                >
                  プラン情報
                </h2>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xl font-extrabold tracking-tight leading-none">
                    {displayPlan.label}
                  </p>
                  <p
                    className={`mt-1.5 text-xs leading-tight ${
                      isPaidPlan ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    {displayPlan.description}
                  </p>
                </div>
                <div className="flex-1" />
                {!loadingPlan && subscription?.plan === 'free' && (
                  <Button
                    size="sm"
                    onClick={handleUpgrade}
                    disabled={isProcessingPayment}
                    className="h-9 px-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        処理中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Proにアップグレード
                      </>
                    )}
                  </Button>
                )}
                {!loadingPlan && subscription?.plan === 'free' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push('/admin/organization')}
                    className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    エンタープライズ
                  </Button>
                )}
                {isPaidPlan && isOrgPlan && (
                  <Button
                    size="sm"
                    onClick={() => router.push('/admin/organization')}
                    className="h-9 px-3 bg-white/15 text-white hover:bg-white/25 border-0"
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    組織管理へ
                  </Button>
                )}
                {isPaidPlan && !isOrgPlan && (
                  <Button
                    size="sm"
                    onClick={() => setIsCancelModalOpen(true)}
                    disabled={
                      isSubscriptionActionPending || subscription?.status === 'cancelled'
                    }
                    className="h-9 px-3 bg-white/15 text-white hover:bg-white/25 border-0"
                  >
                    {subscription?.status === 'cancelled' ? '解約予約済み' : 'プランを解約'}
                  </Button>
                )}
              </div>
            </div>

            {/* Status note */}
            {(subscription?.status === 'cancelled' && currentPeriodEndLabel) ||
            subscription?.status === 'past_due' ? (
              <div
                className={`px-4 sm:px-5 py-2 text-xs border-t ${
                  isPaidPlan
                    ? 'border-white/15 bg-white/5 text-white/80'
                    : 'border-amber-100 bg-amber-50 text-amber-700'
                }`}
              >
                {subscription?.status === 'cancelled' && currentPeriodEndLabel && (
                  <>{currentPeriodEndLabel}で解約予定</>
                )}
                {subscription?.status === 'past_due' && (
                  <>お支払いに問題が発生しています。請求情報ポータルから状況をご確認ください。</>
                )}
              </div>
            ) : null}
          </section>
        </div>

        {/* Billing */}
        <section className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">請求・支払い</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                請求書・領収書のダウンロードや、銀行振込払いの申請ができます。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleOpenBillingPortal}
              disabled={isSubscriptionActionPending || !isPaidPlan}
              className="group relative flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white text-left transition-all duration-200 hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-200 disabled:hover:shadow-none"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                {isSubscriptionActionPending ? (
                  <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                ) : (
                  <FileText className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
                  請求書・領収書
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Stripe の請求情報ポータルを別タブで開き、過去の請求書・領収書を確認・ダウンロードできます。（請求履歴から該当月の請求書並びに領収書をダウンロードできます。）
                </p>
                {!isPaidPlan && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Pro / Enterprise プランに加入すると利用できます。
                  </p>
                )}
                {isOrgPlan && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    組織契約の請求書・領収書は「組織管理 → 課金」から確認できます。このボタンは個人契約用です。
                  </p>
                )}
              </div>
            </button>

            <Link
              href="/admin/billing/institutional"
              className="group relative flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white text-left transition-all duration-200 hover:border-indigo-300 hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">銀行振込払い（要相談）</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  大学・研究費・法人での銀行振込払いに対応。見積書・請求書・納品書を発行できます。
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Referral（Pro/Enterprise = 配る側の共有カード） */}
        {!loadingPlan && isPaidPlan && (
          <section className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">友だち紹介</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  紹介された方は Pro プランの<span className="font-semibold text-slate-700">初月が無料</span>。
                  紹介が成立する（紹介された方が Pro を契約する）と、あなたにも
                  <span className="font-semibold text-slate-700"> Pro 1ヶ月無料</span>をプレゼント（年
                  {referral?.maxRewardsPerYear ?? 3}回まで）。
                </p>
              </div>
            </div>

            {referral?.canRefer ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-600 sm:text-sm">
                    {referral.url}
                  </div>
                  <Button onClick={handleCopyReferralUrl} className="h-10 shrink-0">
                    <Copy className="mr-2 h-4 w-4" />
                    リンクをコピー
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  紹介成立 {referral.convertedCount} 件 ・ 今年の特典 {referral.rewardsThisYear} /{' '}
                  {referral.maxRewardsPerYear} 回
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                紹介リンクを準備中...
              </div>
            )}
          </section>
        )}

        {/* Referral（Free = 受ける側の入力カード。適用消化済みなら表示しない） */}
        {!loadingPlan &&
          subscription?.plan === 'free' &&
          referral &&
          referral.referredStatus !== 'converted' && (
            <section className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-5 sm:p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">紹介を受けた方</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    紹介リンクをお持ちの方は、リンク（またはコード）を入力すると Pro
                    プランへのアップグレード時に
                    <span className="font-semibold text-slate-700">初月無料</span>が適用されます。
                  </p>
                </div>
              </div>

              {referral.referredStatus === 'registered' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  🎁 紹介が適用されています。Pro プランへのアップグレード時に
                  <span className="font-bold">初月無料</span>になります。
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    placeholder="https://zaseki-kun.com/admin/register?referral=XXXXXXXX"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:bg-white sm:text-sm"
                  />
                  <Button
                    onClick={handleApplyReferral}
                    disabled={isApplyingReferral || !referralCodeInput.trim()}
                    className="h-10 shrink-0"
                  >
                    {isApplyingReferral ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gift className="mr-2 h-4 w-4" />
                    )}
                    適用する
                  </Button>
                </div>
              )}
            </section>
          )}

        {/* Danger zone */}
        <section className="bg-white rounded-2xl ring-1 ring-red-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-red-700">危険な操作</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                アカウントを削除すると、すべてのデータが完全に削除されます。
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowDeleteAccountModal(true)}
            variant="outline"
            className="h-10 px-4 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <UserX className="h-4 w-4 mr-2" />
            アカウントを削除
          </Button>
        </section>
      </div>

      {/* Cancel subscription modal */}
      <CustomModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (!isSubscriptionActionPending) setIsCancelModalOpen(false);
        }}
        title="プランを解約"
        description="解約後も現在の請求期間が終了するまでは、現在のプランの機能を引き続き利用できます。"
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {currentPeriodEndLabel
                ? `${currentPeriodEndLabel}までは現在のプランを利用できます。`
                : '次回更新を停止し、期間終了時に解約します。'}
            </p>
          </div>
          <p className="text-sm text-slate-600">本当に解約を予約しますか？</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isSubscriptionActionPending}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
              onClick={handleCancelSubscription}
              disabled={isSubscriptionActionPending}
            >
              {isSubscriptionActionPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  処理中...
                </>
              ) : (
                '解約する'
              )}
            </Button>
          </div>
        </div>
      </CustomModal>

      {/* Account delete modal */}
      <CustomModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        title="アカウント削除"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium mb-2">この操作は取り消せません</p>
            <p className="text-sm text-red-700">
              アカウントを削除すると、すべてのデータ（出席管理フォーム、ルーム、出席データなど）が完全に削除されます。
            </p>
          </div>
          <p className="text-sm text-slate-600">本当にアカウントを削除しますか？</p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteAccountModal(false)}
              className="flex-1 h-10"
              disabled={deletingAccount}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  削除中...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  削除する
                </>
              )}
            </Button>
          </div>
        </div>
      </CustomModal>
    </AdminShell>
  );
}
