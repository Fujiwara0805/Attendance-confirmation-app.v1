'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  BarChart3,
  PieChart,
  Plus,
  QrCode,
  Copy,
  Check,
  Download,
  StopCircle,
  Trash2,
  Monitor,
  Loader2,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  Heart,
  Reply,
  EyeOff,
  Eye,
  RotateCcw,
  Users,
  Trophy,
  ArrowLeft,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll } from '@/lib/hooks/useRealtimePolls';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import { createBrowserClient } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
  host_id: string;
  moderation_enabled?: boolean;
}

type HostTab = 'questions' | 'polls' | 'summary' | 'export';
type SortMode = 'popular' | 'newest';
type StatusFilter = 'all' | 'unanswered' | 'pending' | 'approved' | 'answered' | 'rejected';

const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export default function HostPage() {
  const params = useParams();
  const { data: session, status: authStatus } = useSession();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HostTab>('questions');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  // Question filters
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Poll creation
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMaxSelections, setPollMaxSelections] = useState(1);
  const [creatingPoll, setCreatingPoll] = useState(false);

  // Export
  const [exportData, setExportData] = useState<{
    stats?: Record<string, number>;
    topQuestions?: Array<{ text: string; upvote_count: number }>;
  } | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [roomStatusLoading, setRoomStatusLoading] = useState(false);
  const [pollStatusPendingId, setPollStatusPendingId] = useState<string | null>(null);
  const [pollDeletingId, setPollDeletingId] = useState<string | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [exportLoadingType, setExportLoadingType] = useState<'questions' | 'polls' | null>(null);
  // 質問カードの操作中状態（id+action 単位でローディング）
  const [questionActionPending, setQuestionActionPending] = useState<Record<string, string | null>>({});

  const setActionFor = useCallback((id: string, action: string | null) => {
    setQuestionActionPending((prev) => {
      const next = { ...prev };
      if (action === null) delete next[id];
      else next[id] = action;
      return next;
    });
  }, []);

  // Fetch room
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setRoom(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomCode]);

  // Generate QR
  useEffect(() => {
    const url = `${window.location.origin}/rooms/${roomCode}`;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 256, margin: 2 }).then(setQrUrl);
    });
  }, [roomCode]);

  // Realtime
  const { questions, loading: qLoading, optimisticDelete } = useRealtimeQuestions(room?.id || null);
  const { polls, pollVotes, loading: pLoading } = useRealtimePolls(room?.id || null);
  const presenceCount = useRoomPresence(room?.id || null, session?.user?.email || null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleQuestion = useCallback(
    async (questionId: string, field: 'is_answered' | 'is_pinned') => {
      const q = questions.find((q) => q.id === questionId);
      if (!q) return;
      const action = field === 'is_answered' ? 'answered' : 'pinned';
      setActionFor(questionId, action);
      try {
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [field === 'is_answered' ? 'isAnswered' : 'isPinned']: !q[field],
          }),
        });
      } finally {
        setActionFor(questionId, null);
      }
    },
    [questions, roomCode, setActionFor]
  );

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      setActionFor(questionId, 'delete');
      try {
        optimisticDelete(questionId);
        const supabase = createBrowserClient();
        await supabase.from('questions').delete().eq('id', questionId);
      } finally {
        setActionFor(questionId, null);
      }
    },
    [optimisticDelete, setActionFor]
  );

  const handleSetQuestionStatus = useCallback(
    async (questionId: string, status: 'approved' | 'rejected' | 'pending') => {
      setActionFor(questionId, `status:${status}`);
      try {
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      } finally {
        setActionFor(questionId, null);
      }
    },
    [roomCode, setActionFor]
  );

  const handleToggleModeration = useCallback(async () => {
    if (!room || moderationLoading) return;
    const next = !room.moderation_enabled;
    setModerationLoading(true);
    setRoom((prev) => (prev ? { ...prev, moderation_enabled: next } : null));
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationEnabled: next }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setRoom((prev) => (prev ? { ...prev, moderation_enabled: !next } : null));
    } finally {
      setModerationLoading(false);
    }
  }, [room, roomCode, moderationLoading]);

  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    setCreatingPoll(true);
    try {
      await fetch(`/api/rooms/${roomCode}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollQuestion.trim(),
          type: 'multiple_choice',
          options: validOptions,
          maxSelections: Math.max(1, Math.min(pollMaxSelections, validOptions.length)),
          allowMultiple: pollMaxSelections > 1,
        }),
      });
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMaxSelections(1);
      setShowCreatePoll(false);
    } catch {
      /* ignore */
    } finally {
      setCreatingPoll(false);
    }
  };

  const handlePollStatus = async (pollId: string, status: string) => {
    setPollStatusPendingId(pollId);
    try {
      await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } finally {
      setPollStatusPendingId(null);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    setPollDeletingId(pollId);
    try {
      await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, { method: 'DELETE' });
    } finally {
      setPollDeletingId(null);
    }
  };

  const handleToggleRoomStatus = async () => {
    if (!room || roomStatusLoading) return;
    const newStatus = room.status === 'active' ? 'closed' : 'active';
    setRoomStatusLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setRoom((prev) => (prev ? { ...prev, status: newStatus } : null));
    } finally {
      setRoomStatusLoading(false);
    }
  };

  const handleExportCSV = useCallback(
    async (type: 'questions' | 'polls') => {
      if (exportLoadingType) return;
      setExportLoadingType(type);
      try {
        const res = await fetch(`/api/rooms/${roomCode}/export?type=${type}&format=csv`);
        if (!res.ok) throw new Error('failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-${roomCode}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      } finally {
        setExportLoadingType(null);
      }
    },
    [exportLoadingType, roomCode]
  );

  // Fetch summary for export tab
  useEffect(() => {
    if ((tab === 'export' || tab === 'summary') && !exportData) {
      fetch(`/api/rooms/${roomCode}/export?type=summary`)
        .then((r) => r.json())
        .then(setExportData)
        .catch(() => {});
    }
  }, [tab, exportData, roomCode]);

  // ==== カウント計算（pillsバッジ・サマリー両方で利用） ====
  const counts = useMemo(() => {
    const all = questions.length;
    const pending = questions.filter((q) => q.status === 'pending').length;
    const rejected = questions.filter((q) => q.status === 'rejected').length;
    const answered = questions.filter((q) => q.is_answered && q.status !== 'rejected').length;
    const approved = questions.filter(
      (q) => (q.status === undefined || q.status === 'approved') && !q.is_answered
    ).length;
    const unanswered = questions.filter((q) => !q.is_answered && q.status !== 'rejected').length;
    return { all, pending, rejected, answered, approved, unanswered };
  }, [questions]);

  // ==== フィルタ + ソート ====
  const filteredQuestions = useMemo(() => {
    const filterFn = (() => {
      switch (statusFilter) {
        case 'pending':
          return (q: typeof questions[number]) => q.status === 'pending';
        case 'rejected':
          return (q: typeof questions[number]) => q.status === 'rejected';
        case 'answered':
          return (q: typeof questions[number]) => q.is_answered && q.status !== 'rejected';
        case 'approved':
          return (q: typeof questions[number]) =>
            (q.status === undefined || q.status === 'approved') && !q.is_answered;
        case 'unanswered':
          return (q: typeof questions[number]) => !q.is_answered && q.status !== 'rejected';
        case 'all':
        default:
          return () => true;
      }
    })();

    const filtered = questions.filter(filterFn);
    if (sortMode === 'newest') {
      return [...filtered].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return [...filtered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (
        b.upvote_count - a.upvote_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [questions, statusFilter, sortMode]);

  // Auth check
  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm sm:text-base text-slate-400">
        読み込み中...
      </div>
    );
  }
  if (!session || !room || room.host_id !== session.user?.email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm sm:text-base text-slate-500">このルームへのアクセス権がありません</p>
        <Link href="/rooms" className="text-sm sm:text-base text-emerald-600 hover:underline font-semibold">
          戻る
        </Link>
      </div>
    );
  }

  const totalUpvotes = questions.reduce((sum, q) => sum + (q.upvote_count || 0), 0);
  const totalPolls = polls.length;
  const totalParticipants =
    exportData?.stats?.uniqueParticipants ?? Math.max(presenceCount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60">
      {/* Header */}
      <header className="border-b border-slate-200/70 bg-white sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              title="管理画面に戻る"
              aria-label="管理画面に戻る"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 ring-1 ring-emerald-200 flex items-center justify-center shrink-0">
              <Image src={LOGO_URL} alt="" width={22} height={22} className="rounded-md" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {room.title}
              </h1>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400">
                <button
                  onClick={handleCopyCode}
                  className="font-mono tracking-wider hover:text-slate-600 inline-flex items-center gap-1"
                  title="コードをコピー"
                >
                  #{room.code}
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {Math.max(presenceCount, 1)}人
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {qrUrl && (
              <a
                href={qrUrl}
                download={`qr-${roomCode}.png`}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 px-2.5 h-9 rounded-lg transition-colors"
                title="QRコードをダウンロード"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">QR</span>
              </a>
            )}
            <a
              href={`/rooms/${roomCode}/present`}
              target={`zasekikun-present-${roomCode}`}
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 w-9 h-9 rounded-lg transition-colors"
              title="スクリーン画面を開く"
            >
              <Monitor className="w-4 h-4" />
            </a>
            <button
              type="button"
              disabled={exportLoadingType !== null}
              onClick={() => handleExportCSV('questions')}
              className="inline-flex items-center justify-center text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 w-9 h-9 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none"
              title="ダウンロード"
            >
              {exportLoadingType === 'questions' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              disabled={roomStatusLoading}
              onClick={handleToggleRoomStatus}
              className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 h-9 rounded-lg transition-colors min-w-[5rem] disabled:opacity-60 disabled:pointer-events-none ${
                room.status === 'active'
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {roomStatusLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : room.status === 'active' ? (
                <>
                  <StopCircle className="w-3.5 h-3.5" />
                  終了
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  再開
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-6xl flex px-5 gap-5 -mb-px">
          {(
            [
              { key: 'questions', icon: <MessageSquare className="w-4 h-4" />, label: '質問' },
              { key: 'polls', icon: <BarChart3 className="w-4 h-4" />, label: '投票' },
              { key: 'summary', icon: <PieChart className="w-4 h-4" />, label: 'サマリー' },
              { key: 'export', icon: <Download className="w-4 h-4" />, label: 'エクスポート' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-1 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-6xl px-5 py-5">
        {/* === Questions Tab === */}
        {tab === 'questions' && (
          <div className="space-y-4">
            {/* Moderation toggle (always visible) */}
            <div className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 px-4 py-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {room.moderation_enabled ? (
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldOff className="w-5 h-5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    承認制：
                    <span className={room.moderation_enabled ? 'text-emerald-700' : 'text-slate-500'}>
                      {room.moderation_enabled ? 'ON' : 'OFF'}
                    </span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-tight mt-0.5">
                    {room.moderation_enabled
                      ? '新規質問は承認後に公開されます'
                      : '新規質問は即時公開されます'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!room.moderation_enabled}
                disabled={moderationLoading}
                onClick={handleToggleModeration}
                title={room.moderation_enabled ? '承認制をOFFにする' : '承認制をONにする'}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  room.moderation_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    room.moderation_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                >
                  {moderationLoading && (
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  )}
                </span>
              </button>
            </div>
            {room.moderation_enabled && counts.pending > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5 text-xs sm:text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <p className="flex-1">
                  <span className="font-bold">{counts.pending}</span> 件が承認待ちです
                </p>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
                >
                  確認する
                </button>
              </div>
            )}

            {/* Sort + Status pills */}
            <div className="flex flex-wrap items-center gap-2">
              <SortPill active={sortMode === 'popular'} onClick={() => setSortMode('popular')}>
                人気順
              </SortPill>
              <SortPill active={sortMode === 'newest'} onClick={() => setSortMode('newest')}>
                新着順
              </SortPill>
              <span className="w-px h-5 bg-slate-200 mx-1" />
              <FilterPill
                active={statusFilter === 'unanswered'}
                onClick={() => setStatusFilter('unanswered')}
              >
                未回答
              </FilterPill>
              <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                全て ({counts.all})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'pending'}
                onClick={() => setStatusFilter('pending')}
              >
                承認待ち ({counts.pending})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'approved'}
                onClick={() => setStatusFilter('approved')}
              >
                公開中 ({counts.approved})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'answered'}
                onClick={() => setStatusFilter('answered')}
              >
                回答済 ({counts.answered})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'rejected'}
                onClick={() => setStatusFilter('rejected')}
              >
                非表示 ({counts.rejected})
              </FilterPill>
            </div>

            {qLoading ? (
              <p className="text-center text-sm text-slate-400 py-10">読み込み中...</p>
            ) : filteredQuestions.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 py-14 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">該当する質問はありません</p>
                <p className="text-xs text-slate-400 mt-1">フィルタを切り替えて確認してみましょう</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredQuestions.map((q) => (
                    <HostQuestionRow
                      key={q.id}
                      q={q}
                      pendingAction={questionActionPending[q.id] ?? null}
                      onToggleAnswered={() => handleToggleQuestion(q.id, 'is_answered')}
                      onTogglePinned={() => handleToggleQuestion(q.id, 'is_pinned')}
                      onApprove={() => handleSetQuestionStatus(q.id, 'approved')}
                      onReject={() => handleSetQuestionStatus(q.id, 'rejected')}
                      onUnreject={() => handleSetQuestionStatus(q.id, 'approved')}
                      onDelete={() => handleDeleteQuestion(q.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* === Polls Tab === */}
        {tab === 'polls' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">投票</h2>
              {room.status === 'active' && (
                <button
                  onClick={() => setShowCreatePoll(!showCreatePoll)}
                  className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 h-10 rounded-lg shadow-sm shadow-emerald-200/60 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  新しい投票
                </button>
              )}
            </div>

            {/* Create poll form */}
            <AnimatePresence>
              {showCreatePoll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 space-y-3 overflow-hidden"
                >
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="質問文（例: 今日の授業の理解度は？）"
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-emerald-300 focus:bg-white outline-none transition-colors text-sm"
                    style={{ fontSize: '16px' }}
                  />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        placeholder={`選択肢 ${i + 1}`}
                        className="flex-1 h-11 px-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-emerald-300 focus:bg-white outline-none transition-colors text-sm"
                        style={{ fontSize: '16px' }}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                          className="text-rose-400 hover:text-rose-600 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-3">
                    {pollOptions.length < 8 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="text-sm text-emerald-700 hover:text-emerald-800 font-semibold"
                      >
                        + 選択肢を追加
                      </button>
                    )}
                    <label className="ml-auto inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                      1人あたりの最大選択数
                      <input
                        type="number"
                        min={1}
                        max={Math.max(2, pollOptions.filter((o) => o.trim()).length || 2)}
                        value={pollMaxSelections}
                        onChange={(e) =>
                          setPollMaxSelections(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-16 h-9 px-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 focus:ring-emerald-300 focus:bg-white outline-none text-center font-semibold tabular-nums"
                        style={{ fontSize: '16px' }}
                      />
                      <span className="text-slate-400">/ {pollOptions.filter((o) => o.trim()).length || 0}</span>
                    </label>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreatePoll}
                      disabled={
                        creatingPoll ||
                        !pollQuestion.trim() ||
                        pollOptions.filter((o) => o.trim()).length < 2
                      }
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-4 h-10 rounded-lg text-sm transition-colors"
                    >
                      {creatingPoll ? '作成中...' : '作成する'}
                    </button>
                    <button
                      onClick={() => setShowCreatePoll(false)}
                      className="text-slate-500 hover:text-slate-800 font-semibold px-4 h-10 rounded-lg text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : polls.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 py-14 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-3">
                  <BarChart3 className="w-7 h-7 text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">まだ投票はありません</p>
                <p className="text-xs text-slate-400 mt-1">右上の「新しい投票」から作成できます</p>
              </div>
            ) : (
              polls.map((poll) => (
                <PollResultCard
                  key={poll.id}
                  poll={poll}
                  votes={pollVotes[poll.id] || []}
                  pendingId={pollStatusPendingId}
                  deletingId={pollDeletingId}
                  onStart={() => handlePollStatus(poll.id, 'active')}
                  onClose={() => handlePollStatus(poll.id, 'closed')}
                  onDelete={() => handleDeletePoll(poll.id)}
                />
              ))
            )}
          </div>
        )}

        {/* === Summary Tab === */}
        {tab === 'summary' && (
          <SummaryTab
            counts={counts}
            totalQuestions={questions.length}
            totalUpvotes={totalUpvotes}
            totalPolls={totalPolls}
            totalParticipants={totalParticipants}
            topQuestions={[...questions]
              .sort((a, b) => b.upvote_count - a.upvote_count)
              .slice(0, 5)}
          />
        )}

        {/* === Export Tab === */}
        {tab === 'export' && (
          <div className="space-y-5">
            {exportData?.stats && (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 mb-4">
                  ルームサマリー
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: '質問数', value: exportData.stats.totalQuestions },
                    { label: '投票数', value: exportData.stats.totalPolls },
                    { label: '総いいね', value: exportData.stats.totalUpvotes },
                    { label: '参加者数', value: exportData.stats.uniqueParticipants },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-emerald-600">
                        {s.value ?? 0}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exportData?.topQuestions && exportData.topQuestions.length > 0 && (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
                  質問一覧（いいね順）
                </h3>
                <div className="space-y-2">
                  {(showAllQuestions
                    ? exportData.topQuestions
                    : exportData.topQuestions.slice(0, 5)
                  ).map((q, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm sm:text-base">
                      <span className="text-emerald-600 font-bold w-6 tabular-nums">
                        {q.upvote_count}
                      </span>
                      <span className="text-slate-700">{q.text}</span>
                    </div>
                  ))}
                </div>
                {exportData.topQuestions.length > 5 && (
                  <button
                    onClick={() => setShowAllQuestions(!showAllQuestions)}
                    className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {showAllQuestions
                      ? '閉じる'
                      : `他の質問をみる（残り${exportData.topQuestions.length - 5}件）`}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
                データダウンロード
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={exportLoadingType !== null}
                  onClick={() => handleExportCSV('questions')}
                  className="bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  {exportLoadingType === 'questions' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Q&Aデータ (CSV)
                </button>
                <button
                  type="button"
                  disabled={exportLoadingType !== null}
                  onClick={() => handleExportCSV('polls')}
                  className="bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  {exportLoadingType === 'polls' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  投票結果 (CSV)
                </button>
              </div>
            </div>

            {/* Moderation toggle (placed under Export for housekeeping) */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6 flex items-center justify-between">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">承認制（モデレーション）</h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {room.moderation_enabled
                    ? 'ON: 新規質問は承認後に公開されます'
                    : 'OFF: 新規質問は即時公開されます'}
                </p>
              </div>
              <button
                type="button"
                disabled={moderationLoading}
                onClick={handleToggleModeration}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 h-9 rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                  room.moderation_enabled
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {moderationLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : room.moderation_enabled ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldOff className="w-3.5 h-3.5" />
                )}
                {room.moderation_enabled ? '承認制 ON' : '承認制 OFF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== Subcomponents ====== */

function SortPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center text-xs sm:text-sm font-semibold px-3 h-8 rounded-full transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center text-xs sm:text-sm font-semibold px-3 h-8 rounded-full transition-colors tabular-nums ${
        active
          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/60'
          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function HostQuestionRow({
  q,
  pendingAction,
  onToggleAnswered,
  onTogglePinned,
  onApprove,
  onReject,
  onUnreject,
  onDelete,
}: {
  q: {
    id: string;
    text: string;
    author_name: string;
    upvote_count: number;
    is_answered: boolean;
    is_pinned: boolean;
    created_at: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
  pendingAction: string | null;
  onToggleAnswered: () => void;
  onTogglePinned: () => void;
  onApprove: () => void;
  onReject: () => void;
  onUnreject: () => void;
  onDelete: () => void;
}) {
  const anyPending = pendingAction !== null;
  const isPendingAction = (action: string) => pendingAction === action;
  const authorLabel = q.author_name === 'Anonymous' ? '匿名' : q.author_name;
  const initial = authorLabel.slice(0, 1) || '匿';
  const tone = avatarTone(authorLabel);
  const timeAgo = formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ja });
  const dateLabel = new Date(q.created_at).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const isRejected = q.status === 'rejected';
  const isPending = q.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`rounded-2xl bg-white ring-1 ${
        q.is_pinned ? 'ring-emerald-300 shadow-sm shadow-emerald-100' : 'ring-slate-200'
      } ${isRejected ? 'opacity-70' : ''} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Like count column */}
        <div className="flex flex-col items-center justify-start pt-1 min-w-[36px]">
          <Heart className="w-4 h-4 text-rose-300" />
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-700 tabular-nums">
            {q.upvote_count}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${tone}`}
                aria-hidden
              >
                {initial}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                {authorLabel}
              </span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-[11px] sm:text-xs text-slate-400 tabular-nums">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {q.is_answered && (
                <span className="text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                  回答済
                </span>
              )}
              {isPending && (
                <span className="text-[10px] sm:text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 rounded-full">
                  承認待ち
                </span>
              )}
              {isRejected && (
                <span className="text-[10px] sm:text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-2 py-0.5 rounded-full">
                  非表示
                </span>
              )}
              <span className="text-[11px] text-slate-400 hidden sm:inline">{timeAgo}</span>
            </div>
          </div>

          <p
            className={`text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap break-words ${
              q.is_answered ? 'line-through opacity-70' : ''
            }`}
          >
            {q.text}
          </p>

          {/* Action row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {isPending ? (
              <>
                <ActionButton
                  onClick={onApprove}
                  tone="primary"
                  loading={isPendingAction('status:approved')}
                  disabled={anyPending}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  承認
                </ActionButton>
                <ActionButton
                  onClick={onReject}
                  tone="muted"
                  loading={isPendingAction('status:rejected')}
                  disabled={anyPending}
                  icon={<EyeOff className="w-3.5 h-3.5" />}
                >
                  非表示
                </ActionButton>
              </>
            ) : isRejected ? (
              <ActionButton
                onClick={onUnreject}
                tone="muted"
                loading={isPendingAction('status:approved')}
                disabled={anyPending}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                公開に戻す
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  onClick={onToggleAnswered}
                  tone="muted"
                  loading={isPendingAction('answered')}
                  disabled={anyPending}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  {q.is_answered ? '未回答に戻す' : '回答済みにする'}
                </ActionButton>
                <ActionButton
                  onClick={onTogglePinned}
                  tone="muted"
                  loading={isPendingAction('pinned')}
                  disabled={anyPending}
                  icon={<Reply className="w-3.5 h-3.5" />}
                >
                  {q.is_pinned ? 'ピン解除' : 'ピン留め'}
                </ActionButton>
                <ActionButton
                  onClick={onReject}
                  tone="muted"
                  loading={isPendingAction('status:rejected')}
                  disabled={anyPending}
                  icon={<EyeOff className="w-3.5 h-3.5" />}
                >
                  非表示
                </ActionButton>
              </>
            )}
            <ActionButton
              onClick={onDelete}
              tone="danger"
              loading={isPendingAction('delete')}
              disabled={anyPending}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              削除
            </ActionButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  tone,
  loading,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone: 'primary' | 'muted' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const cls =
    tone === 'primary'
      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
      : tone === 'danger'
      ? 'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2.5 h-8 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none ${cls}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function PollResultCard({
  poll,
  votes,
  pendingId,
  deletingId,
  onStart,
  onClose,
  onDelete,
}: {
  poll: Poll;
  votes: Array<{ option_index: number | null }>;
  pendingId: string | null;
  deletingId: string | null;
  onStart: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const counts = poll.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  const totalRespondents = totalVotes; // 単純集計（複数選択の場合は total cast）
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const isMulti = maxSelections > 1 || poll.allow_multiple;
  const isPending = pendingId === poll.id;
  const isDeleting = deletingId === poll.id;

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
            {isMulti && (
              <span className="inline-flex items-center font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                複数選択
              </span>
            )}
            {poll.status === 'active' ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : poll.status === 'draft' ? (
              <span className="inline-flex items-center font-semibold text-amber-700">下書き</span>
            ) : (
              <span className="inline-flex items-center font-semibold text-slate-400">終了</span>
            )}
            <span className="inline-flex items-center text-slate-500 tabular-nums">
              回答数: <span className="ml-1 font-semibold text-slate-700">{totalRespondents}</span>
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {poll.question}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {poll.status === 'draft' && (
            <button
              type="button"
              disabled={isPending}
              onClick={onStart}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-3 h-9 rounded-lg disabled:opacity-60"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '開始'}
            </button>
          )}
          {poll.status === 'active' && (
            <button
              type="button"
              disabled={isPending}
              onClick={onClose}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 px-3 h-9 rounded-lg disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span className="w-3.5 h-3.5 rounded-sm border-[1.5px] border-current" />
                  締切
                </>
              )}
            </button>
          )}
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60 disabled:pointer-events-none"
            title="削除"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, i) => {
          const count = counts[i];
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl ring-1 ring-slate-200 bg-white"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute left-0 top-0 bottom-0 bg-emerald-100/80"
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="flex items-center gap-2 min-w-0 text-sm sm:text-base text-slate-800">
                  <span className="text-emerald-700 font-semibold tabular-nums">
                    {circledNumber(i)}
                  </span>
                  <span className="truncate">{option}</span>
                </span>
                <span className="text-xs sm:text-sm text-slate-500 tabular-nums shrink-0">
                  {count} ({pct}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function circledNumber(i: number) {
  // ①〜⑳, あふれた場合は番号で
  if (i < 20) return String.fromCharCode(0x2460 + i);
  return `(${i + 1})`;
}

function SummaryTab({
  counts,
  totalQuestions,
  totalUpvotes,
  totalPolls,
  totalParticipants,
  topQuestions,
}: {
  counts: { all: number; pending: number; approved: number; answered: number; rejected: number };
  totalQuestions: number;
  totalUpvotes: number;
  totalPolls: number;
  totalParticipants: number;
  topQuestions: Array<{
    id: string;
    text: string;
    author_name: string;
    upvote_count: number;
    is_answered: boolean;
    created_at: string;
  }>;
}) {
  const total = Math.max(counts.all, 1);
  const segments = [
    { key: 'approved', label: '公開中', value: counts.approved, color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'answered', label: '回答済', value: counts.answered, color: 'bg-sky-500', dot: 'bg-sky-500' },
    { key: 'pending', label: '承認待ち', value: counts.pending, color: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'rejected', label: '非表示', value: counts.rejected, color: 'bg-slate-300', dot: 'bg-slate-400' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="質問"
          value={totalQuestions}
          icon={<MessageSquare className="w-4 h-4 text-emerald-700" />}
          accent="bg-emerald-50 ring-emerald-100"
        />
        <KpiCard
          label="いいね合計"
          value={totalUpvotes}
          icon={<Heart className="w-4 h-4 text-rose-500" />}
          accent="bg-rose-50 ring-rose-100"
        />
        <KpiCard
          label="参加者"
          value={totalParticipants}
          icon={<Users className="w-4 h-4 text-sky-600" />}
          accent="bg-sky-50 ring-sky-100"
        />
        <KpiCard
          label="投票"
          value={totalPolls}
          icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-50 ring-amber-100"
        />
      </div>

      {/* Status distribution */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">質問のステータス分布</h3>
        <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.key}
                className={s.color}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
          {segments.map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden />
                <span className="font-semibold text-slate-700">{s.label}</span>
                <span className="ml-auto sm:ml-2 text-slate-500 tabular-nums">
                  {s.value} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 5 questions */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">人気の質問 TOP 5</h3>
        </div>
        {topQuestions.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">まだ質問がありません</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topQuestions.map((q, i) => {
              const author = q.author_name === 'Anonymous' ? '匿名' : q.author_name;
              const dateLabel = new Date(q.created_at).toLocaleString('ja-JP', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={q.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5">
                      {author} · {dateLabel}
                    </p>
                    <p className="text-sm sm:text-base text-slate-800 leading-relaxed line-clamp-3">
                      {q.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q.is_answered && (
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                        回答済
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-rose-500">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="text-xs font-bold tabular-nums">{q.upvote_count}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-7 h-7 rounded-lg ring-1 flex items-center justify-center ${accent}`}>
          {icon}
        </span>
        <span className="text-xs sm:text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
