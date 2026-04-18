'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart3, ThumbsUp, Maximize, Minimize, X, Loader2 } from 'lucide-react';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls } from '@/lib/hooks/useRealtimePolls';
import PollResultsChart from '../../components/PollResultsChart';

type View = 'qa' | 'poll';

interface Room {
  id: string;
  title: string;
  code: string;
}

export default function PresentPage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();
  const containerRef = useRef<HTMLDivElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [view, setView] = useState<View>('qa');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<'join' | 'upload' | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!qrModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQrModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrModalOpen, closeQrModal]);

  const { questions } = useRealtimeQuestions(room?.id || null);
  const { activePoll, pollVotes } = useRealtimePolls(room?.id || null);

  // Auto-switch to poll when one becomes active
  useEffect(() => {
    if (activePoll) setView('poll');
  }, [activePoll]);

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

  const topQuestions = questions
    .filter((q) => !q.is_answered)
    .slice(0, 8);

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
        <div className="flex items-center gap-3">
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
              <BarChart3 className="w-4 h-4" />
              投票
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8 py-8">
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
              className="w-full max-w-3xl"
            >
              {activePoll ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs sm:text-sm font-semibold text-emerald-600 uppercase tracking-wide">Live</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-800 mb-8 leading-tight">{activePoll.question}</h2>
                  <div className="bg-white rounded-2xl p-8 shadow-sm ring-1 ring-black/5">
                    <PollResultsChart
                      options={activePoll.options}
                      votes={pollVotes[activePoll.id] || []}
                      totalVotes={(pollVotes[activePoll.id] || []).length}
                      large
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 shadow-sm mx-auto mb-5 flex items-center justify-center">
                    <BarChart3 className="w-11 h-11 text-indigo-300" />
                  </div>
                  <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-400">アクティブな投票はありません</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="px-8 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
        <span>ざせきくん Interactive</span>
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
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 sm:p-8 pt-16 sm:pt-20 bg-black/85 backdrop-blur-sm"
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
                  className="flex flex-col items-center gap-3 text-white"
                >
                  <Loader2 className="w-10 h-10 animate-spin text-white/90" aria-hidden />
                  <span className="text-sm text-white/80">QRを表示しています…</span>
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
            <p className="mt-4 text-sm text-white/80 text-center max-w-md">
              スマートフォンで読み取ってください
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
