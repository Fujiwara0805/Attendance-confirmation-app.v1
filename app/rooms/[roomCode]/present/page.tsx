'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, BarChart3, ThumbsUp, Maximize, Minimize } from 'lucide-react';
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
      QRCode.toDataURL(joinUrl, { width: 160, margin: 1, color: { dark: '#ffffff', light: '#00000000' } }).then(setQrUrl);
    });
  }, [roomCode]);

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
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">読み込み中...</div>;
  }

  const topQuestions = questions
    .filter((q) => !q.is_answered)
    .slice(0, 8);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {/* QR Code for room participation */}
          {qrUrl && (
            <div className="shrink-0 bg-white/10 rounded-lg p-1.5">
              <img src={qrUrl} alt="参加QRコード" className="w-12 h-12" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{room.title}</h1>
            <p className="text-sm text-slate-400">
              参加コード: <span className="font-mono text-indigo-400">{room.code}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setView('qa')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'qa' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Q&A
            </button>
            <button
              onClick={() => setView('poll')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === 'poll' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              投票
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
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
                  <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-xl text-slate-500">質問を待っています...</p>
                  <p className="text-sm text-slate-600 mt-2">
                    参加者はコード <span className="font-mono text-indigo-400">{room.code}</span> で参加できます
                  </p>
                </div>
              ) : (
                topQuestions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-start gap-5 p-5 rounded-2xl ${
                      q.is_pinned ? 'bg-indigo-500/20 ring-1 ring-indigo-400/30' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <ThumbsUp className="w-5 h-5 text-indigo-400" />
                      <span className="text-lg font-bold text-indigo-300">{q.upvote_count}</span>
                    </div>
                    <div>
                      <p className="text-lg leading-relaxed">{q.text}</p>
                      <p className="text-sm text-slate-500 mt-1">{q.author_name}</p>
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
                    <span className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">Live</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-8">{activePoll.question}</h2>
                  <div className="bg-white/5 rounded-2xl p-8">
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
                  <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-xl text-slate-500">アクティブな投票はありません</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="px-8 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
        <span>ざせきくん Interactive</span>
        <span>参加コード: {room.code}</span>
      </footer>
    </div>
  );
}
