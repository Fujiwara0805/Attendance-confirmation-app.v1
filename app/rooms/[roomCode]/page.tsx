'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ShieldAlert,
  Check,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParticipantSession } from '@/lib/hooks/useParticipantSession';
import { useRealtimeQuestions, type Question } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import QuestionCard from '../components/QuestionCard';
import PollResultsChart from '../components/PollResultsChart';
import { staggerContainer } from '@/lib/animations';

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
    const storedOwn = localStorage.getItem(`own_questions_${roomCode}`);
    if (storedOwn) setOwnQuestionIds(new Set(JSON.parse(storedOwn)));
  }, [roomCode, isReady]);

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
              label="投票"
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
                      options={poll.options}
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
  onSubmit,
}: {
  poll: Poll;
  votes: PollVote[];
  hasVoted: boolean;
  onSubmit: (indexes: number[]) => void;
}) {
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const isMulti = maxSelections > 1 || poll.allow_multiple;
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      if (prev.includes(i)) return prev.filter((x) => x !== i);
      if (!isMulti) return [i];
      if (prev.length >= maxSelections) return prev;
      return [...prev, i];
    });
  };

  const counts = poll.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalCast = counts.reduce((s, c) => s + c, 0);

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
              複数選択
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <span className="text-slate-500 tabular-nums">回答数: {totalCast}</span>
      </div>
      <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 mb-1 leading-snug">
        {poll.question}
      </h3>
      {isMulti && (
        <p className="text-xs sm:text-sm text-slate-500 mb-3">
          1人最大 <span className="font-bold text-slate-700">{maxSelections}</span> つまで選択できます
        </p>
      )}

      {hasVoted ? (
        <div className="space-y-2 mt-3">
          {poll.options.map((option, i) => {
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
      ) : (
        <>
          <div className="space-y-2 mt-3">
            {poll.options.map((option, i) => {
              const checked = selected.includes(i);
              const disabled = isMulti && !checked && selected.length >= maxSelections;
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
                    <span className="text-emerald-700">
                      {i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`}
                    </span>
                    <span className="truncate">{option}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            disabled={selected.length === 0}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            投票する
            {isMulti && selected.length > 0 && (
              <span className="text-xs font-bold tabular-nums">
                ({selected.length}/{maxSelections})
              </span>
            )}
          </button>
        </>
      )}
    </motion.div>
  );
}
