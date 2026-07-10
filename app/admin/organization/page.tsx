'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Building2,
  Copy,
  CopyPlus,
  CreditCard,
  DoorOpen,
  ExternalLink,
  FilePenLine,
  FileText,
  HelpCircle,
  Library,
  Loader2,
  Presentation,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomModal } from '@/components/ui/custom-modal';
import { useToast } from '@/hooks/use-toast';
import AdminShell from '../components/AdminShell';

export type OrgRole = 'owner' | 'admin' | 'member';

export interface OrganizationInfo {
  id: string;
  name: string;
  ownerEmail: string;
  seatLimit: number;
  subscriptionStatus: 'inactive' | 'active' | 'past_due' | 'cancelled';
  billingType: 'stripe_subscription' | 'invoice' | null;
  currentPeriodEnd: string | null;
  entitled: boolean;
  createdAt: string;
}

export interface OrganizationResponse {
  organization: OrganizationInfo | null;
  role?: OrgRole;
  usedSeats?: number;
  domains?: string[];
}

interface OrgMember {
  id: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
}

interface OrgInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  expiresAt: string;
  expired: boolean;
  inviteUrl: string;
  createdAt: string;
}

interface LibraryCourse {
  code: string;
  name: string;
  description: string | null;
  category: string;
  formType: 'attendance' | 'invitation';
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
}

interface LibraryRoom {
  code: string;
  title: string;
  createdAt: string;
  ownerEmail: string;
  pollCount: number;
}

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  member: 'メンバー',
};

const STATUS_DISPLAY: Record<
  OrganizationInfo['subscriptionStatus'],
  { label: string; className: string }
> = {
  inactive: { label: '未契約', className: 'bg-slate-100 text-slate-600' },
  active: { label: '契約中', className: 'bg-emerald-100 text-emerald-700' },
  past_due: { label: '支払い確認中', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: '解約予定', className: 'bg-red-100 text-red-700' },
};

