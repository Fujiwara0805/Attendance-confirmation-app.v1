'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type DragEvent } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Trees, ThumbsUp, Maximize, Minimize, X, Loader2, WifiOff, MonitorUp, ChevronLeft, ChevronRight, Clock, Play } from 'lucide-react';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import {
  extractPollPayload,
  FREE_TEXT_CARD_COLORS,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getRankingDisplayMode,
  normalizeFreeTextGroups,
  optionLetter,
  type FreeTextCardColor,
} from '@/lib/pollModes';
import RankingResults from '../../components/RankingResults';

type View = 'qa' | 'poll';

const FREE_TEXT_CARD_CLASSES: Record<FreeTextCardColor, string> = {
  yellow: 'border-yellow-200 bg-yellow-100 text-yellow-950 shadow-yellow-100/70',
  green: 'border-emerald-200 bg-emerald-100 text-emerald-950 shadow-emerald-100/70',
  blue: 'border-blue-200 bg-blue-100 text-blue-950 shadow-blue-100/70',
  orange: 'border-orange-200 bg-orange-100 text-orange-950 shadow-orange-100/70',
};

function getFreeTextCardColor(value?: string | null): FreeTextCardColor {
  if (value === 'purple') return 'blue';
  if (value === 'pink') return 'orange';
  return FREE_TEXT_CARD_COLORS.includes(value as FreeTextCardColor) ? (value as FreeTextCardColor) : 'orange';
}

interface Room {
  id: string;
  title: string;
  code: string;
}

