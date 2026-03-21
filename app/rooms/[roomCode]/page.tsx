'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart3, Send, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParticipantSession } from '@/lib/hooks/useParticipantSession';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls } from '@/lib/hooks/useRealtimePolls';
import QuestionCard from '../components/QuestionCard';
import PollResultsChart from '../components/PollResultsChart';
import { staggerContainer } from '@/lib/animations';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

type Tab = 'qa' | 'polls';

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
}

export default function ParticipantPage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();
  const { participantId, displayName, setDisplayName, isReady } = useParticipantSession();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('qa');

  // Q&A state
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [sending, setSending] = useState(false);
  const [votedQuestions, setVotedQuestions] = useState<Set<string>>(new Set());

  // Own questions tracking
  const [ownQuestionIds, setOwnQuestionIds] = useState<Set<string>>(new Set());

  // Poll state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
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

  // Realtime data
  const { questions, loading: qLoading, optimisticDelete } = useRealtimeQuestions(room?.id || null);
  const { activePoll, polls, pollVotes, loading: pLoading } = useRealtimePolls(room?.id || null);

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

  const handleSubmitQuestion = async () => {
    if (!questionText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText.trim(),
          authorName: isAnonymous ? 'Anonymous' : (displayName || 'Anonymous'),
          isAnonymous,
          participantId,
        }),
      });
      const created = await res.json();
      if (created?.id) {
        const newOwn = new Set(ownQuestionIds);
        newOwn.add(created.id);
        setOwnQuestionIds(newOwn);
        localStorage.setItem(`own_questions_${roomCode}`, JSON.stringify(Array.from(newOwn)));
      }
      setQuestionText('');
    } catch {
      // Silently fail — optimistic approach
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (questionId: string) => {
    if (!participantId) return;
    const newVoted = new Set(votedQuestions);
    if (newVoted.has(questionId)) {
      newVoted.delete(questionId);
    } else {
      newVoted.add(questionId);
    }
    setVotedQuestions(newVoted);
    localStorage.setItem(`voted_questions_${roomCode}`, JSON.stringify(Array.from(newVoted)));

    try {
      await fetch(`/api/rooms/${roomCode}/questions/${questionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
    } catch {
      // Revert on failure
      const reverted = new Set(votedQuestions);
      setVotedQuestions(reverted);
    }
  };

  const handleEditQuestion = async (questionId: string, newText: string) => {
    try {
      await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText, participantId }),
      });
    } catch {
      // Silently fail
    }
  };

  const handleDeleteOwnQuestion = async (questionId: string) => {
    try {
      // 楽観的削除: UIを即座に更新
      optimisticDelete(questionId);
      const newOwn = new Set(ownQuestionIds);
      newOwn.delete(questionId);
      setOwnQuestionIds(newOwn);
      localStorage.setItem(`own_questions_${roomCode}`, JSON.stringify(Array.from(newOwn)));
      // DB削除はバックグラウンドで実行
      await fetch(`/api/rooms/${roomCode}/questions/${questionId}?participantId=${participantId}`, {
        method: 'DELETE',
      });
    } catch {
      // Silently fail
    }
  };

  const handlePollVote = async (pollId: string, optionIndex: number) => {
    if (!participantId || hasVotedPoll.has(pollId)) return;
    setSelectedOption(optionIndex);
    const newVoted = new Set(hasVotedPoll);
    newVoted.add(pollId);
    setHasVotedPoll(newVoted);
    localStorage.setItem(`voted_polls_${roomCode}`, JSON.stringify(Array.from(newVoted)));

    try {
      await fetch(`/api/rooms/${roomCode}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, optionIndex }),
      });
    } catch {
      // Revert
      const reverted = new Set(hasVotedPoll);
      reverted.delete(pollId);
      setHasVotedPoll(reverted);
      setSelectedOption(null);
    }
  };

  if (roomLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-pulse text-slate-400">読み込み中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5">
        <p className="text-slate-500">ルームが見つかりませんでした</p>
        <Link href="/rooms" className="text-indigo-600 hover:underline text-sm">
          ルーム一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-2xl flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="" width={28} height={28} className="rounded-lg" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">{room.title}</h1>
              <p className="text-xs text-slate-400">Code: {room.code}</p>
            </div>
          </div>
          {room.status === 'closed' && (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg font-medium">終了</span>
          )}
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-2xl flex px-5">
          <button
            onClick={() => setTab('qa')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'qa'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Q&A
          </button>
          <button
            onClick={() => setTab('polls')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'polls'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            投票
            {activePoll && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-2xl px-5 py-5">
        {tab === 'qa' && (
          <div className="space-y-4">
            {/* Name input for non-anonymous */}
            {!isAnonymous && (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="表示名を入力"
                className="modern-input w-full text-sm"
              />
            )}

            {/* Question input */}
            {room.status === 'active' && (
              <div className="glass-card p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
                    placeholder="質問を入力..."
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    style={{ fontSize: '16px' }}
                  />
                  <button
                    onClick={handleSubmitQuestion}
                    disabled={!questionText.trim() || sending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 transition-all active:scale-95 disabled:opacity-40"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isAnonymous ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4 text-indigo-600" />}
                  {isAnonymous ? '匿名で投稿' : `${displayName || '名前を入力'} として投稿`}
                </button>
              </div>
            )}

            {/* Questions list */}
            {qLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : questions.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">まだ質問はありません。最初の質問を投稿しましょう!</p>
            ) : (
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                <AnimatePresence>
                  {questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      id={q.id}
                      text={q.text}
                      authorName={q.author_name}
                      upvoteCount={q.upvote_count}
                      isAnswered={q.is_answered}
                      isPinned={q.is_pinned}
                      createdAt={q.created_at}
                      hasVoted={votedQuestions.has(q.id)}
                      onVote={handleVote}
                      isOwn={ownQuestionIds.has(q.id)}
                      onEdit={handleEditQuestion}
                      onDeleteOwn={handleDeleteOwnQuestion}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}

        {tab === 'polls' && (
          <div className="space-y-5">
            {/* Active poll */}
            {activePoll && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">投票受付中</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">{activePoll.question}</h3>

                {hasVotedPoll.has(activePoll.id) ? (
                  <PollResultsChart
                    options={activePoll.options}
                    votes={pollVotes[activePoll.id] || []}
                    totalVotes={(pollVotes[activePoll.id] || []).length}
                  />
                ) : (
                  <div className="space-y-2">
                    {activePoll.options.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => handlePollVote(activePoll.id, i)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                          selectedOption === i
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-sm font-medium text-slate-700">{option}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
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
                    className="glass-card p-5"
                  >
                    <span className="text-xs text-slate-400 mb-1 block">終了済み</span>
                    <h3 className="text-base font-bold text-slate-900 mb-3">{poll.question}</h3>
                    <PollResultsChart
                      options={poll.options}
                      votes={pollVotes[poll.id] || []}
                      totalVotes={(pollVotes[poll.id] || []).length}
                    />
                  </motion.div>
                ))
            )}

            {!activePoll && polls.filter((p) => p.status === 'closed').length === 0 && !pLoading && (
              <p className="text-center text-sm text-slate-400 py-8">まだ投票はありません</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
