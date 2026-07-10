'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Building2, CheckCircle2, Loader2, LogIn, UserPlus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvitationPreview {
  email: string;
  role: 'admin' | 'member';
  organizationName: string;
  expiresAt: string;
}

function JoinOrganizationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams?.get('token') || '';

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifyError('招待リンクが正しくありません');
      setVerifying(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/v2/organization/invitations/accept?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setVerifyError(data.error || '招待の確認に失敗しました');
        } else {
          setInvitation(data.invitation);
        }
      } catch {
        setVerifyError('招待の確認に失敗しました');
      } finally {
        setVerifying(false);
      }
    })();
  }, [token]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch('/api/v2/organization/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || '組織への参加に失敗しました');
        return;
      }
      setJoined(true);
      setTimeout(() => router.push('/admin/organization'), 1500);
    } catch {
      setJoinError('組織への参加に失敗しました');
    } finally {
      setJoining(false);
    }
  }, [token, router]);

  const joinPath = `/admin/organization/join?token=${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl bg-white px-8 py-10 shadow-xl ring-1 ring-black/5">
          {verifying || status === 'loading' ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500">招待を確認しています...</p>
            </div>
          ) : verifyError ? (
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">招待が無効です</h1>
              <p className="mt-2 text-sm text-slate-500">{verifyError}</p>
              <Link href="/admin" className="mt-6 inline-block text-sm text-indigo-600 hover:underline">
                管理画面へ戻る
              </Link>
            </div>
          ) : joined ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </motion.div>
              <h1 className="text-lg font-bold text-slate-900">
                {invitation?.organizationName} に参加しました
              </h1>
              <p className="mt-2 text-sm text-slate-500">組織管理画面へ移動します...</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                <Building2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">組織への招待</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-900">{invitation?.organizationName}</span>
                {' '}から{' '}
                <span className="font-semibold text-slate-900">{invitation?.email}</span>
                {' '}宛に{invitation?.role === 'admin' ? '管理者' : 'メンバー'}として招待されています。
              </p>

              {session ? (
                <div className="mt-6 space-y-3">
                  {session.user?.email?.toLowerCase() !== invitation?.email.toLowerCase() && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      現在 {session.user?.email} でログイン中です。招待は {invitation?.email} 宛のため、
                      参加するには招待されたアカウントでログインし直してください。
                    </p>
                  )}
                  {joinError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {joinError}
                    </p>
                  )}
                  <Button
                    onClick={handleJoin}
                    disabled={joining}
                    className="h-11 w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        参加中...
                      </>
                    ) : (
                      '組織に参加する'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  <p className="text-xs text-slate-400">
                    参加するにはログインまたは新規登録が必要です。
                  </p>
                  <Button
                    onClick={() =>
                      router.push(`/admin/login?callbackUrl=${encodeURIComponent(joinPath)}`)
                    }
                    className="h-11 w-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    ログインして参加
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      router.push(`/admin/register?invite=${encodeURIComponent(token)}`)
                    }
                    className="h-11 w-full"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    新規登録して参加
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function JoinOrganizationPage() {
  return (
    <Suspense fallback={null}>
      <JoinOrganizationContent />
    </Suspense>
  );
}
