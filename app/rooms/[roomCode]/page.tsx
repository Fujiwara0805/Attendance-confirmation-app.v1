'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
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
  X,
  ClipboardCheck,
  ArrowRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParticipantSession } from '@/lib/hooks/useParticipantSession';
import { useRealtimeQuestions, type Question } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import { useActivePollVotes } from '@/lib/hooks/useActivePollVotes';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import QuestionCard from '../components/QuestionCard';
import RankingResults from '../components/RankingResults';
import RankingPicker from '../components/RankingPicker';
import QuizTimerRing from '../components/QuizTimerRing';
import { staggerContainer } from '@/lib/animations';
import {
  extractPollPayload,
  FREE_TEXT_CARD_COLOR_LABELS,
  FREE_TEXT_CARD_COLORS,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getPollOptionDetail,
  getQuizAnswerLimit,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getQuizScore,
  getRankingDisplayMode,
  getRankingOptionLabel,
  optionLetter,
  POLL_AGGREGATION_MAX_SETTLE_MS,
  POLL_AGGREGATION_SETTLE_MS,
  rankLabel,
  type FreeTextCardColor,
  type PollOption,
} from '@/lib/pollModes';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

type Tab = 'qa' | 'polls' | 'mine' | 'attendance';

// 位置情報APIを使うためクライアントサイドのみで読み込み
const AttendanceForm = dynamic(
  () => import('@/app/attendance/components/AttendanceForm'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      出席フォームを読み込み中...
    </div>
  ) }
);
type Sort = 'popular' | 'newest';

function formatQuizAnswerLabel(option: PollOption, optionOffset: number) {
  const letter = optionLetter(optionOffset);
  const label = getPollOptionLabel(option, `解答 ${letter}`).trim();
  return label === letter ? letter : `${letter}. ${label}`;
}

interface LinkedCourseSummary {
  code: string;
  name: string;
  teacher_name: string | null;
}

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
  moderation_enabled?: boolean;
  linked_course_code?: string | null;
  linked_course?: LinkedCourseSummary | null;
}

const MAX_LEN = 500;
const FREE_TEXT_COLOR_CLASSES: Record<FreeTextCardColor, string> = {
  yellow: 'bg-yellow-100 ring-yellow-200 text-yellow-900',
  green: 'bg-emerald-100 ring-emerald-200 text-emerald-900',
  blue: 'bg-blue-100 ring-blue-200 text-blue-900',
  orange: 'bg-orange-100 ring-orange-200 text-orange-900',
};
const FREE_TEXT_SELECTED_COLOR_CLASSES: Record<FreeTextCardColor, string> = {
  yellow: 'ring-yellow-500',
  green: 'ring-emerald-500',
  blue: 'ring-blue-500',
  orange: 'ring-orange-500',
};

