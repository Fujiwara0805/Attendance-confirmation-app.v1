'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  UserX,
  Settings as SettingsIcon,
  ShieldAlert,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomModal } from '@/components/ui/custom-modal';
import { useToast } from '@/hooks/use-toast';
import AdminShell, { type AdminShellPlanInfo } from '../components/AdminShell';

type PlanInfo = AdminShellPlanInfo & {
  canCreateForm: boolean;
  canCreateRoom: boolean;
};

const PLAN_DISPLAY: Record<'free' | 'paid' | 'enterprise', { label: string; description: string }> = {
  free: { label: 'Free', description: '無料プラン（基本機能）' },
  paid: { label: 'Pro', description: '月額550円 / フォーム・ルーム拡張' },
  enterprise: { label: 'Enterprise', description: '月額2,000円 / 無制限' },
};

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
    fetchPlanInfo();
  }, [session, status, router, fetchPlanInfo]);

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
  const displayPlan = PLAN_DISPLAY[subscription?.plan ?? 'free'];
  const isPaidPlan = subscription?.plan === 'paid' || subscription?.plan === 'enterprise';

  return (
    <AdminShell activeSection="account" planInfo={planInfo}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 mb-2">
            <SettingsIcon className="h-3 w-3" />
            Account
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            アカウント設定
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            プラン・請求・アカウント情報を管理します。
          </p>
        </div>

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
                {isPaidPlan && (
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
                請求書・領収書のダウンロードや、請求書払いの申請ができます。
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
                  Stripe の請求情報ポータルを別タブで開き、過去の請求書・領収書を確認・ダウンロードできます。
                </p>
                {!isPaidPlan && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Pro / Enterprise プランに加入すると利用できます。
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
                <h3 className="text-sm font-semibold text-slate-900">請求書払い</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  大学・研究費・法人での銀行振込払いに対応。見積書・請求書・納品書を発行できます。
                </p>
              </div>
            </Link>
          </div>
        </section>

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
