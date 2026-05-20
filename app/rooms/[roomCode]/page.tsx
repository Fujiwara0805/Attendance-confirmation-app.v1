'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  BarChart3,
  Send,
  Loader2,
  Users,
  WifiOff,
  Heart,
  Sparkles,
  User2,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParticipantSession } from '@/lib/hooks/useParticipantSession';
import { useRealtimeQuestions, type Question } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import QuestionCard from '../components/QuestionCard';
import PollResultsChart from '../components/PollResultsChart';
import RankingResults from '../components/RankingResults';
import RankingPicker from '../components/RankingPicker';
import QuizTimerRing from '../components/QuizTimerRing';
import { staggerContainer } from '@/lib/animations';
import {
  extractPollPayload,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getPollOptionDetail,
  getQuizQuestions,
  getQuizScore,
  getRankingDisplayMode,
  getRankingOptionLabel,
  optionLetter,
  rankLabel,
} from '@/lib/pollModes';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

type Tab = 'qa' | 'polls' | 'mine';
type Sort = 'popular' | 'newest';

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
  moderation_enabled?: boolean;
}

const MAX_LEN = 500;

export default function ParticipantPage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();
  const { participantId, displayName, setDisplayName, isReady } = useParticipantSession();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('qa');
  const [sort, setSort] = useState<Sort>('popular');

  // Q&A state
  const [questionText, setQuestionText] = useState('');
  const [sending, setSending] = useState(false);
  const [votedQuestions, setVotedQuestions] = useState<Set<string>>(new Set());

  // Own questions tracking
  const [ownQuestionIds, setOwnQuestionIds] = useState<Set<string>>(new Set());

  // Poll state
  const [hasVotedPoll, setHasVotedPoll] = useState<Set<string>>(new Set());

  // Fetch room
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setRoom(data);
        setRoomLoading(false);
      })
      .catch(() => setRoomLoading(false));
  }, [roomCode]);

  // Realtime data — 参加者ビュー: 承認済み + 自分の投稿のみ表示
  const {
    questions,
    rawQuestions,
    loading: qLoading,
    connected: qConnected,
    optimisticDelete,
    optimisticUpdateUpvote,
    optimisticInsert,
  } = useRealtimeQuestions(room?.id || null, {
    participantOnly: true,
    ownIds: ownQuestionIds,
  });
  const { activePoll, polls, pollVotes, loading: pLoading, connected: pConnected } =
    useRealtimePolls(room?.id || null);

  const presenceCount = useRoomPresence(room?.id || null, participantId || null);

  // Load voted state from localStorage
  useEffect(() => {
    if (!isReady) return;
    const stored = localStorage.getItem(`voted_questions_${roomCode}`);
    if (stored) setVotedQuestions(new Set(JSON.parse(stored)));
    const storedPolls = localStorage.getItem(`voted_polls_${roomCode}`);
    if (storedPolls) setHasVotedPoll(new Set(JSON.parse(storedPolls)));
    // ホストがリセット（status='draft' に戻した）出題は「投票済み」状態を解除し再回答可に
    // ※ 実際の除去はリアルタイム polls の更新で発火する下の effect で行う
    const storedOwn = localStorage.getItem(`own_questions_${roomCode}`);
    if (storedOwn) setOwnQuestionIds(new Set(JSON.parse(storedOwn)));
  }, [roomCode, isReady]);

  // ホストが出題をリセット（status='draft' に戻したり、started_at が変化したり、再活性化）
  // → 投票済みフラグを解除して再回答できるように。遷移検出のため per-poll の前回状態を ref に保持。
  const prevPollStateRef = useRef<
    Record<string, { started_at?: string | null; status?: string }>
  >({});
  useEffect(() => {
    if (polls.length === 0) return;
    const next = new Set(hasVotedPoll);
    let changed = false;
    for (const poll of polls) {
      const prev = prevPollStateRef.current[poll.id];
      if (prev) {
        const startedAtChanged = prev.started_at !== poll.started_at;
        const becameDraft = prev.status !== 'draft' && poll.status === 'draft';
        if ((startedAtChanged || becameDraft) && next.has(poll.id)) {
          next.delete(poll.id);
          changed = true;
        }
      }
      prevPollStateRef.current[poll.id] = {
        started_at: poll.started_at,
        status: poll.status,
      };
    }
    if (changed) {
      setHasVotedPoll(next);
      try {
        localStorage.setItem(`voted_polls_${roomCode}`, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
    }
  }, [polls, hasVotedPoll, roomCode]);

  const sortedQuestions = useMemo(() => {
    const list = [...questions];
    if (sort === 'newest') {
      return list.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    // popular（デフォルト）
    return list;
  }, [questions, sort]);

  const myQuestions = useMemo(
    () => rawQuestions.filter((q) => ownQuestionIds.has(q.id)),
    [rawQuestions, ownQuestionIds]
  );

  const pendingMyCount = myQuestions.filter((q) => q.status === 'pending').length;

  const handleSubmitQuestion = useCallback(async () => {
    if (!questionText.trim() || sending) return;
    setSending(true);
    const trimmedName = displayName.trim();
    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText.trim(),
          authorName: trimmedName || '匿名',
          isAnonymous: !trimmedName,
          participantId,
        }),
      });
      const created = await res.json();
      if (created?.id) {
        const newOwn = new Set(ownQuestionIds);
        newOwn.add(created.id);
        setOwnQuestionIds(newOwn);
        localStorage.setItem(`own_questions_${roomCode}`, JSON.stringify(Array.from(newOwn)));
        // 楽観的反映: 自分の画面で realtime を待たずに即時表示
        optimisticInsert(created);
      }
      setQuestionText('');
    } catch {
      // Silently fail
    } finally {
      setSending(false);
    }
  }, [questionText, sending, displayName, roomCode, participantId, ownQuestionIds, optimisticInsert]);

  const handleVote = useCallback(
    async (questionId: string) => {
      if (!participantId) return;

      const currentlyVoted = votedQuestions.has(questionId);
      const target = rawQuestions.find((q) => q.id === questionId);
      if (!target) return;

      // 楽観的更新: voted状態 + count
      const newVoted = new Set(votedQuestions);
      if (currentlyVoted) newVoted.delete(questionId);
      else newVoted.add(questionId);
      setVotedQuestions(newVoted);
      localStorage.setItem(`voted_questions_${roomCode}`, JSON.stringify(Array.from(newVoted)));

      const optimisticCount = Math.max(
        0,
        currentlyVoted ? target.upvote_count - 1 : target.upvote_count + 1
      );
      optimisticUpdateUpvote(questionId, optimisticCount);

      try {
        const res = await fetch(`/api/rooms/${roomCode}/questions/${questionId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId }),
        });
        if (res.ok) {
          const json = (await res.json()) as { upvote_count?: number };
          if (typeof json.upvote_count === 'number') {
            // サーバの正解値で必ず上書き
            optimisticUpdateUpvote(questionId, json.upvote_count);
          }
        } else {
          throw new Error('vote failed');
        }
      } catch {
        // ロールバック
        const reverted = new Set(votedQuestions);
        setVotedQuestions(reverted);
        localStorage.setItem(`voted_questions_${roomCode}`, JSON.stringify(Array.from(reverted)));
        optimisticUpdateUpvote(questionId, target.upvote_count);
      }
    },
    [participantId, votedQuestions, rawQuestions, roomCode, optimisticUpdateUpvote]
  );

  const handleEditQuestion = useCallback(
    async (questionId: string, newText: string) => {
      try {
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText, participantId }),
        });
      } catch {
        /* silently fail */
      }
    },
    [roomCode, participantId]
  );

  const handleDeleteOwnQuestion = useCallback(
    async (questionId: string) => {
      try {
        optimisticDelete(questionId);
        const newOwn = new Set(ownQuestionIds);
        newOwn.delete(questionId);
        setOwnQuestionIds(newOwn);
        localStorage.setItem(`own_questions_${roomCode}`, JSON.stringify(Array.from(newOwn)));
        await fetch(
          `/api/rooms/${roomCode}/questions/${questionId}?participantId=${participantId}`,
          { method: 'DELETE' }
        );
      } catch {
        /* silently fail */
      }
    },
    [optimisticDelete, ownQuestionIds, roomCode, participantId]
  );

  const handlePollVote = useCallback(
    async (pollId: string, optionIndexes: number[]) => {
      if (!participantId || hasVotedPoll.has(pollId) || optionIndexes.length === 0) return;
      const newVoted = new Set(hasVotedPoll);
      newVoted.add(pollId);
      setHasVotedPoll(newVoted);
      localStorage.setItem(`voted_polls_${roomCode}`, JSON.stringify(Array.from(newVoted)));

      try {
        await fetch(`/api/rooms/${roomCode}/polls/${pollId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, optionIndexes }),
        });
      } catch {
        const reverted = new Set(hasVotedPoll);
        reverted.delete(pollId);
        setHasVotedPoll(reverted);
      }
    },
    [participantId, hasVotedPoll, roomCode]
  );

  if (roomLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="loading-pulse text-sm text-slate-400">読み込み中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5 bg-slate-50">
        <p className="text-sm sm:text-base text-slate-500">ルームが見つかりませんでした</p>
        <Link href="/rooms" className="text-sm sm:text-base text-emerald-600 hover:underline font-semibold">
          ルーム一覧に戻る
        </Link>
      </div>
    );
  }

  const totalQuestions = questions.length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-2xl px-4 sm:px-5 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Image
                src={LOGO_URL}
                alt=""
                width={32}
                height={32}
                className="rounded-xl shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-emerald-600 uppercase">
                  ざせきくん LIVE
                </p>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight tracking-tight truncate">
                  {room.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!qConnected && !pConnected && (
                <span
                  title="接続が不安定なためポーリングモードで動作中"
                  className="flex items-center gap-1 text-[10px] sm:text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-semibold"
                >
                  <WifiOff className="w-3 h-3" />
                  再接続中
                </span>
              )}
              {room.status === 'closed' && (
                <span className="text-[10px] sm:text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-semibold">
                  終了
                </span>
              )}
              <span className="flex items-center gap-1 text-xs sm:text-sm bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Users className="w-3.5 h-3.5" />
                {Math.max(presenceCount, 1)}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-2 flex">
            <TabButton
              active={tab === 'qa'}
              onClick={() => setTab('qa')}
              icon={<MessageSquare className="w-4 h-4" />}
              label="質問"
            />
            <TabButton
              active={tab === 'polls'}
              onClick={() => setTab('polls')}
              icon={<BarChart3 className="w-4 h-4" />}
              label="投票・回答"
              dot={!!activePoll}
            />
            <TabButton
              active={tab === 'mine'}
              onClick={() => setTab('mine')}
              icon={<User2 className="w-4 h-4" />}
              label="Mine"
              badge={myQuestions.length || undefined}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-2xl px-4 sm:px-5 py-4 space-y-4">
        {/* Q&A Tab */}
        {tab === 'qa' && (
          <>
            {/* Composer */}
            {room.status === 'active' && (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    {(displayName.trim() || '匿').slice(0, 1)}
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
                    placeholder="表示名（任意 / 空欄で匿名）"
                    className="flex-1 bg-transparent text-sm sm:text-base placeholder:text-slate-400 focus:outline-none"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                  <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value.slice(0, MAX_LEN))}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmitQuestion();
                    }}
                    placeholder={`${displayName.trim() || '匿名'} として質問を投稿`}
                    className="w-full min-h-[64px] max-h-40 resize-none bg-transparent text-sm sm:text-base placeholder:text-slate-400 focus:outline-none leading-relaxed"
                    style={{ fontSize: '16px' }}
                    rows={2}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] sm:text-xs text-slate-400 tabular-nums">
                      {questionText.length}/{MAX_LEN}
                    </span>
                    <button
                      onClick={handleSubmitQuestion}
                      disabled={!questionText.trim() || sending}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 h-9 rounded-full text-xs sm:text-sm font-semibold shadow-sm shadow-emerald-200/60 transition-all active:scale-[0.97]"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      送信
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Moderation notice */}
            {room.moderation_enabled && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50/80 ring-1 ring-emerald-200/70 px-3 py-2.5 text-xs sm:text-sm text-emerald-800">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                <p className="leading-relaxed">
                  このルームは承認制です。投稿後、管理者の承認を経て公開されます。
                </p>
              </div>
            )}

            {/* Sort toggle + count */}
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-full bg-white ring-1 ring-slate-200 p-1">
                <SortPill
                  active={sort === 'popular'}
                  onClick={() => setSort('popular')}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  label="人気"
                />
                <SortPill
                  active={sort === 'newest'}
                  onClick={() => setSort('newest')}
                  icon={<ChevronUp className="w-3.5 h-3.5" />}
                  label="新着"
                />
              </div>
              <span className="text-xs sm:text-sm text-slate-500 font-semibold tabular-nums">
                {totalQuestions}件
              </span>
            </div>

            {/* Questions list */}
            {qLoading ? (
              <p className="text-center text-sm text-slate-400 py-10">読み込み中...</p>
            ) : sortedQuestions.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-8 h-8 text-emerald-300" />}
                title="まだ質問はありません"
                hint="最初の一問を投稿してみましょう"
              />
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-2.5"
              >
                <AnimatePresence>
                  {sortedQuestions.map((q) => (
                    <ParticipantQuestionRow
                      key={q.id}
                      q={q}
                      hasVoted={votedQuestions.has(q.id)}
                      isOwn={ownQuestionIds.has(q.id)}
                      onVote={handleVote}
                      onEdit={handleEditQuestion}
                      onDeleteOwn={handleDeleteOwnQuestion}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}

        {/* Polls Tab */}
        {tab === 'polls' && (
          <div className="space-y-4">
            {activePoll && (
              <ActivePollCard
                poll={activePoll}
                votes={pollVotes[activePoll.id] || []}
                hasVoted={hasVotedPoll.has(activePoll.id)}
                participantId={participantId}
                onSubmit={(indexes) => handlePollVote(activePoll.id, indexes)}
              />
            )}

            {/* Closed polls */}
            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : (
              polls
                .filter((p) => p.status === 'closed')
                .map((poll) => (
                  <motion.div
                    key={poll.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-5"
                  >
                    <span className="text-xs text-slate-400 mb-1 block font-semibold uppercase tracking-wider">
                      終了済み
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 mb-3 leading-snug">
                      {poll.question}
                    </h3>
                    <PollResultsChart
                      options={extractPollPayload(poll.options).options}
                      votes={pollVotes[poll.id] || []}
                      totalVotes={(pollVotes[poll.id] || []).length}
                    />
                  </motion.div>
                ))
            )}

            {!activePoll && polls.filter((p) => p.status === 'closed').length === 0 && !pLoading && (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8 text-emerald-300" />}
                title="まだ投票はありません"
                hint="ホストが投票を開始するとここに表示されます"
              />
            )}
          </div>
        )}

        {/* Mine Tab */}
        {tab === 'mine' && (
          <div className="space-y-3">
            {myQuestions.length === 0 ? (
              <EmptyState
                icon={<User2 className="w-8 h-8 text-emerald-300" />}
                title="まだ投稿していません"
                hint="質問タブから自分の質問を投稿しましょう"
              />
            ) : (
              <>
                {pendingMyCount > 0 && (
                  <p className="text-xs sm:text-sm text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2">
                    あなたの質問のうち {pendingMyCount} 件は管理者の承認待ちです。
                  </p>
                )}
                <AnimatePresence>
                  {myQuestions.map((q) => (
                    <ParticipantQuestionRow
                      key={q.id}
                      q={q}
                      hasVoted={votedQuestions.has(q.id)}
                      isOwn
                      onVote={handleVote}
                      onEdit={handleEditQuestion}
                      onDeleteOwn={handleDeleteOwnQuestion}
                      showStatus
                    />
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 小コンポーネント ---------- */

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-700'
          : 'border-transparent text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      {label}
      {dot && (
        <span className="absolute right-3 top-2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {badge !== undefined && (
        <span className="ml-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold tabular-nums">
          {badge}
        </span>
      )}
    </button>
  );
}

function SortPill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
        active
          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200/60'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm sm:text-base font-bold text-slate-700">{title}</p>
      <p className="text-xs sm:text-sm text-slate-400 mt-1">{hint}</p>
    </div>
  );
}

function ParticipantQuestionRow({
  q,
  hasVoted,
  isOwn,
  onVote,
  onEdit,
  onDeleteOwn,
  showStatus,
}: {
  q: Question;
  hasVoted: boolean;
  isOwn: boolean;
  onVote: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onDeleteOwn: (id: string) => void;
  showStatus?: boolean;
}) {
  return (
    <div className="relative">
      {showStatus && q.status && q.status !== 'approved' && (
        <span
          className={`absolute -top-2 left-3 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
            q.status === 'pending'
              ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
              : 'bg-red-100 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {q.status === 'pending' ? '承認待ち' : '非公開'}
        </span>
      )}
      <QuestionCard
        id={q.id}
        text={q.text}
        authorName={q.author_name}
        upvoteCount={q.upvote_count}
        isAnswered={q.is_answered}
        isPinned={q.is_pinned}
        createdAt={q.created_at}
        hasVoted={hasVoted}
        onVote={onVote}
        isOwn={isOwn}
        onEdit={onEdit}
        onDeleteOwn={onDeleteOwn}
        likeIcon={<Heart className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />}
      />
    </div>
  );
}

function ActivePollCard({
  poll,
  votes,
  hasVoted,
  participantId,
  onSubmit,
}: {
  poll: Poll;
  votes: PollVote[];
  hasVoted: boolean;
  participantId: string | null;
  onSubmit: (indexes: number[]) => void;
}) {
  const { meta, options } = extractPollPayload(poll.options);
  const mode = getPollMode(meta.mode);
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const isMulti = maxSelections > 1 || poll.allow_multiple;
  const isRanking = mode === 'ranking';
  const isQuiz = mode === 'quiz';
  const isStandard = mode === 'standard';
  const [selected, setSelected] = useState<number[]>([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // タイマー開始時刻は DB の poll.started_at（サーバー時刻）を全端末で共有してカウントダウン。
  const timerStartMs = poll.started_at ? new Date(poll.started_at).getTime() : null;

  const toggle = (i: number) => {
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (!isMulti) return [i];
      if (prev.length >= maxSelections) return prev;
      return [...prev, i];
    });
  };

  const counts = options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalCast = counts.reduce((s, c) => s + c, 0);
  const totalRespondents = isRanking
    ? new Set(votes.map((v) => v.participant_id)).size
    : totalCast;
  const rankingValue = isRanking ? selected : [];
  const rankingFilled = rankingValue.filter((v) => Number.isInteger(v) && v >= 0);
  const quizQuestions = isQuiz ? getQuizQuestions(meta, options) : [];
  const ownVotes = participantId ? votes.filter((v) => v.participant_id === participantId) : [];
  // 「あなたの回答」は送信済みのみを採用（未送信の選択は反映しない）。
  const ownAnswerIndexes = ownVotes.length > 0
    ? ownVotes
        .map((v) => v.option_index)
        .filter((idx): idx is number => typeof idx === 'number')
    : [];
  const isAnswered = (question: { optionStart: number; optionCount: number }) =>
    selected.some(
      (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
    );
  const answeredQuizCount = quizQuestions.filter(isAnswered).length;

  // 全問共通の制限時間でカウントダウン（管理者設定）。時間切れで送信不可・解答開示。
  const standardTimeLimit = isStandard ? meta.timeLimitSeconds || 0 : 0;
  const quizTimeLimit = isQuiz ? meta.timeLimitSeconds || 0 : 0;
  const rankingTimeLimit = isRanking ? meta.timeLimitSeconds || 0 : 0;
  const hasStandardTimer = isStandard && standardTimeLimit > 0;
  const hasQuizTimer = isQuiz && quizTimeLimit > 0;
  const hasRankingTimer = isRanking && rankingTimeLimit > 0;
  const standardRemaining =
    hasStandardTimer && timerStartMs
      ? Math.max(0, Math.ceil(standardTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const quizRemaining =
    hasQuizTimer && timerStartMs
      ? Math.max(0, Math.ceil(quizTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const rankingRemaining =
    hasRankingTimer && timerStartMs
      ? Math.max(0, Math.ceil(rankingTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const standardNotStarted = hasStandardTimer && !timerStartMs;
  const standardExpired =
    hasStandardTimer && standardRemaining !== null && standardRemaining <= 0;
  const quizExpired =
    hasQuizTimer && quizRemaining !== null && quizRemaining <= 0;
  const rankingNotStarted = hasRankingTimer && !timerStartMs;
  const rankingExpired = hasRankingTimer && rankingRemaining !== null && rankingRemaining <= 0;
  // サーバー側のライブ票（cleared_at IS NULL）が 0 ならリセット後とみなし、
  // 楽観 hasVoted は無視して未投票扱いに戻す → スクリーンの状態と同期
  const hasLiveOwnVote = ownVotes.length > 0;
  const effectiveHasVoted = hasVoted && hasLiveOwnVote;
  // 開示（結果・正解を表示）= 送信済み(ライブ票あり) or 時間切れ
  const quizRevealed = isQuiz && (effectiveHasVoted || quizExpired);
  const rankingRevealed = isRanking && (hasRankingTimer ? rankingExpired : effectiveHasVoted);
  const standardRevealed = isStandard && (hasStandardTimer ? standardExpired : effectiveHasVoted);
  const showResults = isQuiz ? quizRevealed : isRanking ? rankingRevealed : standardRevealed;
  // 送信可能: 未送信 && 時間切れでない && 1問以上回答
  const quizSubmittable =
    isQuiz && !effectiveHasVoted && !quizExpired && answeredQuizCount > 0;
  const quizScore =
    isQuiz && effectiveHasVoted ? getQuizScore(quizQuestions, ownAnswerIndexes) : null;

  useEffect(() => {
    setSelected([]);
    setActiveQuizIndex(0);
  }, [poll.id]);

  // タイマー稼働（未送信 && 未締切のときのみ）
  useEffect(() => {
    if (
      (!hasStandardTimer && !hasQuizTimer && !hasRankingTimer) ||
      (isQuiz && effectiveHasVoted) ||
      quizExpired ||
      rankingExpired ||
      standardExpired
    ) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [
    hasStandardTimer,
    hasQuizTimer,
    hasRankingTimer,
    isQuiz,
    effectiveHasVoted,
    quizExpired,
    rankingExpired,
    standardExpired,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-5"
    >
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          {isMulti && (
            <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {isRanking ? `${maxSelections}件を順位選択` : '複数選択'}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <span className="text-slate-500 tabular-nums">回答数: {totalRespondents}</span>
      </div>
      <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 mb-1 leading-snug">
        {poll.question}
      </h3>
      {hasStandardTimer && !standardExpired && (
        <div
          className={`mt-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ${
            timerStartMs
              ? 'bg-emerald-50 ring-emerald-200'
              : 'bg-slate-50 ring-slate-200'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {timerStartMs
              ? `${standardTimeLimit}秒で投票してください`
              : `${standardTimeLimit}秒で回答（開始待ち）`}
          </span>
          <span
            className={`tabular-nums text-base sm:text-lg font-extrabold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {timerStartMs ? '残り ' : ''}
            {Math.floor((standardRemaining ?? standardTimeLimit) / 60)}:
            {String(Math.floor((standardRemaining ?? standardTimeLimit) % 60)).padStart(2, '0')}
          </span>
        </div>
      )}
      {hasQuizTimer && !effectiveHasVoted && !quizExpired && (
        <div
          className={`mt-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ${
            timerStartMs
              ? 'bg-emerald-50 ring-emerald-200'
              : 'bg-slate-50 ring-slate-200'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {timerStartMs
              ? `全${quizQuestions.length}問を${quizTimeLimit}秒で回答してください`
              : `全${quizQuestions.length}問を${quizTimeLimit}秒で回答（開始待ち）`}
          </span>
          <span
            className={`tabular-nums text-base sm:text-lg font-extrabold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {timerStartMs ? '残り ' : ''}
            {Math.floor((quizRemaining ?? quizTimeLimit) / 60)}:
            {String(Math.floor((quizRemaining ?? quizTimeLimit) % 60)).padStart(2, '0')}
          </span>
        </div>
      )}
      {hasRankingTimer && !effectiveHasVoted && !rankingExpired && (
        <div
          className={`mt-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ${
            timerStartMs
              ? 'bg-emerald-50 ring-emerald-200'
              : 'bg-slate-50 ring-slate-200'
          }`}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {timerStartMs
              ? `${rankingTimeLimit}秒でランキングを送信してください`
              : `${rankingTimeLimit}秒で回答（開始待ち）`}
          </span>
          <span
            className={`tabular-nums text-base sm:text-lg font-extrabold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {timerStartMs ? '残り ' : ''}
            {Math.floor((rankingRemaining ?? rankingTimeLimit) / 60)}:
            {String(Math.floor((rankingRemaining ?? rankingTimeLimit) % 60)).padStart(2, '0')}
          </span>
        </div>
      )}
      {isQuiz && quizExpired && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          時間切れ — 解答を表示しています
        </div>
      )}
      {isRanking && rankingExpired && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          投票時間が終了しました
        </div>
      )}
      {isStandard && standardExpired && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          投票時間が終了しました
        </div>
      )}
      {isMulti && !isQuiz && (
        <p className="text-xs sm:text-sm text-slate-500 mb-3">
          {isRanking ? (
            <>
              <span className="font-bold text-slate-700">{maxSelections}</span> 件を1位から順に選択してください
            </>
          ) : (
            <>
              1人最大 <span className="font-bold text-slate-700">{maxSelections}</span> つまで選択できます
            </>
          )}
        </p>
      )}

      {showResults ? (
        <div className="space-y-4 mt-3">
          {isRanking ? (
            <>
              {ownVotes.length > 0 && (
                <div className="rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
                  <p className="text-xs font-bold text-emerald-700">あなたのランキング</p>
                  <div className="mt-2 space-y-1.5">
                    {ownVotes
                      .slice()
                      .sort((a, b) => Number(a.value) - Number(b.value))
                      .map((v, rankIndex) => (
                        <div
                          key={rankIndex}
                          className="flex items-start gap-2 text-xs sm:text-sm text-slate-700"
                        >
                          <span className="shrink-0 font-bold text-emerald-700">
                            {rankLabel(Number(v.value) - 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {typeof v.option_index === 'number'
                              ? getRankingOptionLabel(
                                  options[v.option_index],
                                  v.option_index,
                                  getRankingDisplayMode(meta.rankingDisplayMode)
                                )
                              : '—'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <p className="text-xs font-bold text-slate-500">集計結果</p>
              <RankingResults
                options={options}
                votes={votes}
                rankCount={maxSelections}
                weights={meta.rankingWeights}
                displayMode={getRankingDisplayMode(meta.rankingDisplayMode)}
                size="compact"
              />
            </>
          ) : isQuiz ? (
            <>
              {ownAnswerIndexes.length > 0 && (
                <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-700">あなたの回答</p>
                    {quizScore && quizScore.gradable > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {quizScore.correct}/{quizScore.gradable} 問正解
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {quizQuestions.map((question) => {
                      const ownIndex = ownAnswerIndexes.find(
                        (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
                      );
                      const optionOffset = typeof ownIndex === 'number' ? ownIndex - question.optionStart : -1;
                      const hasKey = typeof question.correctOptionOffset === 'number';
                      const isCorrect = hasKey && optionOffset === question.correctOptionOffset;
                      return (
                        <div key={question.id} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <span className="shrink-0 font-bold text-emerald-700">
                            問題 {question.questionNumber}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {typeof ownIndex === 'number'
                              ? `${optionLetter(optionOffset)}. ${getPollOptionLabel(options[ownIndex], `解答 ${optionLetter(optionOffset)}`)}`
                              : '未回答'}
                          </span>
                          {hasKey &&
                            (isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                            ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {quizQuestions.map((question, questionIndex) => {
                const questionTotal = votes.filter(
                  (v) => Number(v.value) === questionIndex + 1
                ).length;
                return (
                  <div key={question.id} className="space-y-2">
                    <p className="text-sm font-bold text-slate-800">
                      問題 {question.questionNumber} {question.question}
                    </p>
                    {options
                      .slice(question.optionStart, question.optionStart + question.optionCount)
                      .map((option, offset) => {
                        const i = question.optionStart + offset;
                        const count = counts[i];
                        const pct = questionTotal > 0 ? Math.round((count / questionTotal) * 100) : 0;
                        const hasKey = typeof question.correctOptionOffset === 'number';
                        const isCorrect = hasKey && question.correctOptionOffset === offset;
                        return (
                          <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl bg-white ring-1 ${
                              isCorrect ? 'ring-2 ring-emerald-400' : 'ring-slate-200'
                            }`}
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
                                <span className="text-emerald-700 font-semibold">{optionLetter(offset)}</span>
                                <span className="truncate">
                                  {getPollOptionLabel(option, `解答 ${optionLetter(offset)}`)}
                                </span>
                                {isCorrect && (
                                  <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    正解
                                  </span>
                                )}
                              </span>
                              <span className="text-xs sm:text-sm text-slate-500 tabular-nums shrink-0">
                                {count} ({pct}%)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="space-y-2">
              {options.map((option, i) => {
                const count = counts[i];
                const pct = totalCast > 0 ? Math.round((count / totalCast) * 100) : 0;
                return (
                  <div key={i} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200 bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="absolute left-0 top-0 bottom-0 bg-emerald-100/80"
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="flex items-center gap-2 min-w-0 text-sm sm:text-base text-slate-800">
                        <span className="text-emerald-700 font-semibold">
                          {i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`}
                        </span>
                        <span className="truncate">{getPollOptionLabel(option, `選択肢 ${i + 1}`)}</span>
                      </span>
                      <span className="text-xs sm:text-sm text-slate-500 tabular-nums shrink-0">
                        {count} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isRanking ? (
        rankingNotStarted ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
            開始待ちです
          </div>
        ) : effectiveHasVoted ? (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-4 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            ランキングを送信しました。集計結果は投票時間後に表示されます。
          </div>
        ) : (
        <>
          <div className="mt-3">
            <RankingPicker
              options={options}
              maxSelections={maxSelections}
              value={rankingValue}
              onChange={setSelected}
              displayMode={getRankingDisplayMode(meta.rankingDisplayMode)}
            />
          </div>

          {rankingFilled.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
              <p className="text-xs font-bold text-slate-600">選択内容の確認</p>
              <div className="mt-2 space-y-1.5">
                {Array.from({ length: maxSelections }).map((_, rankIndex) => {
                  const optionIndex = rankingValue[rankIndex];
                  const filled = Number.isInteger(optionIndex) && optionIndex >= 0;
                  return (
                    <div
                      key={rankIndex}
                      className="flex items-start gap-2 text-xs sm:text-sm"
                    >
                      <span className="shrink-0 font-bold text-emerald-700">
                        {rankLabel(rankIndex)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          filled ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        {filled
                          ? `${getRankingOptionLabel(
                              options[optionIndex],
                              optionIndex,
                              getRankingDisplayMode(meta.rankingDisplayMode)
                            )}${
                              getRankingDisplayMode(meta.rankingDisplayMode) === 'number_text' && getPollOptionDetail(options[optionIndex])
                                ? `（${getPollOptionDetail(options[optionIndex])}）`
                                : ''
                            }`
                          : '未選択'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onSubmit(rankingFilled)}
            disabled={rankingFilled.length !== maxSelections || rankingExpired}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            ランキングを送信
            <span className="text-xs font-bold tabular-nums">
              ({rankingFilled.length}/{maxSelections})
            </span>
          </button>
        </>
        )
      ) : isQuiz ? (
        <>
          <div className="mt-3 rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveQuizIndex((i) => Math.max(0, i - 1))}
                disabled={activeQuizIndex === 0}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                aria-label="前の問題"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex min-w-0 items-center gap-3 text-center">
                {hasQuizTimer && quizRemaining !== null && (
                  <QuizTimerRing remaining={quizRemaining} total={quizTimeLimit} />
                )}
                <div>
                  <p className="text-xs font-bold text-emerald-700 tabular-nums">
                    {activeQuizIndex + 1} / {quizQuestions.length}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500 tabular-nums">
                    回答済み {answeredQuizCount}/{quizQuestions.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuizIndex((i) => Math.min(quizQuestions.length - 1, i + 1))}
                disabled={activeQuizIndex >= quizQuestions.length - 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                aria-label="次の問題"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${activeQuizIndex * 100}%)` }}
              >
                {quizQuestions.map((question) => {
                  return (
                  <div key={question.id} className="w-full shrink-0 space-y-3 px-0.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-emerald-700">
                          問題 {question.questionNumber}
                        </p>
                      </div>
                      <h4 className="mt-1 text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {question.question}
                      </h4>
                    </div>
                    {/* 参加者投票画面: 選択肢は1列表示 */}
                    <div className="space-y-2">
                      {options.slice(question.optionStart, question.optionStart + question.optionCount).map((option, offset) => {
                        const globalIndex = question.optionStart + offset;
                        const checked = selected.includes(globalIndex);
                        const imageUrl = getPollOptionImageUrl(option);
                        return (
                          <button
                            key={globalIndex}
                            onClick={() => {
                              setSelected((prev) => [
                                ...prev.filter((idx) => idx < question.optionStart || idx >= question.optionStart + question.optionCount),
                                globalIndex,
                              ]);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl ring-1 transition-all active:scale-[0.99] disabled:cursor-not-allowed ${
                              checked
                                ? 'ring-emerald-400 bg-emerald-50'
                                : 'ring-slate-200 bg-white hover:bg-slate-50 hover:ring-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-3 text-sm sm:text-base font-semibold text-slate-700">
                              <span
                                className={`shrink-0 w-5 h-5 rounded-full ring-1 flex items-center justify-center transition-colors ${
                                  checked ? 'bg-emerald-500 ring-emerald-500 text-white' : 'bg-white ring-slate-300'
                                }`}
                                aria-hidden
                              >
                                {checked && <Check className="w-3.5 h-3.5" />}
                              </span>
                              <span className="text-emerald-700 font-bold">{optionLetter(offset)}</span>
                              <span className="min-w-0 flex-1 truncate">{getPollOptionLabel(option, `解答 ${optionLetter(offset)}`)}</span>
                              {imageUrl && (
                                <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

          </div>
          {quizSubmittable && (
            <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
              <p className="text-xs font-bold text-emerald-700">回答確認</p>
              <div className="mt-2 space-y-1.5">
                {quizQuestions.map((question) => {
                  const answerIndex = selected.find(
                    (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
                  );
                  const optionOffset = typeof answerIndex === 'number' ? answerIndex - question.optionStart : -1;
                  return (
                    <div key={question.id} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <span className="shrink-0 font-bold text-emerald-700">
                        問題 {question.questionNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {typeof answerIndex === 'number'
                          ? `${optionLetter(optionOffset)}. ${getPollOptionLabel(options[answerIndex], `解答 ${optionLetter(optionOffset)}`)}`
                          : '未回答'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!quizSubmittable) return;
              onSubmit(selected);
            }}
            disabled={!quizSubmittable}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            {quizExpired ? '時間切れ — 送信不可' : '完了して送信'}
            <span className="text-xs font-bold tabular-nums">
              ({answeredQuizCount}/{quizQuestions.length})
            </span>
          </button>
        </>
      ) : (
        standardNotStarted ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
            開始待ちです
          </div>
        ) : effectiveHasVoted && hasStandardTimer ? (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-4 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            投票を送信しました。結果は投票時間後に表示されます。
          </div>
        ) : (
        <>
          <div className="space-y-2 mt-3">
            {options.map((option, i) => {
              const checked = selected.includes(i);
              const disabled =
                standardNotStarted ||
                standardExpired ||
                (isMulti && !checked && selected.length >= maxSelections);
              const imageUrl = getPollOptionImageUrl(option);
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  disabled={disabled}
                  className={`w-full text-left px-4 py-3 rounded-xl ring-1 transition-all active:scale-[0.99] disabled:opacity-50 ${
                    checked
                      ? 'ring-emerald-400 bg-emerald-50'
                      : 'ring-slate-200 bg-slate-50 hover:bg-white hover:ring-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-3 text-sm sm:text-base font-semibold text-slate-700">
                    <span
                      className={`shrink-0 w-5 h-5 ${isMulti ? 'rounded' : 'rounded-full'} ring-1 flex items-center justify-center transition-colors ${
                        checked ? 'bg-emerald-500 ring-emerald-500 text-white' : 'bg-white ring-slate-300'
                      }`}
                      aria-hidden
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {isQuiz ? optionLetter(i) : i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{getPollOptionLabel(option, `選択肢 ${i + 1}`)}</span>
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            disabled={selected.length === 0 || standardNotStarted || standardExpired}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            {standardExpired ? '投票時間終了' : '投票する'}
            {isMulti && selected.length > 0 && (
              <span className="text-xs font-bold tabular-nums">
                ({selected.length}/{maxSelections})
              </span>
            )}
          </button>
        </>
        )
      )}
    </motion.div>
  );
}