function getPollRunKey(poll: Pick<Poll, 'id' | 'started_at'>) {
  return `${poll.id}:${poll.started_at || 'draft'}`;
}

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
  // 参加者画面はルーム内の全 poll_votes を購読しない（subscribeVotes:false）。
  // 1,000人 × 50問規模のファンアウトを避けるため、表示中の1枚の票だけを
  // useActivePollVotes（standard/quiz は集計ポーリング、ranking/free_text は単一poll購読）で取得する。
  const { activePoll, activePolls: rawActivePolls, polls, loading: pLoading, connected: pConnected } =
    useRealtimePolls(room?.id || null, { subscribeVotes: false });
  // スクリーン画面・資料投影画面と同じ並び順。bulkOrder（一斉開始時の選択順）優先、未設定は作成順（古い順＝1問目が先頭）。
  const activePolls = useMemo<Poll[]>(() => {
    return [...rawActivePolls].sort((a: Poll, b: Poll) => {
      const am = extractPollPayload(a.options).meta.bulkOrder;
      const bm = extractPollPayload(b.options).meta.bulkOrder;
      const aHas = typeof am === 'number';
      const bHas = typeof bm === 'number';
      if (aHas && bHas) return (am as number) - (bm as number);
      if (aHas) return -1;
      if (bHas) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rawActivePolls]);

  // 表示中（先頭）のアクティブ投票1枚ぶんの票だけを取得する。
  const activePollVotes = useActivePollVotes(activePolls[0] || null, participantId || null);

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
        const becameDraft = prev.status !== 'draft' && poll.status === 'draft';
        const hasLegacyVote = next.has(poll.id);
        const pollRunPrefix = `${poll.id}:`;
        const storedRunKeys = Array.from(next).filter((key) => key.startsWith(pollRunPrefix));
        if (hasLegacyVote) {
          next.delete(poll.id);
          changed = true;
        }
        if (becameDraft && storedRunKeys.length > 0) {
          storedRunKeys.forEach((key) => next.delete(key));
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
    async (
      poll: Poll,
      optionIndexes: number[],
      value?: string,
      meta?: { authorName?: string; isAnonymous?: boolean; color?: FreeTextCardColor }
    ) => {
      const runKey = getPollRunKey(poll);
      if (!participantId || (optionIndexes.length === 0 && !value?.trim())) return;
      const isFreeText = getPollMode(extractPollPayload(poll.options).meta.mode) === 'free_text';
      if (!isFreeText) {
        const newVoted = new Set(hasVotedPoll);
        newVoted.add(runKey);
        setHasVotedPoll(newVoted);
        localStorage.setItem(`voted_polls_${roomCode}`, JSON.stringify(Array.from(newVoted)));
      }

      try {
        // 押下時点の経過時間（画面カウントダウンと同一計算）をサーバーへ送る。
        // ネットワーク遅延でサーバー到達が締切を跨いでも、押下が時間内なら全回答を受理させる。
        const clientElapsedMs = poll.started_at
          ? Date.now() - new Date(poll.started_at).getTime()
          : undefined;
        const res = await fetch(`/api/rooms/${roomCode}/polls/${poll.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, optionIndexes, value, clientElapsedMs, ...meta }),
        });
        if (!res.ok) throw new Error('poll vote failed');
      } catch (error) {
        if (isFreeText) return;
        const reverted = new Set(hasVotedPoll);
        reverted.delete(runKey);
        setHasVotedPoll(reverted);
        localStorage.setItem(`voted_polls_${roomCode}`, JSON.stringify(Array.from(reverted)));
        throw error;
      }
    },
    [participantId, hasVotedPoll, roomCode]
  );

  // ブレスト形式: 投稿者本人による自分の回答の編集
  const handleEditResponse = useCallback(
    async (pollId: string, voteId: string, value: string) => {
      if (!participantId) return;
      const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}/responses/${voteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, value }),
      });
      if (!res.ok) throw new Error('edit response failed');
    },
    [participantId, roomCode]
  );

  // ブレスト形式: 投稿者本人による自分の回答の削除（ソフト削除）
  const handleDeleteResponse = useCallback(
    async (pollId: string, voteId: string) => {
      if (!participantId) return;
      const res = await fetch(
        `/api/rooms/${roomCode}/polls/${pollId}/responses/${voteId}?participantId=${participantId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('delete response failed');
    },
    [participantId, roomCode]
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
            {room.linked_course && (
              <TabButton
                active={tab === 'attendance'}
                onClick={() => setTab('attendance')}
                icon={<ClipboardCheck className="w-4 h-4" />}
                label="出席"
                accent
              />
            )}
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
            {/* スクリーン画面・資料投影画面と同期し、先頭（現在表示中）の1枚だけを表示する。 */}
            {activePolls.slice(0, 1).map((poll) => (
              <ActivePollCard
                key={poll.id}
                poll={poll}
                votes={activePollVotes}
                participantId={participantId}
                displayName={displayName}
                setDisplayName={setDisplayName}
                onSubmit={(indexes, value, meta) => handlePollVote(poll, indexes, value, meta)}
                onEditResponse={(voteId, value) => handleEditResponse(poll.id, voteId, value)}
                onDeleteResponse={(voteId) => handleDeleteResponse(poll.id, voteId)}
              />
            ))}

            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : null}

            {activePolls.length === 0 && !pLoading && (
              <EmptyState
                icon={<BarChart3 className="w-8 h-8 text-emerald-300" />}
                title="まだ投票はありません"
                hint="LIVE（開始中）のカードだけがここに表示されます"
              />
            )}
          </div>
        )}

        {/* Attendance Tab — 紐付いた出席フォームのみ表示 */}
        {tab === 'attendance' && room.linked_course && (
          <AttendanceTabContent
            courseCode={room.linked_course.code}
            courseName={room.linked_course.name}
            onSwitchAway={() => setTab('qa')}
          />
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

function AttendanceTabContent({
  courseCode,
  courseName,
  onSwitchAway,
}: {
  courseCode: string;
  courseName: string;
  onSwitchAway: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <p className="text-base sm:text-lg font-bold text-slate-900">出席登録が完了しました</p>
          <p className="mt-1 text-sm text-slate-500">{courseName}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={onSwitchAway}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            ルームに戻る
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            もう一度登録する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 px-4 py-3">
        <ClipboardCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-sm text-emerald-900 leading-relaxed">
          <p className="font-bold">{courseName} の出席登録</p>
          <p className="text-emerald-800/80 text-xs sm:text-sm mt-0.5">
            位置情報を許可してフォームを送信してください。許可エリア外からは送信できません。
          </p>
        </div>
      </div>
      <AttendanceForm courseId={courseCode} onSubmitted={() => setSubmitted(true)} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  dot,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  dot?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-700'
          : accent
          ? 'border-transparent text-emerald-600 hover:text-emerald-700'
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
  participantId,
  displayName,
  setDisplayName,
  onSubmit,
  onEditResponse,
  onDeleteResponse,
}: {
  poll: Poll;
  votes: PollVote[];
  participantId: string | null;
  displayName: string;
  setDisplayName: (name: string) => void;
  onSubmit: (
    indexes: number[],
    value?: string,
    meta?: { authorName?: string; isAnonymous?: boolean; color?: FreeTextCardColor }
  ) => void | Promise<void>;
  onEditResponse: (voteId: string, value: string) => void | Promise<void>;
  onDeleteResponse: (voteId: string) => void | Promise<void>;
}) {
  const { meta, options } = extractPollPayload(poll.options);
  const mode = getPollMode(meta.mode);
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const isMulti = maxSelections > 1 || poll.allow_multiple;
  const isRanking = mode === 'ranking';
  const isQuiz = mode === 'quiz';
  const isStandard = mode === 'standard';
  const isFreeText = mode === 'free_text';
  const [selected, setSelected] = useState<number[]>([]);
  const [freeTextAnswer, setFreeTextAnswer] = useState('');
  const [freeTextColor, setFreeTextColor] = useState<FreeTextCardColor>('orange');
  const [freeTextAnonymous, setFreeTextAnonymous] = useState(true);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const currentRunKey = getPollRunKey(poll);
  const [submittedRunKey, setSubmittedRunKey] = useState<string | null>(null);
  const [submittedAnswerIndexes, setSubmittedAnswerIndexes] = useState<number[]>([]);
  // ブレスト形式: 自分の回答の編集・削除を楽観反映するためのローカル上書き
  const [responseOverrides, setResponseOverrides] = useState<
    Record<string, { value?: string; removed?: boolean }>
  >({});
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editingResponseText, setEditingResponseText] = useState('');
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
  const openImagePreview = (src: string, alt: string) => setImagePreview({ src, alt });
  const submitAnswers = async (
    indexes: number[],
    value?: string,
    submitMeta?: { authorName?: string; isAnonymous?: boolean; color?: FreeTextCardColor }
  ) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit(indexes, value, submitMeta);
      if (isFreeText) {
        setFreeTextAnswer('');
      } else {
        setSubmittedRunKey(currentRunKey);
        setSubmittedAnswerIndexes(
          indexes.filter((index) => Number.isInteger(index)).sort((a, b) => a - b)
        );
      }
    } catch (error) {
      console.error('Failed to submit poll answer:', error);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const counts = options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalCast = counts.reduce((s, c) => s + c, 0);
  const totalRespondents = isRanking
    ? new Set(votes.map((v) => v.participant_id)).size
    : isFreeText
    ? votes.filter((v) => !!v.value).length
    : totalCast;
  const rankingValue = isRanking ? selected : [];
  const rankingFilled = rankingValue.filter((v) => Number.isInteger(v) && v >= 0);
  const quizQuestions = isQuiz ? getQuizQuestions(meta, options) : [];
  const ownVotes = participantId ? votes.filter((v) => v.participant_id === participantId) : [];
  // ブレスト形式: 自分の投稿一覧（編集・削除の楽観上書きを反映、新しい順）
  const ownTextResponses = ownVotes
    .filter((v) => !!v.value)
    .map((v) => ({ ...v, value: responseOverrides[v.id]?.value ?? v.value }))
    .filter((v) => !responseOverrides[v.id]?.removed)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const saveResponseEdit = async (voteId: string) => {
    const next = editingResponseText.trim().slice(0, 80);
    if (!next) return;
    setResponseOverrides((prev) => ({ ...prev, [voteId]: { ...prev[voteId], value: next } }));
    setEditingResponseId(null);
    try {
      await onEditResponse(voteId, next);
    } catch {
      setResponseOverrides((prev) => {
        const nextState = { ...prev };
        delete nextState[voteId];
        return nextState;
      });
    }
  };

  const deleteResponse = async (voteId: string) => {
    setResponseOverrides((prev) => ({ ...prev, [voteId]: { ...prev[voteId], removed: true } }));
    if (editingResponseId === voteId) setEditingResponseId(null);
    try {
      await onDeleteResponse(voteId);
    } catch {
      setResponseOverrides((prev) => ({ ...prev, [voteId]: { ...prev[voteId], removed: false } }));
    }
  };

  // 「あなたの回答」は送信済みのみを採用（未送信の選択は反映しない）。
  const serverOwnAnswerIndexes = ownVotes
    .map((v) => v.option_index)
    .filter((idx): idx is number => typeof idx === 'number')
    .sort((a, b) => a - b);
  const hasLocalSubmittedAnswer = submittedRunKey === currentRunKey && submittedAnswerIndexes.length > 0;
  const ownAnswerIndexes =
    hasLocalSubmittedAnswer && submittedAnswerIndexes.length >= serverOwnAnswerIndexes.length
      ? submittedAnswerIndexes
      : serverOwnAnswerIndexes;
  const isAnswered = (question: { optionStart: number; optionCount: number }) =>
    selected.some(
      (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
    );
  const answeredQuizCount = quizQuestions.filter(isAnswered).length;
  const activeQuizQuestion = quizQuestions[activeQuizIndex];
  const activeQuizAnswerLimit = activeQuizQuestion ? getQuizAnswerLimit(activeQuizQuestion) : 1;
  const activeQuizSelectedCount = activeQuizQuestion
    ? selected.filter(
        (idx) =>
          idx >= activeQuizQuestion.optionStart &&
          idx < activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
      ).length
    : 0;

  // 全問共通の制限時間でカウントダウン（管理者設定）。時間切れで送信不可・解答開示。
  const standardTimeLimit = isStandard ? meta.timeLimitSeconds || 0 : 0;
  const freeTextTimeLimit = isFreeText ? meta.timeLimitSeconds || 0 : 0;
  const quizTimeLimit = isQuiz ? meta.timeLimitSeconds || 0 : 0;
  const rankingTimeLimit = isRanking ? meta.timeLimitSeconds || 0 : 0;
  const hasStandardTimer = isStandard && standardTimeLimit > 0;
  const hasFreeTextTimer = isFreeText && freeTextTimeLimit > 0;
  const hasQuizTimer = isQuiz && quizTimeLimit > 0;
  const hasRankingTimer = isRanking && rankingTimeLimit > 0;
  const standardRemaining =
    hasStandardTimer && timerStartMs
      ? Math.max(0, Math.ceil(standardTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const freeTextRemaining =
    hasFreeTextTimer && timerStartMs
      ? Math.max(0, Math.ceil(freeTextTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const quizRemaining =
    hasQuizTimer && timerStartMs
      ? Math.max(0, Math.ceil(quizTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const rankingRemaining =
    hasRankingTimer && timerStartMs
      ? Math.max(0, Math.ceil(rankingTimeLimit - (now - timerStartMs) / 1000))
      : null;
  const standardNotStarted = isStandard && hasStandardTimer && !timerStartMs;
  const freeTextNotStarted = isFreeText && hasFreeTextTimer && !timerStartMs;
  // クイズ: 投票時間ありで未開始（スクリーン/資料投影の「回答開始」未押下）なら回答・送信不可。
  const quizNotStarted = isQuiz && hasQuizTimer && !timerStartMs;
  const standardExpired =
    hasStandardTimer && standardRemaining !== null && standardRemaining <= 0;
  const freeTextExpired =
    hasFreeTextTimer && freeTextRemaining !== null && freeTextRemaining <= 0;
  const quizExpired =
    hasQuizTimer && quizRemaining !== null && quizRemaining <= 0;
  const rankingNotStarted = hasRankingTimer && !timerStartMs;
  const rankingExpired = hasRankingTimer && rankingRemaining !== null && rankingRemaining <= 0;
  // 投票済み判定はサーバーの自票（cleared_at IS NULL）と「今この場で送信した」ローカル状態のみで行う。
  // localStorage の hasVoted は使わない: 投票時間なしの通常投票は started_at=null のため runKey が
  // `${id}:draft` で実施回が変わっても不変 → 過去回の投票フラグが残り続け、票がサーバーで消えていても
  // 「投票済み（＝結果表示）」のまま入力UIが出ず再投票できなくなる不具合の原因だった。
  // サーバーの自票が 0 なら未投票として入力UIを表示（リセット後・別実施回でも正しく投票可能）。
  const hasLiveOwnVote = ownVotes.length > 0;
  const effectiveHasVoted = isFreeText ? false : hasLocalSubmittedAnswer || hasLiveOwnVote;
  // 締切直後の「集計中」待機。締切間際に届いた在時間内の票と集計ポーリングが揃うのを待ってから開示し、
  // 未確定の件数（未回答ちらつき）を見せない。アクティブな時間制限モードの締切時刻 + 待機時間で判定。
  const activeTimedDeadlineMs =
    hasQuizTimer && timerStartMs
      ? timerStartMs + quizTimeLimit * 1000
      : hasStandardTimer && timerStartMs
      ? timerStartMs + standardTimeLimit * 1000
      : hasRankingTimer && timerStartMs
      ? timerStartMs + rankingTimeLimit * 1000
      : null;
  const anyTimedExpired = quizExpired || standardExpired || rankingExpired;
  // 自分が送信した全回答がサーバーから取得済みか。送信直後は自票の取得が間に合わず件数が不足するため、
  // 取得が揃う（serverOwnAnswerIndexes が送信件数に追いつく）まで「集計中」を延長して、
  // 回答数が不足したまま結果を開示してしまうのを防ぐ。
  const ownVotesFullyLoaded =
    !hasLocalSubmittedAnswer || serverOwnAnswerIndexes.length >= submittedAnswerIndexes.length;
  const aggregating =
    anyTimedExpired &&
    activeTimedDeadlineMs !== null &&
    (now < activeTimedDeadlineMs + POLL_AGGREGATION_SETTLE_MS ||
      // 自票が未取得なら、上限（MAX）まで集計中を継続して全回答が揃うのを待つ。
      (!ownVotesFullyLoaded && now < activeTimedDeadlineMs + POLL_AGGREGATION_MAX_SETTLE_MS));
  // 開示（結果・正解を表示）。タイマーありの場合は時間切れ＋集計中の待機が明けるまで開示しない
  // （ランキング・通常投票と同様、スクリーン／資料投影と同じタイミングで一括開示する）。
  // タイマーなしの場合のみ送信直後に開示する。
  const quizRevealed = isQuiz && (hasQuizTimer ? quizExpired && !aggregating : effectiveHasVoted);
  const rankingRevealed = isRanking && (hasRankingTimer ? rankingExpired && !aggregating : effectiveHasVoted);
  const standardRevealed = isStandard && (hasStandardTimer ? standardExpired && !aggregating : effectiveHasVoted);
  const showResults = isQuiz ? quizRevealed : isRanking ? rankingRevealed : standardRevealed;
  // 送信可能: 未送信 && 時間切れでない && 1問以上回答
  // 全問回答済みのときのみ送信可能（全ての設問を埋めないと「完了して送信」を押せない）。
  const allQuizAnswered = quizQuestions.length > 0 && answeredQuizCount === quizQuestions.length;
  const quizSubmittable =
    isQuiz && !effectiveHasVoted && !quizExpired && !quizNotStarted && allQuizAnswered;
  // 回答確認プレビューは 1 問でも回答したら表示（未回答の設問を把握できるように進捗表示する）。
  const showQuizReview =
    isQuiz && !effectiveHasVoted && !quizExpired && !quizNotStarted && answeredQuizCount > 0;
  const quizScore =
    isQuiz && effectiveHasVoted ? getQuizScore(quizQuestions, ownAnswerIndexes) : null;

  useEffect(() => {
    setSelected([]);
    setFreeTextAnswer('');
    setActiveQuizIndex(0);
    setImagePreview(null);
    setSubmittedRunKey(null);
    setSubmittedAnswerIndexes([]);
    setResponseOverrides({});
    setEditingResponseId(null);
    setEditingResponseText('');
    submittingRef.current = false;
    setSubmitting(false);
  }, [poll.id, poll.started_at]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePreview]);

  // タイマー稼働（未締切のときのみ）。クイズは送信後も時間切れまで動かし続ける必要がある
  // （時間切れで初めて結果を開示するため。送信時に止めると開示されない）。
  useEffect(() => {
    if (!hasStandardTimer && !hasFreeTextTimer && !hasQuizTimer && !hasRankingTimer) return;
    // 締切後も「集計中」の待機が明けるまではカウンタを動かし続ける（aggregating→開示の遷移に必要）。
    if ((quizExpired || rankingExpired || standardExpired || freeTextExpired) && !aggregating) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [
    hasStandardTimer,
    hasFreeTextTimer,
    hasQuizTimer,
    hasRankingTimer,
    isQuiz,
    effectiveHasVoted,
    quizExpired,
    rankingExpired,
    standardExpired,
    freeTextExpired,
    aggregating,
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
              ? '時間内に送信してください'
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
      {hasFreeTextTimer && !freeTextExpired && (
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
              ? '時間内に回答してください'
              : `${freeTextTimeLimit}秒で回答（開始待ち）`}
          </span>
          <span
            className={`tabular-nums text-base sm:text-lg font-extrabold ${
              timerStartMs ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            {timerStartMs ? '残り ' : ''}
            {Math.floor((freeTextRemaining ?? freeTextTimeLimit) / 60)}:
            {String(Math.floor((freeTextRemaining ?? freeTextTimeLimit) % 60)).padStart(2, '0')}
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
              ? '時間内に送信してください'
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
              ? '時間内に送信してください'
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
      {isQuiz && quizExpired && !aggregating && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          時間切れ — 解答を表示しています
        </div>
      )}
      {isRanking && rankingExpired && !aggregating && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          投票時間が終了しました
        </div>
      )}
      {isStandard && standardExpired && !aggregating && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          投票時間が終了しました
        </div>
      )}
      {isFreeText && freeTextExpired && !effectiveHasVoted && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs sm:text-sm font-bold text-rose-600 ring-1 ring-rose-200">
          <Clock className="h-3.5 w-3.5" />
          回答時間が終了しました
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

      {isFreeText ? (
        <div className="mt-4 space-y-3">
          {freeTextNotStarted ? (
            <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
              開始待ちです
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50/80 px-3 py-2.5 text-xs sm:text-sm text-emerald-800 ring-1 ring-emerald-200/70">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="leading-relaxed">
                  何度でも回答を送信できます。思いついたことを自由に投稿してください。
                </p>
              </div>
              <textarea
                value={freeTextAnswer}
                onChange={(e) => setFreeTextAnswer(e.target.value.slice(0, 80))}
                placeholder="短い回答を入力してください"
                disabled={freeTextExpired || submitting}
                className="min-h-[112px] w-full resize-y rounded-xl bg-slate-50 px-4 py-3 text-base font-medium leading-relaxed text-slate-800 ring-1 ring-slate-200 outline-none transition-colors focus:bg-white focus:ring-emerald-300 disabled:bg-slate-100 disabled:text-slate-400"
                style={{ fontSize: '16px' }}
              />
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-bold text-slate-600">カードの色</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {FREE_TEXT_CARD_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFreeTextColor(color)}
                      className={`h-11 rounded-xl text-xs font-bold outline-none ring-2 transition focus-visible:ring-offset-2 ${
                        FREE_TEXT_COLOR_CLASSES[color]
                      } ${freeTextColor === color ? FREE_TEXT_SELECTED_COLOR_CLASSES[color] : 'ring-transparent'}`}
                      aria-pressed={freeTextColor === color}
                    >
                      {FREE_TEXT_CARD_COLOR_LABELS[color]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                  <span>匿名で投稿</span>
                  <input
                    type="checkbox"
                    checked={freeTextAnonymous}
                    onChange={(e) => setFreeTextAnonymous(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600"
                  />
                </label>
                {!freeTextAnonymous && (
                  <div className="flex items-center gap-2 border-t border-slate-200 pt-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {(displayName.trim() || '匿').slice(0, 1)}
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 24))}
                      placeholder="表示名（空欄で匿名）"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                )}
              </div>
              {ownTextResponses.length > 0 && (
                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <p className="text-xs font-bold text-slate-500">
                    あなたの投稿（{ownTextResponses.length}件・編集／削除できます）
                  </p>
                  <div className="mt-2 space-y-2">
                    {ownTextResponses.map((vote) =>
                      editingResponseId === vote.id ? (
                        <div key={vote.id} className="rounded-lg bg-slate-50 p-2 ring-1 ring-emerald-200">
                          <textarea
                            value={editingResponseText}
                            onChange={(e) => setEditingResponseText(e.target.value.slice(0, 80))}
                            className="min-h-[60px] w-full resize-y rounded-md bg-white px-2 py-1.5 text-sm text-slate-800 ring-1 ring-slate-200 outline-none focus:ring-emerald-300"
                            style={{ fontSize: '16px' }}
                            autoFocus
                          />
                          <div className="mt-1.5 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingResponseId(null)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                            >
                              <X className="h-3.5 w-3.5" />
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => void saveResponseEdit(vote.id)}
                              disabled={!editingResponseText.trim()}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
                            >
                              <Check className="h-3.5 w-3.5" />
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={vote.id}
                          className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
                        >
                          <p className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-700">
                            {vote.value}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingResponseId(vote.id);
                              setEditingResponseText(vote.value || '');
                            }}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-emerald-600"
                            aria-label="回答を編集"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteResponse(vote.id)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="回答を削除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                  {freeTextAnswer.length}/80
                </span>
                <button
                  type="button"
                  onClick={() =>
                    submitAnswers([], freeTextAnswer, {
                      authorName: displayName,
                      isAnonymous: freeTextAnonymous,
                      color: freeTextColor,
                    })
                  }
                  disabled={!freeTextAnswer.trim() || freeTextExpired || submitting}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  回答を送信
                </button>
              </div>
            </>
          )}
        </div>
      ) : aggregating ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 px-4 py-10 text-center ring-1 ring-slate-200">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
          <p className="text-sm sm:text-base font-bold text-slate-700">回答を集計中です…</p>
          <p className="text-xs sm:text-sm text-slate-500">まもなく結果を表示します</p>
        </div>
      ) : showResults ? (
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
                      const ownIndexes = ownAnswerIndexes.filter(
                        (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
                      );
                      const optionOffsets = ownIndexes.map((idx) => idx - question.optionStart).sort((a, b) => a - b);
                      const correctOffsets = getQuizCorrectOptionOffsets(question);
                      const hasKey = correctOffsets.length > 0;
                      const isCorrect =
                        hasKey &&
                        optionOffsets.length === correctOffsets.length &&
                        correctOffsets.every((offset, index) => optionOffsets[index] === offset);
                      const answerText = ownIndexes
                        .map((ownIndex) => {
                          const optionOffset = ownIndex - question.optionStart;
                          return formatQuizAnswerLabel(options[ownIndex], optionOffset);
                        })
                        .join('、');
                      return (
                        <div key={question.id} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                          <span className="shrink-0 font-bold text-emerald-700">
                            問題 {question.questionNumber}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {answerText || '未回答'}
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
                const questionVotes = votes.filter((v) => Number(v.value) === questionIndex + 1);
                const questionTotal = new Set(questionVotes.map((v) => v.participant_id)).size;
                return (
                  <div key={question.id} className="space-y-2">
                    <p className="text-sm font-bold text-slate-800">
                      問題 {question.questionNumber} {question.question}
                    </p>
                    {question.questionImageUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          openImagePreview(
                            question.questionImageUrl || '',
                            `問題 ${question.questionNumber} の画像`
                          )
                        }
                        className="block w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 transition hover:ring-emerald-300"
                        title="画像を拡大表示"
                      >
                        <img
                          src={question.questionImageUrl}
                          alt={`問題 ${question.questionNumber} の画像`}
                          className="max-h-72 w-full rounded-xl object-contain"
                        />
                      </button>
                    )}
                    {options
                      .slice(question.optionStart, question.optionStart + question.optionCount)
                      .map((option, offset) => {
                        const i = question.optionStart + offset;
                        const count = counts[i];
                        const pct = questionTotal > 0 ? Math.round((count / questionTotal) * 100) : 0;
                        const imageUrl = getPollOptionImageUrl(option);
                        const correctOffsets = getQuizCorrectOptionOffsets(question);
                        const hasKey = correctOffsets.length > 0;
                        const isCorrect = hasKey && correctOffsets.includes(offset);
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
                                {imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openImagePreview(imageUrl, `解答 ${optionLetter(offset)} の画像`)
                                    }
                                    className="shrink-0 rounded-lg ring-1 ring-slate-200 transition hover:ring-emerald-300"
                                    title="画像を拡大表示"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`解答 ${optionLetter(offset)} の画像`}
                                      className="h-10 w-10 rounded-lg object-cover"
                                    />
                                  </button>
                                )}
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
                        {getPollOptionImageUrl(option) && (
                          <button
                            type="button"
                            onClick={() =>
                              openImagePreview(
                                getPollOptionImageUrl(option) || '',
                                `選択肢 ${i + 1} の画像`
                              )
                            }
                            className="shrink-0 rounded-lg ring-1 ring-slate-200 transition hover:ring-emerald-300"
                            title="画像を拡大表示"
                          >
                            <img
                              src={getPollOptionImageUrl(option)}
                              alt={`選択肢 ${i + 1} の画像`}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          </button>
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
            onClick={() => submitAnswers(rankingFilled)}
            disabled={rankingFilled.length !== maxSelections || rankingExpired || submitting}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                送信中
              </>
            ) : (
              <>
                ランキングを送信
                <span className="text-xs font-bold tabular-nums">
                  ({rankingFilled.length}/{maxSelections})
                </span>
              </>
            )}
          </button>
        </>
        )
      ) : isQuiz ? (
        quizNotStarted ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200">
            開始待ちです
          </div>
        ) : effectiveHasVoted && hasQuizTimer ? (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-4 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            回答を送信しました。結果は投票時間後に表示されます。
          </div>
        ) : (
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

            <AnimatePresence mode="wait">
              {activeQuizQuestion && (
                <motion.div
                  key={activeQuizQuestion.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 px-0.5"
                >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-emerald-700">
                          問題 {activeQuizQuestion.questionNumber}
                        </p>
                      </div>
                      <h4 className="mt-1 text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {activeQuizQuestion.question}
                      </h4>
                      {activeQuizQuestion.questionImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            openImagePreview(
                              activeQuizQuestion.questionImageUrl || '',
                              `問題 ${activeQuizQuestion.questionNumber} の画像`
                            )
                          }
                          className="mt-3 block w-full rounded-xl bg-white ring-1 ring-slate-200 transition hover:ring-emerald-300"
                          title="画像を拡大表示"
                        >
                          <img
                            src={activeQuizQuestion.questionImageUrl}
                            alt={`問題 ${activeQuizQuestion.questionNumber} の画像`}
                            className="max-h-72 w-full rounded-xl object-contain"
                          />
                        </button>
                      )}
                    </div>
                    {activeQuizAnswerLimit > 1 && (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        この問題は回答を{activeQuizAnswerLimit}つ選択してください
                        <span className="ml-1 tabular-nums">
                          （選択済み {activeQuizSelectedCount}/{activeQuizAnswerLimit}）
                        </span>
                      </p>
                    )}
                    {/* 参加者投票画面: 選択肢は1列表示 */}
                    <div className="space-y-2">
                      {options.slice(activeQuizQuestion.optionStart, activeQuizQuestion.optionStart + activeQuizQuestion.optionCount).map((option, offset) => {
                        const globalIndex = activeQuizQuestion.optionStart + offset;
                        const checked = selected.includes(globalIndex);
                        const imageUrl = getPollOptionImageUrl(option);
                        return (
                          <div
                            key={globalIndex}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelected((prev) => {
                                const outsideQuestion = prev.filter(
                                  (idx) => idx < activeQuizQuestion.optionStart || idx >= activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
                                );
                                const currentQuestion = prev.filter(
                                  (idx) => idx >= activeQuizQuestion.optionStart && idx < activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
                                );
                                if (activeQuizAnswerLimit <= 1) return [...outsideQuestion, globalIndex];
                                if (currentQuestion.includes(globalIndex)) {
                                  return [...outsideQuestion, ...currentQuestion.filter((idx) => idx !== globalIndex)];
                                }
                                if (currentQuestion.length >= activeQuizAnswerLimit) return prev;
                                return [...outsideQuestion, ...currentQuestion, globalIndex];
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              setSelected((prev) => {
                                const outsideQuestion = prev.filter(
                                  (idx) => idx < activeQuizQuestion.optionStart || idx >= activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
                                );
                                const currentQuestion = prev.filter(
                                  (idx) => idx >= activeQuizQuestion.optionStart && idx < activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
                                );
                                if (activeQuizAnswerLimit <= 1) return [...outsideQuestion, globalIndex];
                                if (currentQuestion.includes(globalIndex)) {
                                  return [...outsideQuestion, ...currentQuestion.filter((idx) => idx !== globalIndex)];
                                }
                                if (currentQuestion.length >= activeQuizAnswerLimit) return prev;
                                return [...outsideQuestion, ...currentQuestion, globalIndex];
                              });
                            }}
                            className={`w-full cursor-pointer text-left px-4 py-3 rounded-xl ring-1 transition-all active:scale-[0.99] ${
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
                            </span>
                            {imageUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImagePreview(imageUrl, `解答 ${optionLetter(offset)} の画像`);
                                }}
                                className="mt-3 flex w-full items-center gap-3 rounded-lg bg-white/80 p-2 text-left ring-1 ring-slate-200 transition hover:ring-emerald-300"
                                title="画像を拡大表示"
                              >
                                <img
                                  src={imageUrl}
                                  alt={`解答 ${optionLetter(offset)} の画像`}
                                  className="h-20 w-28 shrink-0 rounded-lg object-cover"
                                />
                                <span className="text-sm font-bold text-emerald-700">画像表示</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
          {showQuizReview && (
            <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
              <p className="text-xs font-bold text-emerald-700">回答確認</p>
              <div className="mt-2 space-y-1.5">
                {quizQuestions.map((question) => {
                  const answerIndexes = selected.filter(
                    (idx) => idx >= question.optionStart && idx < question.optionStart + question.optionCount
                  );
                  const answerText = answerIndexes
                    .map((answerIndex) => {
                      const optionOffset = answerIndex - question.optionStart;
                      return formatQuizAnswerLabel(options[answerIndex], optionOffset);
                    })
                    .join('、');
                  return (
                    <div key={question.id} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                      <span className="shrink-0 font-bold text-emerald-700">
                        問題 {question.questionNumber}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {answerText || '未回答'}
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
              if (!quizSubmittable || submitting) return;
              void submitAnswers(selected);
            }}
            disabled={!quizSubmittable || submitting}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                送信中
              </>
            ) : (
              <>
                {quizExpired
                  ? '時間切れ — 送信不可'
                  : allQuizAnswered
                  ? '完了して送信'
                  : '全問回答で送信できます'}
                <span className="text-xs font-bold tabular-nums">
                  ({answeredQuizCount}/{quizQuestions.length})
                </span>
              </>
            )}
          </button>
        </>
        )
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
                <div
                  key={i}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  onClick={() => {
                    if (!disabled) toggle(i);
                  }}
                  onKeyDown={(e) => {
                    if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
                    e.preventDefault();
                    toggle(i);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl ring-1 transition-all active:scale-[0.99] ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
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
                  </span>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openImagePreview(imageUrl, `選択肢 ${i + 1} の画像`);
                      }}
                      className="mt-3 flex w-full items-center gap-3 rounded-lg bg-white/80 p-2 text-left ring-1 ring-slate-200 transition hover:ring-emerald-300"
                      title="画像を拡大表示"
                    >
                      <img
                        src={imageUrl}
                        alt={`選択肢 ${i + 1} の画像`}
                        className="h-20 w-28 shrink-0 rounded-lg object-cover"
                      />
                      <span className="text-sm font-bold text-emerald-700">画像表示</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => submitAnswers(selected)}
            disabled={selected.length === 0 || standardNotStarted || standardExpired || submitting}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold h-11 rounded-xl text-sm sm:text-base transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                送信中
              </>
            ) : (
              <>
                {standardExpired ? '投票時間終了' : '投票する'}
                {isMulti && selected.length > 0 && (
                  <span className="text-xs font-bold tabular-nums">
                    ({selected.length}/{maxSelections})
                  </span>
                )}
              </>
            )}
          </button>
        </>
        )
      )}
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={imagePreview.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setImagePreview(null);
            }}
          >
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg ring-1 ring-white/40 hover:bg-white"
              aria-label="画像を閉じる"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              src={imagePreview.src}
              alt={imagePreview.alt}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="max-h-[92vh] max-w-[94vw] rounded-xl bg-white object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