export default function PresentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = (params.roomCode as string).toUpperCase();
  const containerRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  // 初期 view は ?view=poll で投票タブを直接開く
  const [view, setView] = useState<View>(
    searchParams?.get('view') === 'poll' ? 'poll' : 'qa'
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<'join' | 'upload' | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  // 全問共通の制限時間をカウントダウン（開始時刻は poll.started_at = 開始ボタンを押した端末時刻）
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => { if (data.id) setRoom(data); });
  }, [roomCode]);

  // Generate QR code for room participation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const joinUrl = `${window.location.origin}/rooms/${roomCode}`;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(joinUrl, { width: 160, margin: 1, color: { dark: '#334155', light: '#00000000' } }).then(setQrUrl);
    });
  }, [roomCode]);

  const closeQrModal = useCallback(() => {
    setQrModalOpen(false);
    setQrModalMode(null);
    setModalQrUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const openJoinQrModal = useCallback(() => {
    setModalQrUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    setQrModalMode('join');
    setQrModalOpen(true);
  }, []);

  // モーダル（参加URL生成）: 画面いっぱいに収まる解像度でQRを生成
  useEffect(() => {
    if (!qrModalOpen || qrModalMode !== 'join' || typeof window === 'undefined') return;
    const joinUrl = `${window.location.origin}/rooms/${roomCode}`;
    const size = Math.min(window.innerWidth, window.innerHeight, 900);
    // 表示は約 vmin の 45% 相当に合わせ、生成解像度も同スケール（従来比 2 段階ほど小さく）
    const pixelSize = Math.max(160, Math.floor(size * 0.45));
    let cancelled = false;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(joinUrl, {
        width: pixelSize,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then((url) => {
        if (!cancelled) setModalQrUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [qrModalOpen, qrModalMode, roomCode]);

  const openQrModalFromUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setModalQrUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    const blobUrl = URL.createObjectURL(file);
    setModalQrUrl(blobUrl);
    setQrModalMode('upload');
    setQrModalOpen(true);
  }, []);

  const openImagePreview = useCallback((src: string, alt: string) => {
    setImagePreview({ src, alt });
  }, []);

  useEffect(() => {
    if (!qrModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQrModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrModalOpen, closeQrModal]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imagePreview]);

  const { questions, connected: qConnected } = useRealtimeQuestions(room?.id || null);
  const { activePolls: rawActivePolls, pollVotes, connected: pConnected } = useRealtimePolls(room?.id || null);
  // bulkOrder（一斉開始時の選択順）優先で並べ替え。未設定は created_at の新しい順を維持。
  const activePolls = useMemo<Poll[]>(() => {
    return [...rawActivePolls].sort((a: Poll, b: Poll) => {
      const am = extractPollPayload(a.options).meta.bulkOrder;
      const bm = extractPollPayload(b.options).meta.bulkOrder;
      const aHas = typeof am === 'number';
      const bHas = typeof bm === 'number';
      if (aHas && bHas) return (am as number) - (bm as number);
      if (aHas) return -1;
      if (bHas) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rawActivePolls]);
  const activePollIds = activePolls.map((poll) => poll.id).join(',');
  // ブレスト形式が含まれる場合は付箋ボードを画面右端（資料投影画面ボタンの下）まで広げる。
  const hasFreeTextPoll = activePolls.some(
    (poll) => getPollMode(extractPollPayload(poll.options).meta.mode) === 'free_text'
  );

  useEffect(() => {
    setActiveQuizIndex(0);
  }, [activePollIds]);

  // タイマー再描画（0.5 秒間隔）
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // 出題タイマーを開始ボタンを押した端末時刻で開始（present の「開始」ボタン）。
  // realtime UPDATE が他端末（参加者・他の投影）にも propagate する。
  const [startingTimer, setStartingTimer] = useState(false);
  const startPollTimer = useCallback(async (pollId: string) => {
    if (!pollId || startingTimer) return;
    setStartingTimer(true);
    try {
      await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTimer: true,
          clientStartedAt: new Date().toISOString(),
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
    } catch (e) {
      console.error('start timer failed', e);
    } finally {
      setStartingTimer(false);
    }
  }, [roomCode, startingTimer]);

  const updateFreeTextResponse = useCallback(
    async (
      pollId: string,
      voteId: string,
      patch: {
        displayX?: number | null;
        displayY?: number | null;
        groupLabel?: string | null;
        pinned?: boolean;
      }
    ) => {
      const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}/responses/${voteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update free text response');
    },
    [roomCode]
  );

  const updateFreeTextGroups = useCallback(
    async (poll: Poll, groups: string[]) => {
      const { meta, options } = extractPollPayload(poll.options);
      const normalizedGroups = normalizeFreeTextGroups(groups);
      const res = await fetch(`/api/rooms/${roomCode}/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: poll.question,
          options,
          maxSelections: poll.max_selections ?? 1,
          allowMultiple: poll.allow_multiple,
          mode: 'free_text',
          meta: { ...meta, mode: 'free_text', freeTextGroups: normalizedGroups },
        }),
      });
      if (!res.ok) throw new Error('Failed to update free text groups');
    },
    [roomCode]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (!room) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm sm:text-base text-gray-400">読み込み中...</div>;
  }

  // モデレーション対応: pending / rejected はプレゼン投影から除外
  const topQuestions = questions
    .filter(
      (q) =>
        !q.is_answered &&
        (q.status === undefined || q.status === 'approved')
    )
    .sort(
      (a, b) =>
        b.upvote_count - a.upvote_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 8);

  const realtimeOffline = !qConnected && !pConnected;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 text-gray-800 flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 sticky top-0 z-40 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {/* QR Code for room participation */}
          {qrUrl && (
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={openJoinQrModal}
                className="bg-gray-100 rounded-lg p-1.5 cursor-pointer ring-offset-2 hover:ring-2 hover:ring-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                title="タップでQRを拡大表示"
              >
                <img src={qrUrl} alt="参加QRコード" className="w-12 h-12 pointer-events-none" />
              </motion.button>
              <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
                画像をアップ
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) openQrModalFromUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-800">{room.title}</h1>
            <p className="text-sm sm:text-base text-gray-500">
              参加コード: <span className="font-mono text-indigo-600 font-semibold tracking-wider">{room.code}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* `<a>` だとフルページ遷移になり、ルーム共通の Layout（CaptureStreamProvider）が
              再マウントされて画面共有ストリームが破棄される。クライアント遷移する Link を使う。 */}
          <Link
            href={`/rooms/${roomCode}/stage`}
            className="inline-flex h-10 min-w-[160px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 hover:text-white"
            title="資料投影画面へ切り替え"
            aria-label="資料投影画面へ切り替え"
          >
            <MonitorUp className="w-4 h-4" />
            資料投影画面
          </Link>
          <div className="flex bg-gray-100 rounded-xl p-1 ring-1 ring-black/5">
            <button
              onClick={() => setView('qa')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all ${
                view === 'qa' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Q&A
            </button>
            <button
              onClick={() => setView('poll')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all ${
                view === 'poll' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/50' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Trees className="w-4 h-4" />
              ワークスペース
            </button>
          </div>
          {realtimeOffline && (
            <span
              title="接続が不安定なためポーリングモードで動作中"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full"
            >
              <WifiOff className="w-3.5 h-3.5" />
              再接続中
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-8 pt-4 pb-8">
        <AnimatePresence mode="wait">
          {view === 'qa' && (
            <motion.div
              key="qa"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full max-w-4xl space-y-4"
            >
              {topQuestions.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 shadow-sm mx-auto mb-5 flex items-center justify-center">
                    <MessageSquare className="w-11 h-11 text-indigo-300" />
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-400">質問を待っています...</p>
                  <p className="text-sm sm:text-base text-gray-400 mt-2 leading-relaxed">
                    参加者はコード <span className="font-mono text-indigo-600 font-semibold tracking-wider">{room.code}</span> で参加できます
                  </p>
                </div>
              ) : (
                topQuestions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-5 p-5 rounded-2xl shadow-sm ring-1 ${
                      q.is_pinned ? 'bg-indigo-50 ring-indigo-200' : 'bg-white ring-black/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <ThumbsUp className="w-5 h-5 text-indigo-500" />
                      <span className="text-lg sm:text-xl font-extrabold tracking-tight text-indigo-600 tabular-nums">{q.upvote_count}</span>
                    </div>
                    <div>
                      <p className="text-base sm:text-lg leading-relaxed text-gray-800">{q.text}</p>
                      <p className="text-xs sm:text-sm text-gray-400 mt-1">
                        {q.author_name === 'Anonymous' ? '匿名' : q.author_name}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {view === 'poll' && (
            <motion.div
              key="poll"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={hasFreeTextPoll ? 'w-full max-w-none' : 'w-full max-w-5xl'}
            >
              {activePolls.length > 0 ? (
                <div className="w-full space-y-6">
                  {activePolls.map((activePoll: Poll) => (
                    <section
                      key={activePoll.id}
                      className={`${
                        activePolls.length > 1
                          ? 'rounded-xl bg-white/85 p-5 shadow-sm ring-1 ring-[#e9e7e7]'
                          : ''
                      }`}
                    >
                      {(() => {
                  const { meta, options } = extractPollPayload(activePoll.options);
                  const mode = getPollMode(meta.mode);
                  const votes = pollVotes[activePoll.id] || [];
                  const counts = options.map(
                    (_, i) => votes.filter((v) => v.option_index === i).length
                  );
                  const totalCast = counts.reduce((s, c) => s + c, 0);
                  const totalRespondents =
                    mode === 'free_text'
                      ? votes.filter((v) => !!v.value).length
                      : mode === 'ranking'
                      ? new Set(votes.map((v) => v.participant_id)).size
                      : totalCast;
                  const maxSelections = Math.max(1, Number(activePoll.max_selections ?? 1));
                  const quizQuestions = mode === 'quiz' ? getQuizQuestions(meta, options) : [];
                  // 制限時間をカウントダウン。回答中は集計を伏せ、時間切れで開示。
                  const standardTimeLimit = mode === 'standard' ? meta.timeLimitSeconds || 0 : 0;
                  const quizTimeLimit = mode === 'quiz' ? meta.timeLimitSeconds || 0 : 0;
                  const rankingTimeLimit = mode === 'ranking' ? meta.timeLimitSeconds || 0 : 0;
                  const freeTextTimeLimit = mode === 'free_text' ? meta.timeLimitSeconds || 0 : 0;
                  const activeTimeLimit =
                    mode === 'standard'
                      ? standardTimeLimit
                      : mode === 'quiz'
                      ? quizTimeLimit
                      : mode === 'free_text'
                      ? freeTextTimeLimit
                      : rankingTimeLimit;
                  // poll.started_at（投影画面の開始ボタンを押した端末時刻）を全端末で共有
                  const timerStartMs = activePoll.started_at ? new Date(activePoll.started_at).getTime() : null;
                  const timerRemaining =
                    activeTimeLimit > 0 && timerStartMs
                      ? Math.max(0, Math.ceil(activeTimeLimit - (nowMs - timerStartMs) / 1000))
                      : null;
                  // 未開始（started_at 未セット） / 回答中 / 開示 の 3 状態
                  const timedMode = activeTimeLimit > 0;
                  const requiresManualStart = timedMode;
                  const timerNotStarted = requiresManualStart && !timerStartMs;
                  const standardRevealed =
                    mode === 'standard' &&
                    (standardTimeLimit === 0 ||
                      (!!timerStartMs && timerRemaining !== null && timerRemaining <= 0));
                  const standardAnswering =
                    mode === 'standard' && standardTimeLimit > 0 && !!timerStartMs && !standardRevealed;
                  const quizRevealed =
                    mode === 'quiz' &&
                    !timerNotStarted &&
                    (quizTimeLimit === 0 || (timerRemaining !== null && timerRemaining <= 0));
                  const quizAnswering =
                    mode === 'quiz' && quizTimeLimit > 0 && !!timerStartMs && !quizRevealed;
                  const rankingRevealed =
                    mode === 'ranking' &&
                    (rankingTimeLimit === 0 || (!!timerStartMs && timerRemaining !== null && timerRemaining <= 0));
                  const rankingAnswering =
                    mode === 'ranking' && rankingTimeLimit > 0 && !!timerStartMs && !rankingRevealed;
                  const fmtTime = (s: number) =>
                    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
                  return (
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs sm:text-sm font-semibold text-emerald-600 uppercase tracking-wide">Live</span>
                        </div>
                        <span className="text-sm sm:text-base text-slate-500 tabular-nums">
                          回答数: <span className="font-semibold text-slate-700">{totalRespondents}</span>
                        </span>
                      </div>
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                        <h2 className="min-w-0 flex-1 text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-800 leading-tight">{activePoll.question}</h2>
                        {requiresManualStart && (
                          /* タイマー＆コンパクトページャー＆開始ボタンをタイトルと同じ行の右端に */
                          <div
                            className={`ml-auto inline-flex flex-wrap items-center gap-2 rounded-xl ${
                              quizAnswering || rankingAnswering || standardAnswering
                                ? 'bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2'
                                : timerNotStarted
                                ? ''
                                : 'bg-slate-50 ring-1 ring-slate-200 px-3 py-2'
                            }`}
                          >
                            {mode === 'quiz' && (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">
                              <button
                                type="button"
                                onClick={() => setActiveQuizIndex((i) => Math.max(0, i - 1))}
                                disabled={activeQuizIndex === 0}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                                aria-label="前の問題"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span className="px-1 text-xs font-bold tabular-nums text-emerald-700">
                                問題 {activeQuizIndex + 1} / {quizQuestions.length}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveQuizIndex((i) => Math.min(quizQuestions.length - 1, i + 1))}
                                disabled={activeQuizIndex >= quizQuestions.length - 1}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                                aria-label="次の問題"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                              <div className="ml-1 flex items-center gap-1">
                                {quizQuestions.map((question, i) => (
                                  <button
                                    key={question.id}
                                    type="button"
                                    onClick={() => setActiveQuizIndex(i)}
                                    className={`h-1.5 rounded-full transition-all ${
                                      i === activeQuizIndex ? 'w-4 bg-emerald-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                                    }`}
                                    aria-label={`問題 ${i + 1} を表示`}
                                  />
                                ))}
                              </div>
                            </div>
                            )}
                            {timerNotStarted ? (
                              <button
                                type="button"
                                onClick={() => startPollTimer(activePoll.id)}
                                disabled={startingTimer}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-extrabold text-white shadow-sm ring-1 ring-emerald-600 transition-colors hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {startingTimer ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                                {activeTimeLimit > 0 ? `開始（${fmtTime(activeTimeLimit)}）` : '開始'}
                              </button>
                            ) : (
                              activeTimeLimit > 0 ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className={`h-4 w-4 ${quizAnswering || rankingAnswering || standardAnswering ? 'text-emerald-600' : 'text-slate-400'}`} />
                                  <span
                                    className={`tabular-nums font-extrabold leading-none ${
                                      quizAnswering || rankingAnswering || standardAnswering ? 'text-2xl sm:text-3xl text-emerald-600' : 'text-lg sm:text-xl text-slate-400'
                                    }`}
                                  >
                                    {quizAnswering || rankingAnswering || standardAnswering ? fmtTime(timerRemaining ?? activeTimeLimit) : '0:00'}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                                  開始済み
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                      {mode === 'free_text' ? (
                        <FreeTextBoard
                          poll={activePoll}
                          votes={votes}
                          groups={meta.freeTextGroups}
                          timerNotStarted={timerNotStarted}
                          onUpdate={(voteId, patch) => updateFreeTextResponse(activePoll.id, voteId, patch)}
                          onUpdateGroups={(groups) => updateFreeTextGroups(activePoll, groups)}
                        />
                      ) : mode === 'quiz' ? (
                        <div className="flex flex-col gap-5">
                          {quizAnswering && (
                            <p className="text-sm sm:text-base font-semibold text-slate-500">
                              回答受付中です。スマートフォンから解答してください（正解・集計は締切後に表示します）
                            </p>
                          )}
                          {timerNotStarted && (
                            <p className="text-sm sm:text-base font-semibold text-slate-500">
                              全{quizQuestions.length}問を{quizTimeLimit}秒で回答する形式です。準備ができたら右上の「開始」を押してください。
                            </p>
                          )}
                          {/* 縦は visible に（カード高さが伸びても切れない）／横だけクリップしてスワイプ */}
                          <div className="overflow-x-hidden overflow-y-visible">
                            <div
                              className="flex transition-transform duration-300 ease-out"
                              style={{ transform: `translateX(-${activeQuizIndex * 100}%)` }}
                            >
                              {quizQuestions.map((question, questionIndex) => {
                                const questionVotes = votes.filter((v) => Number(v.value) === questionIndex + 1);
                                const questionTotal = new Set(questionVotes.map((v) => v.participant_id)).size;
                                const correctOffsets = getQuizCorrectOptionOffsets(question);
                                const hasKey = correctOffsets.length > 0;
                                const votesByParticipant = new Map<string, number[]>();
                                questionVotes.forEach((vote) => {
                                  if (typeof vote.option_index !== 'number') return;
                                  const offset = vote.option_index - question.optionStart;
                                  if (offset < 0 || offset >= question.optionCount) return;
                                  const list = votesByParticipant.get(vote.participant_id) || [];
                                  list.push(offset);
                                  votesByParticipant.set(vote.participant_id, list);
                                });
                                const correctCount = hasKey
                                  ? Array.from(votesByParticipant.values()).filter((offsets) => {
                                      const sortedOffsets = offsets.sort((a, b) => a - b);
                                      return (
                                        sortedOffsets.length === correctOffsets.length &&
                                        correctOffsets.every((offset, index) => sortedOffsets[index] === offset)
                                      );
                                    }).length
                                  : 0;
                                const correctRate =
                                  hasKey && questionTotal > 0 ? Math.round((correctCount / questionTotal) * 100) : 0;
                                return (
                                <div key={question.id} className="flex w-full shrink-0 flex-col gap-8 px-2 pb-2">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-base font-bold text-emerald-700">
                                        問題 {question.questionNumber}
                                      </p>
                                      {quizRevealed && hasKey && (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
                                          正答率 {correctRate}%（{correctCount}/{questionTotal}）
                                        </span>
                                      )}
                                    </div>
                                    <h3 className="mt-2 text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 leading-snug">{question.question}</h3>
                                    {question.questionImageUrl && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openImagePreview(
                                            question.questionImageUrl || '',
                                            `問題 ${question.questionNumber} の画像`
                                          )
                                        }
                                        className="mt-4 block w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 transition hover:ring-emerald-300"
                                        title="画像を拡大表示"
                                      >
                                        <img
                                          src={question.questionImageUrl}
                                          alt={`問題 ${question.questionNumber} の画像`}
                                          className="max-h-[42vh] w-full rounded-2xl object-contain"
                                        />
                                      </button>
                                    )}
                                  </div>
                                  {/* 選択肢グリッド: 上下左右に間隔をとって見切れ防止＋中央寄せ */}
                                  <div className="mx-auto grid w-[94%] grid-cols-2 gap-4 p-2 sm:w-[92%]">
                                    {options.slice(question.optionStart, question.optionStart + question.optionCount).map((option, offset) => {
                                      const i = question.optionStart + offset;
                                      const count = counts[i];
                                      const pct = questionTotal > 0 ? Math.round((count / questionTotal) * 100) : 0;
                                      const imageUrl = getPollOptionImageUrl(option);
                                      const isCorrect = quizRevealed && hasKey && correctOffsets.includes(offset);
                                      return (
                                        <div
                                          key={i}
                                          className={`relative flex min-h-[120px] flex-col rounded-2xl bg-white shadow-sm ring-1 ${
                                            isCorrect ? 'ring-2 ring-emerald-400' : 'ring-slate-200'
                                          }`}
                                        >
                                          {/* 進捗バーは別レイヤーでクリップ（カード本体は overflow-visible にして文字が見切れないように） */}
                                          {quizRevealed && (
                                            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
                                              <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                                                className="absolute bottom-0 left-0 top-0 bg-emerald-100/80"
                                              />
                                            </div>
                                          )}
                                          <div className="relative flex flex-1 flex-col gap-2 px-5 py-4">
                                            <span className="flex items-start gap-3 text-base text-slate-800 sm:text-lg lg:text-xl">
                                              <span className="shrink-0 font-bold text-emerald-700">{optionLetter(offset)}</span>
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
                                                    className="h-14 w-14 rounded-lg object-cover"
                                                  />
                                                </button>
                                              )}
                                              <span className="min-w-0 break-words leading-snug">{getPollOptionLabel(option, `解答 ${optionLetter(offset)}`)}</span>
                                            </span>
                                            {quizRevealed && (
                                              <span className="mt-auto flex items-center gap-3">
                                                {isCorrect && (
                                                  <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">
                                                    正解
                                                  </span>
                                                )}
                                                <span className="ml-auto shrink-0 tabular-nums text-base font-semibold text-slate-600 sm:text-lg">
                                                  {count} ({pct}%)
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : mode === 'ranking' ? (
                        rankingRevealed ? (
                        <RankingResults
                          options={options}
                          votes={votes}
                          rankCount={maxSelections}
                          weights={meta.rankingWeights}
                          displayMode={getRankingDisplayMode(meta.rankingDisplayMode)}
                          size="large"
                        />
                        ) : (
                          <p className="rounded-2xl bg-slate-50 px-5 py-8 text-center text-base font-semibold text-slate-500 ring-1 ring-slate-200">
                            {timerNotStarted
                              ? `投票時間は${rankingTimeLimit}秒です。準備ができたら右上の「開始」を押してください。`
                              : '回答受付中です。ランキングは投票時間後に表示します。'}
                          </p>
                        )
	                      ) : (
                        standardRevealed ? (
	                      <div className="space-y-3">
                        {options.map((option, i) => {
                          const count = counts[i];
                          const pct = totalCast > 0 ? Math.round((count / totalCast) * 100) : 0;
                          const imageUrl = getPollOptionImageUrl(option);
                          return (
                            <div
                              key={i}
                              className="relative overflow-hidden rounded-xl ring-1 ring-slate-200 bg-white min-h-[88px]"
                            >
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="absolute left-0 top-0 bottom-0 bg-emerald-100/80"
                                aria-hidden
                              />
                              <div className="relative flex items-center justify-between gap-3 px-5 py-4">
                                <span className="flex items-center gap-3 min-w-0 text-lg sm:text-xl lg:text-2xl text-slate-800">
                                  <span className="text-emerald-700 font-semibold">
                                    {i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`}
                                  </span>
                                  {imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => openImagePreview(imageUrl, `選択肢 ${i + 1} の画像`)}
                                      className="shrink-0 rounded-lg ring-1 ring-slate-200 transition hover:ring-emerald-300"
                                      title="画像を拡大表示"
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={`選択肢 ${i + 1} の画像`}
                                        className="h-14 w-14 rounded-lg object-cover"
                                      />
                                    </button>
                                  )}
                                  <span className="truncate">{getPollOptionLabel(option, `選択肢 ${i + 1}`)}</span>
                                </span>
                                <span className="text-base sm:text-lg text-slate-600 tabular-nums shrink-0 font-semibold">
                                  {count} ({pct}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
	                      </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="rounded-2xl bg-slate-50 px-5 py-4 text-center text-base font-semibold text-slate-500 ring-1 ring-slate-200">
                              {timerNotStarted
                                ? `投票時間は${standardTimeLimit}秒です。ホスト側の開始を待っています。`
                                : standardTimeLimit > 0
                                ? '回答受付中です。結果は投票時間後に表示します。'
                                : '回答受付中です。選択肢は参加者画面にも表示されています。'}
                            </p>
                            {options.map((option, i) => {
                              const imageUrl = getPollOptionImageUrl(option);
                              return (
                                <div
                                  key={i}
                                  className="rounded-xl bg-white min-h-[88px] ring-1 ring-slate-200 shadow-sm"
                                >
                                  <div className="flex items-center gap-3 px-5 py-4">
                                    <span className="shrink-0 text-lg sm:text-xl lg:text-2xl text-emerald-700 font-semibold">
                                      {i < 20 ? String.fromCharCode(0x2460 + i) : `(${i + 1})`}
                                    </span>
                                    {imageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => openImagePreview(imageUrl, `選択肢 ${i + 1} の画像`)}
                                        className="shrink-0 rounded-lg ring-1 ring-slate-200 transition hover:ring-emerald-300"
                                        title="画像を拡大表示"
                                      >
                                        <img
                                          src={imageUrl}
                                          alt={`選択肢 ${i + 1} の画像`}
                                          className="h-14 w-14 rounded-lg object-cover"
                                        />
                                      </button>
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-lg sm:text-xl lg:text-2xl text-slate-800">
                                      {getPollOptionLabel(option, `選択肢 ${i + 1}`)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
	                      )}
                    </div>
                  );
                      })()}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 shadow-sm mx-auto mb-5 flex items-center justify-center">
                    <Trees className="w-11 h-11 text-indigo-300" />
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-400">アクティブなカードはありません</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="px-8 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
        <span>ざせきくん ワークスペース</span>
        <span>参加コード: {room.code}</span>
      </footer>

      <AnimatePresence>
        {qrModalOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="参加QRコード"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8 pt-16 sm:pt-20 bg-white/85 backdrop-blur-3xl"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeQrModal();
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeQrModal();
              }}
              className="fixed top-3 right-3 sm:top-5 sm:right-5 z-[110] flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white text-gray-900 shadow-lg border border-gray-200 hover:bg-gray-50 active:bg-gray-100 font-medium text-sm"
              aria-label="閉じる"
            >
              <X className="w-5 h-5 shrink-0" aria-hidden />
              閉じる
            </button>
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative flex items-center justify-center w-full flex-1 min-h-0"
            >
              {!modalQrUrl && qrModalMode === 'join' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3 text-slate-700"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-slate-500" aria-hidden />
                  <span className="text-sm text-slate-500">QRを表示しています…</span>
                </motion.div>
              )}
              {modalQrUrl && (
                <motion.img
                  layout
                  src={modalQrUrl}
                  alt={qrModalMode === 'upload' ? 'アップロードしたQR画像' : '参加用QRコード（拡大）'}
                  className="max-w-[min(100%,45vmin)] max-h-[min(100%,45vmin)] w-auto h-auto object-contain rounded-xl shadow-2xl bg-white p-3 sm:p-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                />
              )}
            </motion.div>
            <p className="mt-4 text-sm text-slate-500 text-center max-w-md">
              スマートフォンで読み取ってください
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {imagePreview && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={imagePreview.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92 p-4 sm:p-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) setImagePreview(null);
            }}
          >
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="fixed right-4 top-4 z-[130] inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg ring-1 ring-white/40 hover:bg-slate-50"
              aria-label="画像を閉じる"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.img
              src={imagePreview.src}
              alt={imagePreview.alt}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="max-h-[92vh] max-w-[94vw] rounded-2xl bg-white object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FreeTextBoard({
  poll,
  votes,
  groups,
  timerNotStarted,
  onUpdate,
  onUpdateGroups,
}: {
  poll: Poll;
  votes: PollVote[];
  groups?: string[];
  timerNotStarted: boolean;
  onUpdate: (
    voteId: string,
    patch: {
      displayX?: number | null;
      displayY?: number | null;
      groupLabel?: string | null;
      pinned?: boolean;
    }
  ) => void | Promise<void>;
  onUpdateGroups: (groups: string[]) => void | Promise<void>;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingVoteId, setDraggingVoteId] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string>>({});
  const [addingGroup, setAddingGroup] = useState('');
  const [groupAction, setGroupAction] = useState<'add' | `delete:${number}` | null>(null);
  const [optimistic, setOptimistic] = useState<
    Record<
      string,
      {
        display_x?: number | null;
        display_y?: number | null;
        group_label?: string | null;
      }
    >
  >({});

  const groupLabels = useMemo(() => normalizeFreeTextGroups(groups), [groups]);
  useEffect(() => {
    const rawGroups = groups || [];
    if (rawGroups.length === groupLabels.length && rawGroups.every((group, index) => group === groupLabels[index])) {
      return;
    }
    void onUpdateGroups(groupLabels);
  }, [groupLabels, groups, onUpdateGroups]);
  const responses = votes
    .filter((vote) => !!vote.value)
    .map((vote) => ({ ...vote, ...(optimistic[vote.id] || {}) }))
    .sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const grouped = groupLabels.map((label) => ({
    label,
    responses: responses.filter((vote) => vote.group_label === label),
  }));
  const canvasResponses = responses.filter(
    (vote) => !vote.group_label || !groupLabels.includes(vote.group_label)
  );

  const saveGroups = async (nextGroups: string[]) => {
    const normalized = normalizeFreeTextGroups(nextGroups);
    try {
      await onUpdateGroups(normalized);
    } catch (error) {
      console.error('free text groups update failed', error);
    }
  };

  const renameGroup = async (index: number, nextLabel: string) => {
    const currentLabel = groupLabels[index];
    const trimmed = nextLabel.trim().slice(0, 40);
    if (!trimmed || trimmed === currentLabel) return;
    const nextGroups = groupLabels.map((group, i) => (i === index ? trimmed : group));
    await saveGroups(nextGroups);
    await Promise.all(
      responses
        .filter((vote) => vote.group_label === currentLabel)
        .map((vote) => saveLayout(vote.id, { displayX: null, displayY: null, groupLabel: trimmed }))
    );
  };

  const addGroup = async () => {
    const trimmed = addingGroup.trim().slice(0, 40);
    if (!trimmed || groupLabels.includes(trimmed)) return;
    setGroupAction('add');
    try {
      await saveGroups([...groupLabels, trimmed]);
      setAddingGroup('');
    } finally {
      setGroupAction(null);
    }
  };

  const removeGroup = async (index: number) => {
    const target = groupLabels[index];
    if (!target) return;
    setGroupAction(`delete:${index}`);
    try {
      await Promise.all(
        responses
          .filter((vote) => vote.group_label === target)
          .map((vote) => saveLayout(vote.id, { displayX: null, displayY: null, groupLabel: null }))
      );
      await saveGroups(groupLabels.filter((_, i) => i !== index));
    } finally {
      setGroupAction(null);
    }
  };

  const saveLayout = async (
    voteId: string,
    patch: {
      displayX?: number | null;
      displayY?: number | null;
      groupLabel?: string | null;
      pinned?: boolean;
    }
  ) => {
    setOptimistic((prev) => ({
      ...prev,
      [voteId]: {
        ...prev[voteId],
        ...(patch.displayX !== undefined ? { display_x: patch.displayX } : {}),
        ...(patch.displayY !== undefined ? { display_y: patch.displayY } : {}),
        ...(patch.groupLabel !== undefined ? { group_label: patch.groupLabel } : {}),
      },
    }));
    try {
      await onUpdate(voteId, patch);
    } catch (error) {
      console.error('free text layout update failed', error);
    }
  };

  const onDropCanvas = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const voteId = event.dataTransfer.getData('text/plain');
    if (!voteId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const displayX = ((event.clientX - rect.left) / rect.width) * 100;
    const displayY = ((event.clientY - rect.top) / rect.height) * 100;
    void saveLayout(voteId, { displayX, displayY, groupLabel: null });
    setDraggingVoteId(null);
  };

  const onDropGroup = (label: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const voteId = event.dataTransfer.getData('text/plain');
    if (!voteId) return;
    void saveLayout(voteId, { displayX: null, displayY: null, groupLabel: label });
    setDraggingVoteId(null);
  };

  const card = (vote: PollVote, compact = false) => (
    <div
      key={vote.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', vote.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingVoteId(vote.id);
      }}
      onDragEnd={() => setDraggingVoteId(null)}
      className={`rounded-xl border shadow-sm transition ${
        compact ? 'p-3 text-sm' : 'min-h-[104px] p-4 text-base sm:text-lg'
      } cursor-grab active:cursor-grabbing hover:brightness-[0.98] ${
        FREE_TEXT_CARD_CLASSES[getFreeTextCardColor(vote.response_color)]
      } ${draggingVoteId === vote.id ? 'opacity-45' : 'opacity-100'}`}
    >
      <p className="break-words font-bold leading-snug text-slate-800">{vote.value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {vote.response_author_name && (
          <span className="rounded-md bg-white/55 px-2 py-1 text-[11px] font-bold text-slate-600">
            {vote.response_author_name}
          </span>
        )}
        {vote.group_label && (
          <button
            type="button"
            onClick={() => void saveLayout(vote.id, { displayX: null, displayY: null, groupLabel: null })}
            className="rounded-md bg-white/70 px-2 py-1 text-[11px] font-bold text-orange-700 hover:bg-white"
          >
            未分類へ
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">
          {timerNotStarted
            ? '開始ボタンを押すとブレストの受付が始まります。'
            : '回答は付箋カードとしてリアルタイムに表示されます。カードはそのままドラッグできます。'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div
          ref={boardRef}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={onDropCanvas}
          className="relative min-h-[60vh] h-[calc(100vh-220px)] overflow-y-auto rounded-2xl bg-white p-5 ring-1 ring-slate-200"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:48px_48px]" />
          <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {canvasResponses
              .filter((vote) => typeof vote.display_x !== 'number' || typeof vote.display_y !== 'number')
              .map((vote) => card(vote, true))}
          </div>
          {canvasResponses
            .filter((vote) => typeof vote.display_x === 'number' && typeof vote.display_y === 'number')
            .map((vote) => (
              <div
                key={vote.id}
                className="absolute w-44 -translate-x-1/2 -translate-y-1/2 sm:w-52"
                style={{ left: `${vote.display_x}%`, top: `${vote.display_y}%` }}
              >
                {card(vote, true)}
              </div>
            ))}
          {responses.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="rounded-xl bg-slate-50 px-5 py-4 text-base font-bold text-slate-400 ring-1 ring-slate-200">
                回答を待っています...
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-3 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm font-extrabold text-slate-800">回答を分類する</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              分類グループを作り、左の回答カードをここへドラッグすると仕分けできます。
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={addingGroup}
                onChange={(event) => setAddingGroup(event.target.value)}
                placeholder="分類を追加"
                className="h-9 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 text-sm font-semibold ring-1 ring-slate-200 outline-none focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={() => void addGroup()}
                disabled={!addingGroup.trim() || groupAction === 'add'}
                className="inline-flex h-9 min-w-[84px] items-center justify-center rounded-lg bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {groupAction === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : '追加'}
              </button>
            </div>
          </div>
          {grouped.map((group, groupIndex) => (
            <div
              key={group.label}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => onDropGroup(group.label, event)}
              className="min-h-[112px] rounded-xl bg-white p-3 ring-1 ring-slate-200"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <input
                  value={groupDrafts[groupIndex] ?? group.label}
                  onChange={(event) =>
                    setGroupDrafts((prev) => ({ ...prev, [groupIndex]: event.target.value }))
                  }
                  onBlur={(event) => void renameGroup(groupIndex, event.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-slate-50 px-2 py-1 text-sm font-extrabold text-slate-800 ring-1 ring-transparent outline-none focus:ring-orange-300"
                />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-500">
                  {group.responses.length}件
                </span>
                <button
                  type="button"
                  onClick={() => void removeGroup(groupIndex)}
                  disabled={groupAction === `delete:${groupIndex}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`分類 ${group.label} を削除`}
                  title="分類を削除"
                >
                  {groupAction === `delete:${groupIndex}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                {group.responses.map((vote) => card(vote, true))}
                {group.responses.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs font-bold text-slate-400">
                    ここへドロップ
                  </p>
                )}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
