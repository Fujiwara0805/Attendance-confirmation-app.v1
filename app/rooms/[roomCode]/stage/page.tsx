'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Loader2,
  Maximize,
  MessageSquare,
  MonitorUp,
  PauseCircle,
  Play,
  RefreshCw,
  ThumbsUp,
  WifiOff,
  X,
} from 'lucide-react';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls } from '@/lib/hooks/useRealtimePolls';
import { useCaptureStream } from '@/lib/captureStreamStore';

interface Room {
  id: string;
  title: string;
  code: string;
  status: string;
  moderation_enabled?: boolean;
}

export default function StagePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const stageRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [sharedPercent, setSharedPercent] = useState(70);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // MediaStream はモジュールスコープのシングルトン (captureStreamStore) で保持。
  // どんな再マウントが起きてもストリーム参照が消えないため、
  // stage <-> present の遷移で画面共有が確実に継続する。
  const {
    captureStream,
    captureSurface,
    captureError,
    startScreenShare,
    stopScreenShare,
  } = useCaptureStream();

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setRoom(data);
        setRoomLoading(false);
      })
      .catch(() => setRoomLoading(false));
  }, [roomCode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const joinUrl = `${window.location.origin}/rooms/${roomCode}`;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(joinUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then(setQrUrl);
    });
  }, [roomCode]);

  const { questions, connected: qConnected } = useRealtimeQuestions(room?.id || null);
  const { connected: pConnected } = useRealtimePolls(room?.id || null);

  const visibleQuestions = useMemo(() => {
    return questions
      .filter((q) => !q.is_answered && (q.status === undefined || q.status === 'approved'))
      .sort(
        (a, b) =>
          b.upvote_count - a.upvote_count ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 14);
  }, [questions]);

  const realtimeOffline = !qConnected && !pConnected;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  // stage を再マウントしたとき、ストア保持の既存 MediaStream を新しい video 要素に
  // アタッチし直す。Chrome では同じ MediaStream を別 video へ再アタッチすると
  // canplay/playing が発火しないことがあるため、
  //   1. 既存トラックから新しい MediaStream を生成（clone）して srcObject に渡す
  //   2. play() Promise / readyState ポーリング / セーフティタイマー の三段構え
  // で確実に再生開始まで持っていく。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!captureStream) {
      video.srcObject = null;
      setVideoReady(false);
      return;
    }

    let cancelled = false;
    let pollId: number | null = null;
    let safetyId: number | null = null;

    // 既存のトラックから別 MediaStream を作って渡す（参照の使い回しによる
    // 再アタッチ取りこぼしを回避）
    const tracks = captureStream.getTracks();
    const fresh = tracks.length > 0 ? new MediaStream(tracks) : captureStream;

    video.srcObject = null;
    video.srcObject = fresh;

    const markReady = () => {
      if (cancelled) return;
      setVideoReady(true);
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
      if (safetyId !== null) {
        window.clearTimeout(safetyId);
        safetyId = null;
      }
    };

    video
      .play()
      .then(() => {
        if (!cancelled && !video.paused) markReady();
      })
      .catch(() => {
        /* イベント or ポーリングのフォールバックに任せる */
      });

    pollId = window.setInterval(() => {
      if (cancelled) return;
      if (video.readyState >= 2 && !video.paused) markReady();
    }, 150);

    // ストリームが active ならいずれフレームは来るので、最終手段として 1.2 秒後に強制 ready
    safetyId = window.setTimeout(() => {
      if (cancelled) return;
      if (captureStream.active) markReady();
    }, 1200);

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      if (safetyId !== null) window.clearTimeout(safetyId);
    };
  }, [captureStream]);

  const enterFullscreen = () => {
    stageRef.current?.requestFullscreen?.();
  };

  // 画面共有は Layout の Context が保持しているため、遷移時に停止しない。
  // stage に戻ったときに同じ MediaStream を再アタッチして共有を継続する。
  const openClassicScreen = () => {
    router.push(`/rooms/${roomCode}/present`);
  };

  // 投票タブを選択した状態のスクリーン画面へ
  const openPollScreen = () => {
    router.push(`/rooms/${roomCode}/present?view=poll`);
  };

  useEffect(() => {
    if (!qrModalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrModalOpen]);

  const updateSharedPercent = useCallback((clientX: number) => {
    const rect = splitRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = Math.round((clientX / rect.width) * 100);
    setSharedPercent(Math.min(85, Math.max(55, next)));
  }, []);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
    updateSharedPercent(event.clientX);
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (event: PointerEvent) => updateSharedPercent(event.clientX);
    const onUp = () => setIsResizing(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isResizing, updateSharedPercent]);

  const layoutStyle = isDesktop
    ? {
        gridTemplateColumns: `minmax(0, ${sharedPercent}fr) 10px minmax(320px, ${100 - sharedPercent}fr)`,
      }
    : undefined;

  if (roomLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-sm">
        ルームが見つかりませんでした
      </div>
    );
  }

  return (
    <div ref={stageRef} className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div ref={splitRef} className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,7fr)_10px_minmax(340px,3fr)]" style={layoutStyle}>
        <main className="relative h-[55vh] min-h-0 lg:h-full bg-black flex items-center justify-center overflow-hidden">
          {captureStream ? (
            <>
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                controls={false}
                onLoadedMetadata={(event) => {
                  event.currentTarget.play().catch(() => {
                    /* ポーリングのフォールバックが拾う */
                  });
                }}
                onLoadedData={() => setVideoReady(true)}
                onCanPlay={() => setVideoReady(true)}
                onPlaying={() => setVideoReady(true)}
                /* onWaiting で false に戻すと、stage 再マウント直後の一瞬の
                   buffering で常時ローディングになるため、ここでは false にしない */
                className="absolute inset-0 h-full w-full object-contain bg-black"
              />
              {!videoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="rounded-2xl bg-white/10 px-5 py-4 text-center ring-1 ring-white/15 backdrop-blur-md">
                    <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-white/80" />
                    <p className="text-sm font-semibold text-white">共有映像を待っています</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">
                      黒いままの場合は、資料の発表画面を開いてから共有し直してください。
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    資料投影中
                  </div>
                  {captureSurface && (
                    <div className="hidden sm:inline-flex items-center rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md">
                      共有対象: {captureSurface === 'monitor' ? '画面全体' : captureSurface === 'window' ? 'ウィンドウ' : captureSurface}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={enterFullscreen}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-semibold text-slate-900 shadow-sm hover:bg-white"
                  >
                    <Maximize className="w-4 h-4" />
                    全画面
                  </button>
                  <button
                    type="button"
                    onClick={openClassicScreen}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-500 px-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-400"
                  >
                    <MonitorUp className="w-4 h-4" />
                    スクリーン画面
                  </button>
                  <button
                    type="button"
                    onClick={openPollScreen}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-white shadow-sm hover:bg-emerald-400"
                  >
                    <BarChart3 className="w-4 h-4" />
                    ライブ投票画面
                  </button>
                  <button
                    type="button"
                    onClick={startScreenShare}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-semibold text-slate-900 shadow-sm hover:bg-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                    取り込み直す
                  </button>
                  <button
                    type="button"
                    onClick={stopScreenShare}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-600"
                  >
                    <PauseCircle className="w-4 h-4" />
                    停止
                  </button>
                </div>
              </div>
              {captureSurface === 'window' && (
                <div className="absolute left-4 right-4 bottom-4 rounded-2xl bg-amber-400/95 px-5 py-4 text-slate-950 shadow-2xl ring-1 ring-amber-200">
                  <p className="text-sm font-extrabold">資料の編集画面が選択されている可能性があります</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed">
                    発表画面を映すには「共有し直す」を押し、Canva / Google Slides の発表タブ、または発表画面を表示している画面全体を選択してください。
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="w-full max-w-xl px-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <MonitorUp className="w-10 h-10 text-indigo-200" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                資料投影画面
              </h1>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
                Canva / Google Slides などのブラウザ資料ツールを発表モードにし、その資料画面だけをざせきくんに取り込みます。
              </p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-200">推奨手順</p>
                <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
                  <li>1. Canva / Google Slides などで発表モードを開く</li>
                  <li>2. 資料投影画面を、最終的にスクリーンへ出す画面として準備する</li>
                  <li>3. 「資料を取り込む」を押す</li>
                  <li>4. 共有対象は発表中の Chrome タブ、または発表画面を表示している画面全体を選ぶ</li>
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  編集画面のタブを選ぶと編集画面が映ります。取り込み後、資料投影画面を全画面にしてスクリーンへ表示します。
                </p>
              </div>
              <button
                type="button"
                onClick={startScreenShare}
                className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-400"
              >
                <Play className="w-4 h-4 fill-current" />
                資料を取り込む
              </button>
              <button
                type="button"
                onClick={openPollScreen}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white ring-1 ring-emerald-400 hover:bg-emerald-400"
              >
                <BarChart3 className="w-4 h-4" />
                ライブ投票画面を開く
              </button>
              {captureError && (
                <p className="mt-4 rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
                  {captureError}
                </p>
              )}
            </div>
          )}
        </main>

        <div
          role="separator"
          aria-label="資料投影画面とチャットの境界"
          aria-orientation="vertical"
          onPointerDown={startResize}
          className={`hidden lg:flex cursor-col-resize items-center justify-center bg-slate-900 transition-colors ${
            isResizing ? 'bg-indigo-600' : 'hover:bg-indigo-500'
          }`}
        >
          <div className="h-16 w-1 rounded-full bg-white/50" />
        </div>

        <aside className="h-[45vh] min-h-0 overflow-hidden border-l border-slate-800 bg-slate-50 text-slate-900 flex flex-col lg:h-full">
          <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">資料投影画面</p>
                <h2 className="mt-1 truncate text-lg font-extrabold tracking-tight text-slate-950">{room.title}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  参加コード <span className="font-mono font-bold tracking-widest text-indigo-600">{room.code}</span>
                </p>
              </div>
              {qrUrl && (
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title="QRコードを拡大"
                >
                  <img src={qrUrl} alt="参加QRコード" className="h-16 w-16" />
                </button>
              )}
            </div>
            {realtimeOffline && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <WifiOff className="w-3.5 h-3.5" />
                再接続中
              </div>
            )}
            <button
              type="button"
              onClick={openClassicScreen}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <MonitorUp className="w-4 h-4" />
              スクリーン画面へ
            </button>
            <p className="mt-3 hidden text-xs leading-relaxed text-slate-500 lg:block">
              資料投影画面とチャットの境界をドラッグして横幅を調整できます。
            </p>
          </header>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="inline-flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-extrabold tracking-tight text-slate-900">質問チャット</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">{visibleQuestions.length}</span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {visibleQuestions.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                    <BarChart3 className="w-7 h-7 text-indigo-200" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">質問を待っています</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    参加者の質問はここにチャット形式で表示されます。
                  </p>
                </div>
              ) : (
                visibleQuestions.map((question, index) => (
                  <motion.article
                    key={question.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.2) }}
                    className={`rounded-2xl border p-3 shadow-sm ${
                      question.is_pinned ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-500">
                        {question.author_name === 'Anonymous' ? '匿名' : question.author_name}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-indigo-600 tabular-nums">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {question.upvote_count}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-slate-900">
                      {question.text}
                    </p>
                    {question.is_pinned && (
                      <span className="mt-2 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        固定
                      </span>
                    )}
                  </motion.article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
      {qrModalOpen && qrUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="参加QRコード"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-white/85 p-6 backdrop-blur-3xl"
          onClick={() => setQrModalOpen(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setQrModalOpen(false);
            }}
            className="fixed right-5 top-5 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-900 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
            閉じる
          </button>
          <div
            className="rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <img src={qrUrl} alt="参加QRコード（拡大）" className="h-[min(70vmin,520px)] w-[min(70vmin,520px)]" />
          </div>
        </div>
      )}
    </div>
  );
}