function OrganizationPageHeader() {
  return (
    <div className="border-b" style={{ backgroundColor: '#ebf3ff', borderColor: '#aac8ff' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
            style={{ backgroundColor: '#dce8ff', borderColor: '#aac8ff', color: '#2864f0' }}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-[#323232] sm:text-xl">
              組織管理
            </h1>
            <p className="mt-0.5 truncate text-xs text-[#595959] sm:text-sm">
              会社・団体のメンバーとアカウント、法人契約を管理します。
            </p>
          </div>
        </div>
        <Link
          href="/admin/faq"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#aac8ff] bg-white text-[#2864f0] transition-colors hover:bg-[#ebf3ff]"
          aria-label="ヘルプを開く"
          title="ヘルプ"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// 未所属ユーザー向けの組織作成フォーム
function CreateOrganizationSection({ onCreated }: { onCreated: (data: OrganizationResponse) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v2/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '組織の作成に失敗しました');
      toast({ title: '組織を作成しました', description: 'メンバー招待とプラン契約に進めます。', duration: 1500 });
      onCreated(data);
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '組織の作成に失敗しました',
        variant: 'destructive',
        duration: 1500,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">組織を作成</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              会社・学校・団体単位でアカウントをまとめて管理できます。作成後にメンバーを招待し、
              アカウント数分のエンタープライズ契約（1アカウント月額500円）を結ぶと、メンバー全員が無制限で利用できます。
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              組織名
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 株式会社サンプル"
              maxLength={100}
              className="h-11"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="h-11 w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                作成中...
              </>
            ) : (
              <>
                <Building2 className="mr-2 h-4 w-4" />
                組織を作成する
              </>
            )}
          </Button>
          <p className="text-xs text-slate-400">
            作成したユーザーがオーナーになります。1ユーザーが所属できる組織は1つです。
          </p>
        </div>
      </section>
    </div>
  );
}

export default function OrganizationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  const [orgData, setOrgData] = useState<OrganizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'members' | 'library' | 'billing' | 'settings'
  >('overview');

  // 共有ライブラリタブ
  const [library, setLibrary] = useState<{ courses: LibraryCourse[]; rooms: LibraryRoom[] } | null>(
    null
  );
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [duplicatingCode, setDuplicatingCode] = useState<string | null>(null);

  // 課金タブ
  const [billingSeats, setBillingSeats] = useState('');
  const [billingPending, setBillingPending] = useState(false);

  // メンバータブ
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // 設定タブ
  const [editName, setEditName] = useState('');
  const [editDomains, setEditDomains] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDissolveModal, setShowDissolveModal] = useState(false);
  const [dissolving, setDissolving] = useState(false);

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/organization');
      if (res.ok) {
        const data: OrganizationResponse = await res.json();
        setOrgData(data);
        if (data.organization) {
          setEditName(data.organization.name);
          setEditDomains((data.domains ?? []).join('\n'));
        }
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
      return;
    }
    fetchOrg();
  }, [session, status, router, fetchOrg]);

  const canManageMembers =
    orgData?.role === 'owner' || orgData?.role === 'admin';

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const requests: Promise<Response>[] = [fetch('/api/v2/organization/members')];
      if (canManageMembers) requests.push(fetch('/api/v2/organization/invitations'));
      const [membersRes, invitesRes] = await Promise.all(requests);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members ?? []);
      }
      if (invitesRes?.ok) {
        const data = await invitesRes.json();
        setInvitations(data.invitations ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setMembersLoading(false);
    }
  }, [canManageMembers]);

  useEffect(() => {
    if (activeTab === 'members' && orgData?.organization) {
      fetchMembers();
    }
  }, [activeTab, orgData?.organization, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/v2/organization/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '招待の発行に失敗しました');
      setInviteEmail('');
      await Promise.all([fetchMembers(), fetchOrg()]);
      // 発行直後に招待リンクをコピーしておく（メール送信はしないリンク共有方式）
      try {
        await navigator.clipboard.writeText(data.invitation.inviteUrl);
        toast({
          title: '招待リンクを発行してコピーしました',
          description: 'リンクを招待相手に共有してください。',
          duration: 2500,
        });
      } catch {
        toast({ title: '招待リンクを発行しました', description: '一覧のコピーボタンから共有してください。', duration: 2500 });
      }
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '招待の発行に失敗しました',
        variant: 'destructive',
        duration: 2000,
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'コピーしました', description: '招待リンクをクリップボードにコピーしました。', duration: 1500 });
    } catch {
      toast({ title: 'エラー', description: 'コピーに失敗しました', variant: 'destructive', duration: 1500 });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    setMemberActionId(invitationId);
    try {
      const res = await fetch(`/api/v2/organization/invitations?id=${invitationId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '招待の取り消しに失敗しました');
      await Promise.all([fetchMembers(), fetchOrg()]);
      toast({ title: '招待を取り消しました', description: 'アカウント枠が解放されました。', duration: 1500 });
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '招待の取り消しに失敗しました',
        variant: 'destructive',
        duration: 1500,
      });
    } finally {
      setMemberActionId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: OrgRole) => {
    setMemberActionId(memberId);
    try {
      const res = await fetch('/api/v2/organization/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ロールの変更に失敗しました');
      await Promise.all([fetchMembers(), fetchOrg()]);
      toast({ title: 'ロールを変更しました', description: '', duration: 1500 });
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'ロールの変更に失敗しました',
        variant: 'destructive',
        duration: 2000,
      });
    } finally {
      setMemberActionId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setMemberActionId(memberId);
    try {
      const res = await fetch(`/api/v2/organization/members?id=${memberId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'メンバーの削除に失敗しました');
      await Promise.all([fetchMembers(), fetchOrg()]);
      toast({ title: 'メンバーを削除しました', description: 'アカウント枠が解放されました。', duration: 1500 });
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'メンバーの削除に失敗しました',
        variant: 'destructive',
        duration: 2000,
      });
    } finally {
      setMemberActionId(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      const res = await fetch('/api/v2/organization/members?id=self', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '脱退に失敗しました');
      toast({ title: '組織を脱退しました', description: '', duration: 1500 });
      setShowLeaveModal(false);
      setOrgData({ organization: null });
      setActiveTab('overview');
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '脱退に失敗しました',
        variant: 'destructive',
        duration: 2000,
      });
    } finally {
      setLeaving(false);
    }
  };

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const res = await fetch('/api/v2/organization/library');
      const data = await res.json();
      if (!res.ok) {
        setLibrary(null);
        setLibraryError(data.error || '共有ライブラリの取得に失敗しました');
        return;
      }
      setLibrary({ courses: data.courses ?? [], rooms: data.rooms ?? [] });
    } catch (error) {
      console.error('Failed to fetch library:', error);
      setLibraryError('共有ライブラリの取得に失敗しました');
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'library' && orgData?.organization) {
      fetchLibrary();
    }
  }, [activeTab, orgData?.organization, fetchLibrary]);

  // 共有ライブラリからの複製（複製後の所有者は自分。元のデータは引き継がれない）
  const handleDuplicateFromLibrary = async (kind: 'course' | 'room', code: string) => {
    setDuplicatingCode(code);
    try {
      const url =
        kind === 'course'
          ? `/api/v2/courses/${encodeURIComponent(code)}/duplicate`
          : `/api/rooms/${encodeURIComponent(code)}/duplicate`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || data.error || '複製に失敗しました'
        );
      }
      toast({
        title: kind === 'course' ? 'フォームを複製しました' : 'ルームを複製しました',
        description: '自分の作成物として管理画面に追加されました。取得データは複製されません。',
        duration: 2500,
      });
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '複製に失敗しました',
        variant: 'destructive',
        duration: 2500,
      });
    } finally {
      setDuplicatingCode(null);
    }
  };

  // Checkout からの戻り（?billing=success / cancelled）をトースト表示
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get('billing');
    if (billingStatus === 'success') {
      toast({
        title: '契約が完了しました',
        description: '組織のメンバー全員がエンタープライズ機能を利用できます。',
        duration: 2500,
      });
      setActiveTab('billing');
      fetchOrg();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (billingStatus === 'cancelled') {
      toast({ title: '決済キャンセル', description: '決済がキャンセルされました', variant: 'destructive', duration: 2000 });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, fetchOrg]);

  const handleBillingAction = async (
    action: 'checkout' | 'update_seats' | 'portal',
    seats?: number
  ) => {
    setBillingPending(true);
    try {
      const res = await fetch('/api/v2/organization/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(seats !== undefined ? { seats } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '処理に失敗しました');

      if (action === 'checkout' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (action === 'portal' && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (action === 'update_seats') {
        await fetchOrg();
        toast({
          title: 'アカウント数を変更しました',
          description: `契約アカウント数: ${data.seatLimit}（差額は日割りで調整されます）`,
          duration: 2500,
        });
      }
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '処理に失敗しました',
        variant: 'destructive',
        duration: 2500,
      });
    } finally {
      setBillingPending(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const domains = editDomains
        .split(/[\n,]/)
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch('/api/v2/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), domains }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '設定の保存に失敗しました');
      setOrgData(data);
      toast({ title: '保存しました', description: '組織の設定を更新しました。', duration: 1500 });
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '設定の保存に失敗しました',
        variant: 'destructive',
        duration: 1500,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDissolve = async () => {
    setDissolving(true);
    try {
      const res = await fetch('/api/v2/organization', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '組織の解散に失敗しました');
      toast({ title: '組織を解散しました', description: '', duration: 1500 });
      setOrgData({ organization: null });
      setShowDissolveModal(false);
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '組織の解散に失敗しました',
        variant: 'destructive',
        duration: 1500,
      });
    } finally {
      setDissolving(false);
    }
  };

  if (status === 'loading' || !session || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const org = orgData?.organization ?? null;
  const role = orgData?.role ?? 'member';
  const usedSeats = orgData?.usedSeats ?? 0;
  const canManage = role === 'owner' || role === 'admin';
  const statusDisplay = org ? STATUS_DISPLAY[org.subscriptionStatus] : null;
  const periodEndLabel = org?.currentPeriodEnd
    ? new Date(org.currentPeriodEnd).toLocaleDateString('ja-JP')
    : null;

  const tabs: Array<{ key: typeof activeTab; label: string; visible: boolean }> = [
    { key: 'overview', label: '概要', visible: true },
    { key: 'members', label: 'メンバー', visible: true },
    { key: 'library', label: '共有ライブラリ', visible: true },
    { key: 'billing', label: '課金', visible: canManage },
    { key: 'settings', label: '設定', visible: canManage },
  ];

  const hasStripeSubscription =
    org?.billingType === 'stripe_subscription' &&
    (org.subscriptionStatus === 'active' ||
      org.subscriptionStatus === 'past_due' ||
      org.subscriptionStatus === 'cancelled');

  return (
    <AdminShell activeSection="organization">
      <OrganizationPageHeader />

      {!org ? (
        <CreateOrganizationSection onCreated={(data) => {
          setOrgData(data);
          if (data.organization) {
            setEditName(data.organization.name);
            setEditDomains((data.domains ?? []).join('\n'));
          }
        }} />
      ) : (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          {/* タブ */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {tabs
              .filter((t) => t.visible)
              .map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.key
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 組織情報 + アカウント状況 */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      組織情報
                    </h2>
                  </div>
                  <p className="truncate text-lg font-bold text-slate-900">{org.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                      あなたの役割: {ROLE_LABEL[role]}
                    </span>
                    {statusDisplay && (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </span>
                    )}
                    {periodEndLabel && org.subscriptionStatus !== 'inactive' && (
                      <span className="text-slate-400">
                        {org.subscriptionStatus === 'cancelled' ? `${periodEndLabel} まで利用可` : `次回更新: ${periodEndLabel}`}
                      </span>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      アカウント使用状況
                    </h2>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold tabular-nums text-slate-900">{usedSeats}</span>
                    <span className="text-sm text-slate-400">/ {org.seatLimit} アカウント</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        org.seatLimit > 0 && usedSeats >= org.seatLimit ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${org.seatLimit > 0 ? Math.min(100, (usedSeats / org.seatLimit) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    使用アカウント = メンバー数 + 招待中の人数
                  </p>
                </section>
              </div>

              {/* 未契約の案内 */}
              {!org.entitled && (
                <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                  <h3 className="text-sm font-semibold text-indigo-900">
                    エンタープライズ契約が有効ではありません
                  </h3>
                  <p className="mt-1 text-sm text-indigo-700">
                    アカウント数分の契約（1アカウント月額500円）を結ぶと、組織のメンバー全員がフォーム・ルーム・履歴無制限で利用できます。
                    {canManage
                      ? '契約は「課金」タブから（クレジットカード / 銀行振込）行えます。'
                      : '契約は組織のオーナーまたは管理者が行えます。'}
                  </p>
                </section>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* 招待フォーム（owner / admin のみ） */}
              {canManage && (
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">メンバーを招待</h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        招待リンクを発行し、招待相手に共有してください（リンクの有効期限は7日間）。招待中も1アカウントを使用します。
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@example.co.jp"
                      className="h-10 flex-1"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label="招待するロール"
                    >
                      <option value="member">メンバー</option>
                      <option value="admin">管理者</option>
                    </select>
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="h-10">
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          発行中...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          招待リンクを発行
                        </>
                      )}
                    </Button>
                  </div>
                </section>
              )}

              {/* 招待中一覧 */}
              {canManage && invitations.length > 0 && (
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">
                    招待中 <span className="text-slate-400">({invitations.length})</span>
                  </h2>
                  <ul className="divide-y divide-slate-100">
                    {invitations.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{inv.email}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {inv.role === 'admin' ? '管理者' : 'メンバー'}として招待 ・{' '}
                            {inv.expired
                              ? '期限切れ'
                              : `${new Date(inv.expiresAt).toLocaleDateString('ja-JP')} まで有効`}
                          </p>
                        </div>
                        {!inv.expired && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyInviteUrl(inv.inviteUrl)}
                            className="h-8 shrink-0"
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            リンクをコピー
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          disabled={memberActionId === inv.id}
                          className="h-8 w-8 shrink-0 p-0 text-slate-400 hover:text-red-600"
                          aria-label="招待を取り消す"
                          title="招待を取り消す"
                        >
                          {memberActionId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* メンバー一覧 */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">
                  メンバー <span className="text-slate-400">({members.length})</span>
                </h2>
                {membersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {members.map((member) => {
                      const isSelf =
                        member.email.toLowerCase() === (session.user?.email ?? '').toLowerCase();
                      // admin は member のみ操作可。owner は owner 以外を操作可
                      const canOperate =
                        !isSelf &&
                        member.role !== 'owner' &&
                        (role === 'owner' || (role === 'admin' && member.role === 'member'));
                      return (
                        <li key={member.id} className="flex items-center gap-3 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-semibold text-white">
                            {member.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {member.email}
                              {isSelf && <span className="ml-1.5 text-xs text-slate-400">(自分)</span>}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              参加日: {new Date(member.joinedAt).toLocaleDateString('ja-JP')}
                            </p>
                          </div>
                          {canOperate ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleChangeRole(member.id, e.target.value as OrgRole)}
                              disabled={memberActionId === member.id}
                              className="h-8 shrink-0 rounded-md border border-slate-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              aria-label="ロールを変更"
                            >
                              <option value="member">メンバー</option>
                              <option value="admin">管理者</option>
                              {role === 'owner' && <option value="owner">オーナー（譲渡）</option>}
                            </select>
                          ) : (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                member.role === 'owner'
                                  ? 'bg-slate-900 text-white'
                                  : member.role === 'admin'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {ROLE_LABEL[member.role]}
                            </span>
                          )}
                          {canOperate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={memberActionId === member.id}
                              className="h-8 w-8 shrink-0 p-0 text-slate-400 hover:text-red-600"
                              aria-label="メンバーを削除"
                              title="メンバーを削除"
                            >
                              {memberActionId === member.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* 脱退（owner 以外） */}
              {role !== 'owner' && (
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-100 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">組織から脱退</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        脱退すると組織プランの適用が解除されます。あなたのフォームやルームのデータは残ります。
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowLeaveModal(true)}
                      className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <DoorOpen className="mr-2 h-4 w-4" />
                      脱退する
                    </Button>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'library' && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-indigo-100">
                    <Library className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-indigo-900">
                    <p className="font-semibold">組織メンバーのフォーム・ルームを複製して使えます</p>
                    <p className="mt-1 text-xs leading-relaxed text-indigo-700">
                      複製すると設定のみコピーされ、自分の作成物になります。出席データ・投票・質問などの取得データは複製されず、
                      <span className="font-semibold">作成者本人のみ</span>が閲覧・出力できます。
                    </p>
                  </div>
                </div>
              </section>

              {libraryLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : libraryError ? (
                <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
                  <p className="text-sm text-slate-500">{libraryError}</p>
                  {canManage && libraryError.includes('契約') && (
                    <Button variant="outline" className="mt-4 h-9" onClick={() => setActiveTab('billing')}>
                      課金タブへ
                    </Button>
                  )}
                </section>
              ) : (
                <>
                  {/* フォーム */}
                  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ebf3ff] text-[#2864f0]">
                        <FilePenLine className="h-3.5 w-3.5" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        メンバーのフォーム{' '}
                        <span className="text-slate-400">({library?.courses.length ?? 0})</span>
                      </h2>
                    </div>
                    {(library?.courses.length ?? 0) === 0 ? (
                      <p className="py-4 text-sm text-slate-400">
                        他のメンバーが作成したフォームはまだありません。
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {library?.courses.map((course) => (
                          <li key={course.code} className="flex items-center gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">{course.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                作成者: {course.ownerName}（{course.ownerEmail}）・{' '}
                                {course.formType === 'invitation' ? '招待フォーム' : '出席フォーム'} ・{' '}
                                {new Date(course.createdAt).toLocaleDateString('ja-JP')}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateFromLibrary('course', course.code)}
                              disabled={duplicatingCode === course.code}
                              className="h-8 shrink-0"
                              title="設定を引き継いで自分のフォームとして複製します（取得データはコピーされません）"
                            >
                              {duplicatingCode === course.code ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CopyPlus className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              複製して利用
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* ルーム */}
                  <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#e8f7ee] text-[#00963c]">
                        <Presentation className="h-3.5 w-3.5" />
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        メンバーのルーム{' '}
                        <span className="text-slate-400">({library?.rooms.length ?? 0})</span>
                      </h2>
                    </div>
                    {(library?.rooms.length ?? 0) === 0 ? (
                      <p className="py-4 text-sm text-slate-400">
                        他のメンバーが作成したルームはまだありません。
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {library?.rooms.map((room) => (
                          <li key={room.code} className="flex items-center gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-900">{room.title}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-400">
                                作成者: {room.ownerEmail} ・ ワーク {room.pollCount} 個 ・{' '}
                                {new Date(room.createdAt).toLocaleDateString('ja-JP')}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateFromLibrary('room', room.code)}
                              disabled={duplicatingCode === room.code}
                              className="h-8 shrink-0"
                              title="ワーク構成を引き継いで自分のルームとして複製します（票・質問はコピーされません）"
                            >
                              {duplicatingCode === room.code ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CopyPlus className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              複製して利用
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {activeTab === 'billing' && canManage && (
            <div className="space-y-6">
              {/* 契約状況 */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">エンタープライズ（組織）プラン</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      1アカウント 月額500円（税込）。契約アカウント数の範囲でメンバーを追加でき、全員が無制限で利用できます。
                    </p>
                  </div>
                </div>

                {!hasStripeSubscription && org.billingType !== 'invoice' ? (
                  // 未契約: 新規 Checkout
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div>
                        <label htmlFor="billing-seats" className="mb-1.5 block text-sm font-medium text-slate-700">
                          契約アカウント数（最低2）
                        </label>
                        <Input
                          id="billing-seats"
                          type="number"
                          min={2}
                          max={1000}
                          value={billingSeats}
                          onChange={(e) => setBillingSeats(e.target.value)}
                          placeholder="10"
                          className="h-11 w-40"
                        />
                      </div>
                      <Button
                        onClick={() => handleBillingAction('checkout', Number.parseInt(billingSeats, 10))}
                        disabled={billingPending || !billingSeats || Number.parseInt(billingSeats, 10) < 2}
                        className="h-11 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
                      >
                        {billingPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            処理中...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            クレジットカードで契約
                          </>
                        )}
                      </Button>
                    </div>
                    {billingSeats && Number.parseInt(billingSeats, 10) >= 2 && (
                      <p className="text-sm text-slate-500">
                        月額合計:{' '}
                        <span className="font-bold text-slate-900">
                          {(Number.parseInt(billingSeats, 10) * 500).toLocaleString()}円
                        </span>
                        （{billingSeats}アカウント × 500円）
                      </p>
                    )}
                  </div>
                ) : (
                  // 契約中: アカウント変更 + ポータル
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        現在の契約:{' '}
                        <span className="font-bold text-slate-900">{org.seatLimit}アカウント</span>
                        {org.billingType === 'stripe_subscription' && (
                          <>
                            {' '}／ 月額{' '}
                            <span className="font-bold text-slate-900">
                              {(org.seatLimit * 500).toLocaleString()}円
                            </span>
                          </>
                        )}
                        {org.billingType === 'invoice' && ' （銀行振込契約）'}
                        {periodEndLabel && (
                          <span className="ml-2 text-xs text-slate-400">
                            {org.subscriptionStatus === 'cancelled'
                              ? `${periodEndLabel} で終了予定`
                              : `次回更新: ${periodEndLabel}`}
                          </span>
                        )}
                      </p>
                    </div>

                    {org.billingType === 'stripe_subscription' && (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div>
                            <label htmlFor="billing-seats-update" className="mb-1.5 block text-sm font-medium text-slate-700">
                              アカウント数を変更
                            </label>
                            <Input
                              id="billing-seats-update"
                              type="number"
                              min={2}
                              max={1000}
                              value={billingSeats}
                              onChange={(e) => setBillingSeats(e.target.value)}
                              placeholder={String(org.seatLimit)}
                              className="h-10 w-40"
                            />
                          </div>
                          <Button
                            onClick={() => handleBillingAction('update_seats', Number.parseInt(billingSeats, 10))}
                            disabled={
                              billingPending ||
                              !billingSeats ||
                              Number.parseInt(billingSeats, 10) === org.seatLimit ||
                              Number.parseInt(billingSeats, 10) < 2
                            }
                            variant="outline"
                            className="h-10"
                          >
                            {billingPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Users className="mr-2 h-4 w-4" />
                            )}
                            変更を適用
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400">
                          増席は日割りで即時課金、減席は次回請求で調整されます。使用中のアカウント数より少なくはできません。
                        </p>
                        <button
                          type="button"
                          onClick={() => handleBillingAction('portal')}
                          disabled={billingPending}
                          className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-emerald-300 hover:shadow-md disabled:opacity-60 sm:max-w-md"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                            <FileText className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                              請求情報・解約の管理
                              <ExternalLink className="h-3 w-3 text-slate-400 transition-colors group-hover:text-emerald-600" />
                            </h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                              Stripe のポータルで請求書・領収書の確認、支払い方法の変更、解約ができます。
                            </p>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* 銀行振込 */}
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                <Link
                  href="/admin/billing/institutional"
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">銀行振込で契約（法人請求）</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      見積書・請求書・納品書の発行に対応。年間契約など請求書払いをご希望の場合はこちらから。
                    </p>
                  </div>
                </Link>
              </section>
            </div>
          )}

          {activeTab === 'settings' && canManage && (
            <div className="space-y-6">
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">組織設定</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="edit-org-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                      組織名
                    </label>
                    <Input
                      id="edit-org-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      className="h-11 max-w-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-org-domains" className="mb-1.5 block text-sm font-medium text-slate-700">
                      自動参加を許可するメールドメイン
                    </label>
                    <textarea
                      id="edit-org-domains"
                      value={editDomains}
                      onChange={(e) => setEditDomains(e.target.value)}
                      placeholder={'example.co.jp\nexample.com'}
                      rows={3}
                      className="w-full max-w-md rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      1行に1ドメイン（最大10件）。このドメインのメールアドレスで Google ログインしたユーザーは、
                      アカウントに空きがあれば自動でこの組織に参加します。Gmail などのフリーメールは登録できません。
                    </p>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={saving} className="h-10">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        設定を保存
                      </>
                    )}
                  </Button>
                </div>
              </section>

              {role === 'owner' && (
                <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-red-100 sm:p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-red-700">危険な操作</h2>
                      <p className="mt-0.5 text-sm text-slate-500">
                        組織を解散すると、メンバー・招待・ドメイン設定がすべて削除されます。各メンバーのフォームやルームのデータは残ります。
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowDissolveModal(true)}
                    className="h-10 border-red-200 px-4 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    組織を解散
                  </Button>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* 脱退確認モーダル */}
      <CustomModal
        isOpen={showLeaveModal}
        onClose={() => {
          if (!leaving) setShowLeaveModal(false);
        }}
        title="組織から脱退"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            組織から脱退すると、組織プラン（エンタープライズ機能）の適用が解除されます。
            再度参加するには招待が必要です。本当に脱退しますか？
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowLeaveModal(false)}
              className="h-10 flex-1"
              disabled={leaving}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleLeave}
              disabled={leaving}
              className="h-10 flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {leaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  脱退中...
                </>
              ) : (
                '脱退する'
              )}
            </Button>
          </div>
        </div>
      </CustomModal>

      {/* 解散確認モーダル */}
      <CustomModal
        isOpen={showDissolveModal}
        onClose={() => {
          if (!dissolving) setShowDissolveModal(false);
        }}
        title="組織を解散"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-sm font-medium text-red-800">この操作は取り消せません</p>
            <p className="text-sm text-red-700">
              組織を解散すると、すべてのメンバーの所属と招待・ドメイン設定が削除され、
              組織プランの適用も解除されます。有効なサブスクリプションがある場合は先に解約が必要です。
            </p>
          </div>
          <p className="text-sm text-slate-600">本当に組織を解散しますか？</p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDissolveModal(false)}
              className="h-10 flex-1"
              disabled={dissolving}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDissolve}
              disabled={dissolving}
              className="h-10 flex-1 bg-red-600 text-white hover:bg-red-700"
            >
              {dissolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  解散中...
                </>
              ) : (
                '解散する'
              )}
            </Button>
          </div>
        </div>
      </CustomModal>
    </AdminShell>
  );
}
