'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, BarChart3, Plus, QrCode, Copy, Check,
  Download, ExternalLink, StopCircle, Trash2, Monitor,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll } from '@/lib/hooks/useRealtimePolls';
import { createBrowserClient } from '@/lib/supabase';
import QuestionCard from '../../components/QuestionCard';
import PollResultsChart from '../../components/PollResultsChart';
import { staggerContainer } from '@/lib/animations';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
  host_id: string;
}

type HostTab = 'questions' | 'polls' | 'export';

export default function HostPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HostTab>('questions');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  // Poll creation
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  // Export
  const [exportData, setExportData] = useState<{ stats?: Record<string, number>; topQuestions?: Array<{ text: string; upvote_count: number }> } | null>(null);

  // Fetch room
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setRoom(data); setLoading(false); })
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
  const { questions, loading: qLoading } = useRealtimeQuestions(room?.id || null);
  const { polls, pollVotes, activePoll, loading: pLoading } = useRealtimePolls(room?.id || null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleQuestion = useCallback(async (questionId: string, field: 'is_answered' | 'is_pinned') => {
    const supabase = createBrowserClient();
    const q = questions.find((q) => q.id === questionId);
    if (!q) return;
    await supabase.from('questions').update({ [field]: !q[field] }).eq('id', questionId);
  }, [questions]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    const supabase = createBrowserClient();
    await supabase.from('questions').delete().eq('id', questionId);
  }, []);

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
        }),
      });
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowCreatePoll(false);
    } catch { /* ignore */ } finally {
      setCreatingPoll(false);
    }
  };

  const handlePollStatus = async (pollId: string, status: string) => {
    await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  const handleDeletePoll = async (pollId: string) => {
    await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
      method: 'DELETE',
    });
  };

  const handleToggleRoomStatus = async () => {
    const newStatus = room?.status === 'active' ? 'closed' : 'active';
    await fetch(`/api/rooms/${roomCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setRoom((prev) => prev ? { ...prev, status: newStatus } : null);
  };

  const handleExportCSV = (type: 'questions' | 'polls') => {
    window.open(`/api/rooms/${roomCode}/export?type=${type}&format=csv`, '_blank');
  };

  // Fetch summary for export tab
  useEffect(() => {
    if (tab === 'export' && !exportData) {
      fetch(`/api/rooms/${roomCode}/export?type=summary`)
        .then((r) => r.json())
        .then(setExportData)
        .catch(() => {});
    }
  }, [tab, exportData, roomCode]);

  // Auth check
  if (authStatus === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">読み込み中...</div>;
  }
  if (!session || !room || room.host_id !== session.user?.email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">このルームへのアクセス権がありません</p>
        <Link href="/rooms" className="text-indigo-600 hover:underline text-sm">戻る</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--surface))]">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="" width={28} height={28} className="rounded-lg" />
            <div>
              <h1 className="text-sm font-bold text-slate-900">{room.title}</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">{room.code}</span>
                <button onClick={handleCopyCode} className="text-slate-400 hover:text-slate-600">
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-slate-600 hover:bg-slate-700 active:bg-slate-800 px-4 py-2.5 sm:px-3 sm:py-2 rounded-lg transition-colors"
            >
              戻る
            </Link>
            {qrUrl && (
              <a
                href={qrUrl}
                download={`qr-${roomCode}.png`}
                className="flex items-center justify-center text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-2 rounded-lg transition-colors"
                title="QRコードをダウンロード"
              >
                <QrCode className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
              </a>
            )}
            <Link
              href={`/rooms/${roomCode}/present`}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" />
              プレゼン
            </Link>
            <button
              type="button"
              onClick={handleToggleRoomStatus}
              className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 sm:px-3 sm:py-2 rounded-lg transition-colors ${
                room.status === 'active'
                  ? 'text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200'
                  : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200'
              }`}
            >
              {room.status === 'active' ? (
                <>
                  <StopCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  終了
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  再開
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share bar */}
        <div className="mx-auto max-w-5xl px-5 py-2 flex items-center gap-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-slate-400">参加URL:</span>
            <code className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              {typeof window !== 'undefined' ? `${window.location.origin}/rooms/${roomCode}` : ''}
            </code>
          </div>
          {qrUrl && (
            <a href={qrUrl} download={`qr-${roomCode}.png`} className="text-slate-400 hover:text-slate-600">
              <QrCode className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl flex px-5">
          {(['questions', 'polls', 'export'] as HostTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'questions' && <><MessageSquare className="w-4 h-4" />Q&A ({questions.length})</>}
              {t === 'polls' && <><BarChart3 className="w-4 h-4" />投票 ({polls.length})</>}
              {t === 'export' && <><Download className="w-4 h-4" />エクスポート</>}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-5xl px-5 py-5">
        {/* Questions Tab */}
        {tab === 'questions' && (
          qLoading ? (
            <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
          ) : questions.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">まだ質問はありません</p>
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
                    hasVoted={false}
                    onVote={() => {}}
                    isHost
                    onToggleAnswered={(id) => handleToggleQuestion(id, 'is_answered')}
                    onTogglePinned={(id) => handleToggleQuestion(id, 'is_pinned')}
                    onDelete={handleDeleteQuestion}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )
        )}

        {/* Polls Tab */}
        {tab === 'polls' && (
          <div className="space-y-5">
            {room.status === 'active' && (
              <button
                onClick={() => setShowCreatePoll(!showCreatePoll)}
                className="modern-button-primary rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                新しい投票を作成
              </button>
            )}

            {/* Create poll form */}
            <AnimatePresence>
              {showCreatePoll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass-card p-5 space-y-3"
                >
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="質問文（例: 今日の授業の理解度は？）"
                    className="modern-input w-full"
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
                        className="modern-input flex-1"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 8 && (
                    <button
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      + 選択肢を追加
                    </button>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleCreatePoll}
                      disabled={creatingPoll || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                      className="modern-button-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-40"
                    >
                      {creatingPoll ? '作成中...' : '作成'}
                    </button>
                    <button
                      onClick={() => setShowCreatePoll(false)}
                      className="modern-button-secondary rounded-xl px-4 py-2.5 text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Poll list */}
            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : (
              polls.map((poll) => (
                <div key={poll.id} className="glass-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        poll.status === 'active' ? 'text-emerald-600' : poll.status === 'draft' ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {poll.status === 'active' ? '受付中' : poll.status === 'draft' ? '下書き' : '終了'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{poll.question}</h3>
                    </div>
                    <div className="flex gap-1.5 sm:gap-1">
                      {poll.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handlePollStatus(poll.id, 'active')}
                          className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:bg-emerald-200 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg transition-colors"
                        >
                          開始
                        </button>
                      )}
                      {poll.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handlePollStatus(poll.id, 'closed')}
                          className="text-xs bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg transition-colors"
                        >
                          終了
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePoll(poll.id)}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                        削除
                      </button>
                    </div>
                  </div>
                  <PollResultsChart
                    options={poll.options}
                    votes={pollVotes[poll.id] || []}
                    totalVotes={(pollVotes[poll.id] || []).length}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Export Tab */}
        {tab === 'export' && (
          <div className="space-y-5">
            {/* Summary */}
            {exportData?.stats && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">ルームサマリー</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: '質問数', value: exportData.stats.totalQuestions },
                    { label: '投票数', value: exportData.stats.totalPolls },
                    { label: '総いいね', value: exportData.stats.totalUpvotes },
                    { label: '参加者数', value: exportData.stats.uniqueParticipants },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-2xl font-extrabold text-gradient">{s.value ?? 0}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top questions */}
            {exportData?.topQuestions && exportData.topQuestions.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-base font-bold text-slate-900 mb-3">人気の質問 TOP5</h3>
                <div className="space-y-2">
                  {exportData.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-indigo-600 font-bold w-6">{q.upvote_count}</span>
                      <span className="text-slate-700">{q.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download buttons */}
            <div className="glass-card p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">データダウンロード</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleExportCSV('questions')}
                  className="modern-button-secondary rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Q&Aデータ (CSV)
                </button>
                <button
                  onClick={() => handleExportCSV('polls')}
                  className="modern-button-secondary rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  投票結果 (CSV)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
