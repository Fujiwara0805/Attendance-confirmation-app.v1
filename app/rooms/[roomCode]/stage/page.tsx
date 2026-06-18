'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent as ReactChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Hand,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FileSpreadsheet,
  Loader2,
  Maximize,
  MessageSquare,
  MonitorUp,
  PauseCircle,
  Pencil,
  Play,
  Presentation,
  RefreshCw,
  Save,
  StopCircle,
  ThumbsUp,
  Trees,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import { captureStreamStore, useCaptureStream } from '@/lib/captureStreamStore';
import {
  extractPollPayload,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getRankingDisplayMode,
  optionLetter,
  POLL_AGGREGATION_SETTLE_MS,
} from '@/lib/pollModes';
import {
  parseProjectionDocument,
  isEditableProjection,
  buildEditedProjectionBlob,
  type ProjectionDocument,
  type ProjectionSheetChart,
  type ProjectionSheetObject,
  type ProjectionSheet,
  type ProjectionSlide,
  type ProjectionSlideElement,
  type ProjectionWordDocument,
} from '@/lib/projectionDocument';
import { createBrowserClient } from '@/lib/supabase';
import RankingResults from '../../components/RankingResults';
import PdfProjection from './PdfProjection';

interface Room {
  id: string;
  title: string;
  code: string;
  status: string;
  moderation_enabled?: boolean;
}

// File System Access API（Chrome/Edge）の最小型。元ファイルへの上書き保存に使う。
interface EditableFileHandle {
  getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}

interface FileSystemAccessWindow {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<EditableFileHandle[]>;
}

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// 上書き非対応ブラウザ向けのダウンロード保存。
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StagePage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();
  const stageRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const vSplitRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 上書き保存用: 取り込んだ元ファイルのハンドル / バイト列 / パース直後の複製。
  const fileHandleRef = useRef<EditableFileHandle | null>(null);
  const originalBufferRef = useRef<ArrayBuffer | null>(null);
  const originalDocRef = useRef<ProjectionDocument | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [projectionDocument, setProjectionDocument] = useState<ProjectionDocument | null>(null);
  const [fileImportError, setFileImportError] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  // pptx は Gotenberg で PDF 化して pdf.js で正確表示する。projectionDocument(クライアント解析)とは排他。
  const [projectionPdfUrl, setProjectionPdfUrl] = useState<string | null>(null);
  const [projectionPdfName, setProjectionPdfName] = useState('');
  const [convertingPptx, setConvertingPptx] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [sharedPercent, setSharedPercent] = useState(70);
  const [workspacePercent, setWorkspacePercent] = useState(45);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isVResizing, setIsVResizing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [startingPollId, setStartingPollId] = useState<string | null>(null);
  const [closingPollId, setClosingPollId] = useState<string | null>(null);

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
  const { activePolls: rawActivePolls, pollVotes, connected: pConnected } = useRealtimePolls(room?.id || null);
  // bulkOrder（一斉開始時の選択順）優先で並べ替え。未設定は created_at の作成順（古い順＝1問目が先頭）。
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
  const hasActiveWorkspaceCard = activePolls.length > 0;

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  // 共有映像用の video DOM は captureStreamStore 側で保持し、stage 表示中だけ
  // このコンテナへ移動する。ページ遷移で video 要素を破棄しないことで、Chrome の
  // MediaStream 再アタッチ黒画面を避ける。
  useBrowserLayoutEffect(() => {
    if (roomLoading || !room) {
      return;
    }

    if (!captureStream) {
      setVideoReady(false);
      return;
    }

    const videoHost = videoHostRef.current;
    if (!videoHost) return;

    const video = captureStreamStore.mountVideo(videoHost);
    if (!video) return;

    let cancelled = false;
    let pollId: number | null = null;
    let safetyId: number | null = null;

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

    const onReady = () => markReady();
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onReady);

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

    // 最終手段: ストリーム状態に関わらず一定時間後に loading を解除する。
    // video DOM 自体を維持しているので通常すぐにフレームが届くはずだが、
    // イベントを取りこぼした場合に備える。
    safetyId = window.setTimeout(() => {
      if (cancelled) return;
      markReady();
    }, 800);

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onReady);
      if (pollId !== null) window.clearInterval(pollId);
      if (safetyId !== null) window.clearTimeout(safetyId);
      captureStreamStore.parkVideo();
    };
  }, [captureStream, roomLoading, room]);

  const enterFullscreen = () => {
    stageRef.current?.requestFullscreen?.();
  };

  // 画面共有は captureStreamStore が保持しているため、遷移時に停止しない。
  // present へ移る前に video DOM を退避し、stage に戻ったら同じ DOM を表示へ戻す。
  const openClassicScreen = () => {
    captureStreamStore.parkVideo();
    router.push(`/rooms/${roomCode}/present`);
  };

  // 投票タブを選択した状態のスクリーン画面へ
  const openPollScreen = () => {
    captureStreamStore.parkVideo();
    router.push(`/rooms/${roomCode}/present?view=poll`);
  };

  const resetEditState = () => {
    setEditMode(false);
    setConfirmSaveOpen(false);
    setSaveMessage(null);
    fileHandleRef.current = null;
    originalBufferRef.current = null;
    originalDocRef.current = null;
  };

  const startScreenCapture = () => {
    setProjectionDocument(null);
    setProjectionPdfUrl(null);
    setFileImportError(null);
    resetEditState();
    startScreenShare();
  };

  // File System Access API があれば書き込み可能なハンドルを得て上書き保存に備える。
  // 非対応ブラウザは従来の隠し input にフォールバック（ハンドル無し→ダウンロード保存）。
  const openFilePicker = async () => {
    const picker = (window as unknown as FileSystemAccessWindow).showOpenFilePicker;
    if (typeof picker !== 'function') {
      fileInputRef.current?.click();
      return;
    }

    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: '資料ファイル',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
              'text/csv': ['.csv'],
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ],
      });
      const file = await handle.getFile();
      await importProjectionFile(file, handle);
    } catch (error) {
      // ユーザーがキャンセルした場合（AbortError）は黙って終了。
      if ((error as { name?: string })?.name !== 'AbortError') {
        setFileImportError('ファイルを開けませんでした。');
      }
    }
  };

  const clearProjectionDocument = () => {
    setProjectionDocument(null);
    setProjectionPdfUrl(null);
    setFileImportError(null);
    setActiveSheetIndex(0);
    setActiveSlideIndex(0);
    resetEditState();
  };

  // pptx をサーバー(Gotenberg)で PDF 化して取得する。成功すれば true（pdf.js で正確表示）。
  // 変換未設定/失敗時は false を返し、呼び出し側でクライアント解析にフォールバックする。
  const importPptxViaServer = async (file: File): Promise<boolean> => {
    try {
      const signRes = await fetch(`/api/rooms/${roomCode}/projection/sign-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name }),
      });
      if (!signRes.ok) return false;
      const { path, token } = await signRes.json();

      const supabase = createBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from('projection-files')
        .uploadToSignedUrl(path, token, file);
      if (uploadError) return false;

      const convertRes = await fetch(`/api/rooms/${roomCode}/projection/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!convertRes.ok) return false; // 503(未設定)含む → フォールバック
      const { pdfUrl } = await convertRes.json();
      if (!pdfUrl) return false;

      setProjectionPdfUrl(pdfUrl);
      return true;
    } catch {
      return false;
    }
  };

  const importProjectionFile = async (file: File, handle: EditableFileHandle | null) => {
    if (importingFile) return;

    setImportingFile(true);
    setFileImportError(null);
    setSaveMessage(null);

    const extension = file.name.split('.').pop()?.toLowerCase();

    try {
      // pptx はまずサーバー変換(PowerPointと同一見た目)を試す。
      if (extension === 'pptx') {
        setConvertingPptx(true);
        stopScreenShare();
        setProjectionDocument(null);
        resetEditState();
        const handled = await importPptxViaServer(file);
        setConvertingPptx(false);
        if (handled) {
          setProjectionPdfName(file.name);
          setVideoReady(false);
          return;
        }
        // 変換できなければ既存のクライアント解析にフォールバックする。
      }

      const buffer = await file.arrayBuffer();
      const parsed = await parseProjectionDocument(file);
      stopScreenShare();
      setProjectionPdfUrl(null);
      setProjectionDocument(parsed);
      // 編集可能ファイルのみ、保存時の差分元としてパース直後の状態と元バイト列を保持する。
      originalDocRef.current = isEditableProjection(parsed) ? structuredClone(parsed) : null;
      originalBufferRef.current = buffer;
      fileHandleRef.current = handle;
      setEditMode(false);
      setActiveSheetIndex(0);
      setActiveSlideIndex(0);
      setVideoReady(false);
    } catch (error) {
      setFileImportError(error instanceof Error ? error.message : '資料ファイルを取り込めませんでした。');
    } finally {
      setImportingFile(false);
      setConvertingPptx(false);
    }
  };

  const handleProjectionFileChange = async (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await importProjectionFile(file, null);
  };

  const handleEditCell = useCallback((sheetIndex: number, rowIndex: number, colIndex: number, value: string) => {
    setProjectionDocument((current) => {
      if (!current || current.kind !== 'spreadsheet') return current;
      const sheet = current.sheets[sheetIndex];
      if (!sheet || sheet.rows[rowIndex]?.[colIndex] === value) return current;
      const sheets = current.sheets.map((item, index) => {
        if (index !== sheetIndex) return item;
        const rows = item.rows.map((row, ri) =>
          ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
        );
        return { ...item, rows };
      });
      return { ...current, sheets };
    });
  }, []);

  const handleEditBlock = useCallback((blockId: string, text: string) => {
    setProjectionDocument((current) => {
      if (!current || current.kind !== 'word') return current;
      const blocks = current.blocks.map((block) =>
        block.id === blockId && block.type === 'paragraph' ? { ...block, text } : block
      );
      return { ...current, blocks };
    });
  }, []);

  const performSave = async () => {
    setConfirmSaveOpen(false);
    const buffer = originalBufferRef.current;
    if (!projectionDocument || !buffer || saving) return;

    setSaving(true);
    setSaveMessage(null);
    setFileImportError(null);

    try {
      const baseline = originalDocRef.current ?? projectionDocument;
      const blob = await buildEditedProjectionBlob(projectionDocument, baseline, buffer);
      const handle = fileHandleRef.current;

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setSaveMessage('元のファイルに上書き保存しました。');
        // 次回保存の差分元を、上書き後の内容に更新する。
        originalDocRef.current = structuredClone(projectionDocument);
        originalBufferRef.current = await (await handle.getFile()).arrayBuffer();
      } else {
        downloadBlob(blob, projectionDocument.name);
        setSaveMessage('編集内容を新しいファイルとしてダウンロード保存しました。');
        originalDocRef.current = structuredClone(projectionDocument);
      }
    } catch (error) {
      setFileImportError(error instanceof Error ? error.message : '上書き保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const startPollTimer = useCallback(async (pollId: string) => {
    if (startingPollId) return;
    setStartingPollId(pollId);
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
    } catch (error) {
      console.error('start timer failed', error);
    } finally {
      setStartingPollId(null);
    }
  }, [roomCode, startingPollId]);

  // 締切（status=closed）にすると activePolls から外れ、次のアクティブカードが先頭になる。
  const closePoll = useCallback(async (pollId: string) => {
    if (closingPollId) return;
    setClosingPollId(pollId);
    try {
      await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      });
    } catch (error) {
      console.error('close poll failed', error);
    } finally {
      setClosingPollId(null);
    }
  }, [roomCode, closingPollId]);

  useEffect(() => {
    if (!qrModalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [qrModalOpen]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => setSaveMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

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

  // ワークスペースと質問チャットの高さ配分を縦ドラッグで調整する。
  const updateWorkspacePercent = useCallback((clientY: number) => {
    const rect = vSplitRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return;
    const next = Math.round(((clientY - rect.top) / rect.height) * 100);
    setWorkspacePercent(Math.min(80, Math.max(20, next)));
  }, []);

  const startWorkspaceResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsVResizing(true);
    updateWorkspacePercent(event.clientY);
  };

  useEffect(() => {
    if (!isVResizing) return;
    const onMove = (event: PointerEvent) => updateWorkspacePercent(event.clientY);
    const onUp = () => setIsVResizing(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isVResizing, updateWorkspacePercent]);

  const layoutStyle = isDesktop
    ? {
        gridTemplateColumns: chatCollapsed
          ? 'minmax(0, 1fr)'
          : `minmax(0, ${sharedPercent}fr) 10px minmax(320px, ${100 - sharedPercent}fr)`,
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
      {/* サービスクレジット（増殖ループの露出面）: 最小サイズで常時表示 */}
      <span className="pointer-events-none fixed bottom-2 left-3 z-50 text-[10px] font-semibold tracking-wide text-white/35">
        ざせきくん
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pptx,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleProjectionFileChange}
      />
      <div
        ref={splitRef}
        className={`grid h-full min-h-0 grid-cols-1 ${
          chatCollapsed ? '' : 'lg:grid-cols-[minmax(0,7fr)_10px_minmax(340px,3fr)]'
        }`}
        style={layoutStyle}
      >
        <main className={`relative min-h-0 bg-black flex items-center justify-center overflow-hidden ${
          chatCollapsed ? 'h-full' : 'h-[55vh] lg:h-full'
        }`}>
          {convertingPptx ? (
            <div className="w-full max-w-md px-8 text-center">
              <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-sky-300" />
              <p className="text-base font-bold text-white">資料を変換しています…</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                PowerPoint と同じ見た目で表示できるよう、スライドを変換中です。
              </p>
            </div>
          ) : projectionPdfUrl ? (
            <PdfProjection
              pdfUrl={projectionPdfUrl}
              fileName={projectionPdfName}
              onFullscreen={enterFullscreen}
              onOpenClassicScreen={openClassicScreen}
              onOpenPollScreen={openPollScreen}
              onStartScreenCapture={startScreenCapture}
              onPickFile={openFilePicker}
              onClear={clearProjectionDocument}
              importingFile={importingFile}
            />
          ) : projectionDocument ? (
            <ProjectionDocumentStage
              projectionDocument={projectionDocument}
              activeSheetIndex={activeSheetIndex}
              onSheetIndexChange={setActiveSheetIndex}
              activeSlideIndex={activeSlideIndex}
              onSlideIndexChange={setActiveSlideIndex}
              onFullscreen={enterFullscreen}
              onOpenClassicScreen={openClassicScreen}
              onOpenPollScreen={openPollScreen}
              onStartScreenCapture={startScreenCapture}
              onPickFile={openFilePicker}
              onClear={clearProjectionDocument}
              importingFile={importingFile}
              canEdit={isEditableProjection(projectionDocument)}
              editMode={editMode}
              onSetEditMode={setEditMode}
              onSave={() => setConfirmSaveOpen(true)}
              saving={saving}
              canOverwrite={!!fileHandleRef.current}
              onEditCell={handleEditCell}
              onEditBlock={handleEditBlock}
            />
          ) : captureStream ? (
            <>
              <div ref={videoHostRef} className="absolute inset-0 h-full w-full bg-black" />
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-sm hover:bg-white"
                    aria-label="全画面"
                    title="全画面"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openClassicScreen}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm hover:bg-indigo-400"
                    aria-label="スクリーン画面"
                    title="スクリーン画面"
                  >
                    <MonitorUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openPollScreen}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm hover:bg-emerald-400"
                    aria-label="ワークスペース画面"
                    title="ワークスペース画面"
                  >
                    <Trees className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={openFilePicker}
                    disabled={importingFile}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-slate-900 shadow-sm hover:bg-amber-300 disabled:opacity-60"
                    aria-label="ファイルを変更"
                    title="ファイルを変更"
                  >
                    {importingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={startScreenCapture}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-sm hover:bg-white"
                    aria-label="画面を取り込み直す"
                    title="画面を取り込み直す"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={stopScreenShare}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm hover:bg-rose-600"
                    aria-label="停止"
                    title="停止"
                  >
                    <PauseCircle className="h-4 w-4" />
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
            <div className="w-full max-w-2xl px-8 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <MonitorUp className="w-10 h-10 text-indigo-200" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                資料投影画面
              </h1>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
                Canva / Google Slides などのブラウザ資料ツールを発表モードにし、<br />
                スクリーンに投影できます。または Excel / PowerPoint / Word ファイルを取り込むことができます。
              </p>
              <div className="mt-5 rounded-2xl bg-white/10 p-4 text-left ring-1 ring-white/15">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-200">取り込み方法</p>
                <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200">
                  <li>1. ブラウザ資料は発表モードで開き、「画面を取り込む」を押す</li>
                  <li>2. Excel / PowerPoint / Word は「ファイルを取り込む」から選択する</li>
                  <li>3. 取り込んだ資料を全画面にしてスクリーンに表示する</li>
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  PowerPoint は .pptx、Excel は .xlsx / .xls / .csv、Word は .docx に対応しています。PowerPoint取り込みでは発表者ツールは使えません。発表者ツールを使う場合はブラウザの資料ツールを画面取り込みしてください。
                </p>
                <div className="mt-3 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-bold leading-relaxed text-amber-100 ring-1 ring-amber-300/25">
                  <p>発表者用メモがスクリーンに映る場合は、画面設定をミラーリングOFF（拡張表示）にしてください。</p>
                </div>
              </div>
              <div className="mx-auto mt-7 grid w-full max-w-[720px] grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={startScreenCapture}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-400 px-2 text-xs font-bold text-slate-900 shadow-lg shadow-amber-900/20 ring-1 ring-amber-300 hover:bg-amber-300 sm:text-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  画面取込
                </button>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={importingFile}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-2 text-xs font-bold text-slate-900 ring-1 ring-white/60 hover:bg-slate-100 disabled:opacity-60 sm:text-sm"
                >
                  {importingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  ファイル取込
                </button>
                <button
                  type="button"
                  onClick={openPollScreen}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-500 px-2 text-xs font-bold text-white ring-1 ring-emerald-400 hover:bg-emerald-400 sm:text-sm"
                >
                  <Trees className="w-4 h-4" />
                  ワークスペース
                </button>
                <button
                  type="button"
                  onClick={openClassicScreen}
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-500 px-2 text-xs font-bold text-white ring-1 ring-indigo-400 hover:bg-indigo-400 sm:text-sm"
                >
                  <MonitorUp className="w-4 h-4" />
                  スクリーン
                </button>
              </div>
              {captureError && (
                <p className="mt-4 rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
                  {captureError}
                </p>
              )}
              {fileImportError && (
                <p className="mt-4 rounded-lg bg-rose-500/15 px-4 py-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
                  {fileImportError}
                </p>
              )}
            </div>
          )}
          {fileImportError && (projectionDocument || projectionPdfUrl || captureStream) && (
            <div className="absolute bottom-4 left-4 right-4 z-30 rounded-xl bg-rose-500/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-rose-200/40">
              {fileImportError}
            </div>
          )}
          {saveMessage && (
            <div className="absolute bottom-4 left-4 right-4 z-30 rounded-xl bg-emerald-600/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-emerald-200/40">
              {saveMessage}
            </div>
          )}
        </main>

        {!chatCollapsed && (
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
        )}

        {!chatCollapsed && (
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
              <div className="flex shrink-0 items-start gap-2">
                {qrUrl && (
                  <button
                    type="button"
                    onClick={() => setQrModalOpen(true)}
                    className="rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title="QRコードを拡大"
                  >
                    <img src={qrUrl} alt="参加QRコード" className="h-16 w-16" />
                  </button>
                )}
              </div>
            </div>
            {realtimeOffline && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <WifiOff className="w-3.5 h-3.5" />
                再接続中
              </div>
            )}
          </header>

          <div ref={vSplitRef} className="flex min-h-0 flex-1 flex-col">
            {hasActiveWorkspaceCard && (
              <>
                <section
                  className="flex min-h-0 flex-col border-b border-slate-200 bg-white"
                  style={{ flexGrow: workspacePercent, flexBasis: 0 }}
                >
                  <div className="flex shrink-0 items-center justify-between px-5 py-3">
                    <div className="inline-flex items-center gap-2">
                      <Trees className="w-4 h-4 text-[#2864f0]" />
                      <h3 className="text-sm font-extrabold tracking-tight text-slate-900">ワークスペース</h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">{activePolls.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                    <StagePollDeck
                      polls={activePolls}
                      pollVotes={pollVotes}
                      nowMs={nowMs}
                      startingPollId={startingPollId}
                      onStartPoll={startPollTimer}
                      closingPollId={closingPollId}
                      onClosePoll={closePoll}
                    />
                  </div>
                </section>

                <div
                  role="separator"
                  aria-label="ワークスペースと質問チャットの境界"
                  aria-orientation="horizontal"
                  onPointerDown={startWorkspaceResize}
                  className={`flex shrink-0 cursor-row-resize items-center justify-center border-y border-slate-200 py-1 transition-colors ${
                    isVResizing ? 'bg-indigo-100' : 'bg-slate-50 hover:bg-indigo-50'
                  }`}
                  title="ドラッグで高さを調整"
                >
                  <div className="h-1 w-10 rounded-full bg-slate-300" />
                </div>
              </>
            )}

            <section
              className="flex min-h-0 flex-col"
              style={{ flexGrow: hasActiveWorkspaceCard ? 100 - workspacePercent : 1, flexBasis: 0 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
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
          </div>
        </aside>
        )}
      </div>
      <button
        type="button"
        onClick={() => setChatCollapsed((prev) => !prev)}
        className="fixed right-4 top-1/2 z-40 inline-flex -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2.5 py-2 text-sky-600 shadow-2xl ring-1 ring-sky-200 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        aria-label={chatCollapsed ? '質問チャットを開く' : '質問チャットを閉じる'}
        title={chatCollapsed ? '質問チャットを開く' : '質問チャットを閉じる'}
      >
        {chatCollapsed ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
        <span className="text-[10px] font-bold leading-none">{chatCollapsed ? '開く' : '閉じる'}</span>
      </button>
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
      {confirmSaveOpen && projectionDocument && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="上書き保存の確認"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
          onClick={() => setConfirmSaveOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-extrabold tracking-tight text-slate-950">
              {fileHandleRef.current ? '元のファイルに上書き保存しますか？' : '編集内容を保存しますか？'}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {fileHandleRef.current
                ? `「${projectionDocument.name}」を編集した内容で上書きします。この操作は元に戻せません。`
                : 'お使いのブラウザは元ファイルへの直接上書きに対応していないため、編集内容を新しいファイルとしてダウンロード保存します。'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={performSave}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-400"
              >
                <Save className="h-4 w-4" />
                {fileHandleRef.current ? '上書き保存' : 'ダウンロード保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectionDocumentStage({
  projectionDocument,
  activeSheetIndex,
  onSheetIndexChange,
  activeSlideIndex,
  onSlideIndexChange,
  onFullscreen,
  onOpenClassicScreen,
  onOpenPollScreen,
  onStartScreenCapture,
  onPickFile,
  onClear,
  importingFile,
  canEdit,
  editMode,
  onSetEditMode,
  onSave,
  saving,
  canOverwrite,
  onEditCell,
  onEditBlock,
}: {
  projectionDocument: ProjectionDocument;
  activeSheetIndex: number;
  onSheetIndexChange: (index: number) => void;
  activeSlideIndex: number;
  onSlideIndexChange: (index: number) => void;
  onFullscreen: () => void;
  onOpenClassicScreen: () => void;
  onOpenPollScreen: () => void;
  onStartScreenCapture: () => void;
  onPickFile: () => void;
  onClear: () => void;
  importingFile: boolean;
  canEdit: boolean;
  editMode: boolean;
  onSetEditMode: (value: boolean) => void;
  onSave: () => void;
  saving: boolean;
  canOverwrite: boolean;
  onEditCell: (sheetIndex: number, rowIndex: number, colIndex: number, value: string) => void;
  onEditBlock: (blockId: string, text: string) => void;
}) {
  const isSpreadsheet = projectionDocument.kind === 'spreadsheet';
  const isPresentation = projectionDocument.kind === 'presentation';
  const displayName =
    projectionDocument.kind === 'spreadsheet'
      ? 'Excel投影中'
      : projectionDocument.kind === 'presentation'
      ? 'PowerPoint投影中'
      : 'Word投影中';
  const documentIcon =
    projectionDocument.kind === 'spreadsheet' ? (
      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-300" />
    ) : projectionDocument.kind === 'presentation' ? (
      <Presentation className="h-4 w-4 shrink-0 text-sky-300" />
    ) : (
      <FileText className="h-4 w-4 shrink-0 text-indigo-200" />
    );
  const safeSheetIndex =
    projectionDocument.kind === 'spreadsheet'
      ? Math.min(activeSheetIndex, Math.max(projectionDocument.sheets.length - 1, 0))
      : 0;
  const safeSlideIndex =
    projectionDocument.kind === 'presentation'
      ? Math.min(activeSlideIndex, Math.max(projectionDocument.slides.length - 1, 0))
      : 0;

  return (
    <>
      <ProjectionDocumentViewer
        projectionDocument={projectionDocument}
        activeSheetIndex={safeSheetIndex}
        activeSlideIndex={safeSlideIndex}
        editMode={canEdit && editMode}
        onEditCell={onEditCell}
        onEditBlock={onEditBlock}
      />
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="inline-flex max-w-[min(62vw,520px)] items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            {documentIcon}
            <span className="shrink-0">{displayName}</span>
            <span className="truncate text-white/70">{projectionDocument.name}</span>
          </div>

          {projectionDocument.kind === 'spreadsheet' && projectionDocument.sheets.length > 1 && (
            <select
              value={safeSheetIndex}
              onChange={(event) => onSheetIndexChange(Number(event.target.value))}
              className="h-9 max-w-[220px] rounded-lg border border-white/15 bg-black/60 px-3 text-xs font-semibold text-white outline-none backdrop-blur-md"
              aria-label="表示するシート"
            >
              {projectionDocument.sheets.map((sheet, index) => (
                <option key={`${sheet.name}-${index}`} value={index}>
                  {sheet.name}
                </option>
              ))}
            </select>
          )}

          {isPresentation && (
            <div className="inline-flex h-9 items-center rounded-lg bg-black/60 p-1 text-xs font-semibold text-white backdrop-blur-md">
              <button
                type="button"
                onClick={() => onSlideIndexChange(Math.max(0, safeSlideIndex - 1))}
                disabled={safeSlideIndex === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-35"
                aria-label="前のスライド"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[66px] px-2 text-center tabular-nums">
                {safeSlideIndex + 1} / {projectionDocument.slides.length}
              </span>
              <button
                type="button"
                onClick={() => onSlideIndexChange(Math.min(projectionDocument.slides.length - 1, safeSlideIndex + 1))}
                disabled={safeSlideIndex >= projectionDocument.slides.length - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-35"
                aria-label="次のスライド"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canEdit && (
            <>
              {/* デフォルトはハンド操作。編集アイコンに切り替えると直接編集できる。 */}
              <div className="inline-flex h-10 items-center rounded-lg bg-black/60 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => onSetEditMode(false)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
                    editMode ? 'text-white hover:bg-white/15' : 'bg-white text-slate-900'
                  }`}
                  aria-label="ハンド操作"
                  aria-pressed={!editMode}
                  title="ハンド操作"
                >
                  <Hand className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSetEditMode(true)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
                    editMode ? 'bg-sky-500 text-white' : 'text-white hover:bg-white/15'
                  }`}
                  aria-label="編集"
                  aria-pressed={editMode}
                  title="編集"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {editMode && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-sm font-bold text-white shadow-sm hover:bg-sky-400 disabled:opacity-60"
                  aria-label={canOverwrite ? '元のファイルに上書き保存' : '編集内容をダウンロード保存'}
                  title={canOverwrite ? '元のファイルに上書き保存' : '編集内容をダウンロード保存'}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  保存
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onFullscreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-sm hover:bg-white"
            aria-label="全画面"
            title="全画面"
          >
            <Maximize className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenClassicScreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-sm hover:bg-indigo-400"
            aria-label="スクリーン画面"
            title="スクリーン画面"
          >
            <MonitorUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenPollScreen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm hover:bg-emerald-400"
            aria-label="ワークスペース画面"
            title="ワークスペース画面"
          >
            <Trees className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPickFile}
            disabled={importingFile}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400 text-slate-900 shadow-sm hover:bg-amber-300 disabled:opacity-60"
            aria-label="ファイルを変更"
            title="ファイルを変更"
          >
            {importingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onStartScreenCapture}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-slate-900 shadow-sm hover:bg-white"
            aria-label="画面を取り込む"
            title="画面を取り込む"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm hover:bg-rose-600"
            aria-label="停止"
            title="停止"
          >
            <PauseCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

function ProjectionDocumentViewer({
  projectionDocument,
  activeSheetIndex,
  activeSlideIndex,
  editMode,
  onEditCell,
  onEditBlock,
}: {
  projectionDocument: ProjectionDocument;
  activeSheetIndex: number;
  activeSlideIndex: number;
  editMode: boolean;
  onEditCell: (sheetIndex: number, rowIndex: number, colIndex: number, value: string) => void;
  onEditBlock: (blockId: string, text: string) => void;
}) {
  if (projectionDocument.kind === 'spreadsheet') {
    const sheet = projectionDocument.sheets[activeSheetIndex] || projectionDocument.sheets[0];
    return (
      <SpreadsheetProjection
        sheet={sheet}
        editMode={editMode}
        onEditCell={(rowIndex, colIndex, value) => onEditCell(activeSheetIndex, rowIndex, colIndex, value)}
      />
    );
  }

  if (projectionDocument.kind === 'word') {
    return <WordProjection document={projectionDocument} editMode={editMode} onEditBlock={onEditBlock} />;
  }

  const slide = projectionDocument.slides[activeSlideIndex] || projectionDocument.slides[0];
  return <PresentationProjection slide={slide} slideSize={projectionDocument.slideSize} />;
}

function SpreadsheetProjection({
  sheet,
  editMode,
  onEditCell,
}: {
  sheet: ProjectionSheet;
  editMode: boolean;
  onEditCell: (rowIndex: number, colIndex: number, value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const hasRows = sheet.rows.length > 0 && sheet.totalColumns > 0;
  const hasObjects = sheet.objects.length > 0;

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // 編集モードではパンを無効化し、セルにカーソルを置けるようにする。
    if (editMode) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('button, a, input, select, textarea, [role="button"], [contenteditable]')) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollElement.scrollLeft,
      scrollTop: scrollElement.scrollTop,
    };
    setIsPanning(true);
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panState = panStateRef.current;
    const scrollElement = scrollRef.current;
    if (!panState || panState.pointerId !== event.pointerId || !scrollElement) return;

    event.preventDefault();
    scrollElement.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    scrollElement.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panStateRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panStateRef.current = null;
    setIsPanning(false);
  };

  return (
    <div
      ref={scrollRef}
      className={`absolute inset-0 overflow-auto bg-slate-100 px-4 pb-5 pt-24 text-slate-950 sm:px-6 lg:pt-24 ${
        editMode ? 'cursor-auto' : isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'
      }`}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      {!hasRows && !hasObjects ? (
        <div className="flex h-full items-center justify-center text-center">
          <div className="rounded-xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-200">
            <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">このシートに表示できるデータがありません</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {hasRows && (
            <div className="min-w-max">
              <table className="border-collapse bg-white text-left text-sm shadow-sm ring-1 ring-slate-300">
                <tbody>
                  {sheet.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, columnIndex) => (
                        <td
                          key={`${rowIndex}-${columnIndex}`}
                          style={sheet.cellStyles[rowIndex]?.[columnIndex]?.backgroundColor
                            ? { backgroundColor: sheet.cellStyles[rowIndex][columnIndex].backgroundColor }
                            : undefined}
                          contentEditable={editMode}
                          suppressContentEditableWarning
                          onBlur={
                            editMode
                              ? (event) => onEditCell(rowIndex, columnIndex, event.currentTarget.innerText)
                              : undefined
                          }
                          className={`max-w-[360px] whitespace-pre-wrap break-words border border-slate-300 px-3 py-2 align-top ${
                            rowIndex === 0
                              ? 'bg-slate-900 font-bold text-white'
                              : columnIndex === 0
                              ? 'bg-slate-50 font-semibold text-slate-900'
                              : 'bg-white text-slate-900'
                          } ${editMode ? 'cursor-text outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500' : ''}`}
                        >
                          {editMode ? cell : cell || <span className="text-slate-300"> </span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasObjects && <SpreadsheetObjects objects={sheet.objects} />}
        </div>
      )}
    </div>
  );
}

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#4f46e5', '#be123c'];

function SpreadsheetObjects({ objects }: { objects: ProjectionSheetObject[] }) {
  return (
    <section className="max-w-[1280px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-slate-950">シート内グラフ・画像</h2>
          <p className="text-xs font-semibold text-slate-500">{objects.length}件のオブジェクトを表示しています</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {objects.map((object, index) => (
          <SpreadsheetObjectCard key={`${object.id}-${index}`} object={object} />
        ))}
      </div>
    </section>
  );
}

function SpreadsheetObjectCard({ object }: { object: ProjectionSheetObject }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-slate-900">{object.title}</h3>
          {object.anchor && (
            <p className="mt-0.5 text-xs font-semibold text-slate-500">配置: {object.anchor}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
          {object.type === 'chart' ? 'グラフ' : '画像'}
        </span>
      </header>

      {object.type === 'image' ? (
        <div className="overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
          <img src={object.src} alt={object.alt} className="max-h-[620px] w-full object-contain" />
        </div>
      ) : (
        <SpreadsheetChartPreview chart={object} />
      )}
    </article>
  );
}

function SpreadsheetChartPreview({ chart }: { chart: ProjectionSheetChart }) {
  const series = chart.series.filter((item) => item.values.some((value) => Number.isFinite(value)));

  if (series.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg bg-slate-50 px-4 py-8 text-center ring-1 ring-slate-200">
        <p className="text-sm font-bold text-slate-500">このグラフの系列データを読み取れませんでした</p>
      </div>
    );
  }

  const chartBody =
    chart.chartType === 'scatter' ? (
      <ScatterChartSvg series={series} />
    ) : chart.chartType === 'line' || chart.chartType === 'area' ? (
      <LineChartSvg series={series} fillArea={chart.chartType === 'area'} />
    ) : (
      <BarChartSvg series={series} horizontal={chart.orientation === 'horizontal'} />
    );

  return (
    <div className="space-y-3">
      <ChartLegend series={series} />
      <div className="overflow-x-auto rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
        {chartBody}
      </div>
    </div>
  );
}

function ChartLegend({ series }: { series: ProjectionSheetChart['series'] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {series.map((item, index) => (
        <span
          key={`${item.name}-${index}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
          />
          <span className="truncate">{item.name}</span>
        </span>
      ))}
    </div>
  );
}

function BarChartSvg({
  series,
  horizontal,
}: {
  series: ProjectionSheetChart['series'];
  horizontal: boolean;
}) {
  return horizontal ? <HorizontalBarChartSvg series={series} /> : <VerticalBarChartSvg series={series} />;
}

function HorizontalBarChartSvg({ series }: { series: ProjectionSheetChart['series'] }) {
  const labels = getChartLabels(series);
  const width = 900;
  const left = 210;
  const right = 34;
  const top = 34;
  const bottom = 46;
  const groupHeight = Math.max(30, series.length * 14 + 16);
  const height = Math.max(260, top + bottom + labels.length * groupHeight);
  const { min, max } = getValueExtent(series.flatMap((item) => item.values));
  const x = (value: number) => scaleValue(value, min, max, left, width - right);
  const zeroX = x(0);
  const ticks = makeTicks(min, max, 5);
  const barHeight = Math.max(5, Math.min(13, (groupHeight - 10) / Math.max(series.length, 1)));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className="block w-full max-w-none"
      style={{ minWidth: `${width}px`, height: `${height}px` }}
    >
      {ticks.map((tick) => {
        const tickX = x(tick);
        return (
          <g key={tick}>
            <line x1={tickX} y1={top - 8} x2={tickX} y2={height - bottom + 8} stroke="#dbe3ef" />
            <text x={tickX} y={height - 14} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">
              {formatChartValue(tick)}
            </text>
          </g>
        );
      })}
      <line x1={zeroX} y1={top - 10} x2={zeroX} y2={height - bottom + 10} stroke="#475569" strokeWidth={1.5} />
      {labels.map((label, labelIndex) => {
        const groupTop = top + labelIndex * groupHeight;
        return (
          <g key={`${label}-${labelIndex}`}>
            <text
              x={left - 12}
              y={groupTop + groupHeight / 2 + 4}
              textAnchor="end"
              className="fill-slate-700 text-[12px] font-bold"
            >
              {truncateLabel(label, 22)}
            </text>
            {series.map((item, seriesIndex) => {
              const value = item.values[labelIndex];
              if (!Number.isFinite(value)) return null;
              const valueX = x(value);
              const rectX = Math.min(zeroX, valueX);
              const rectWidth = Math.max(1, Math.abs(valueX - zeroX));
              const rectY = groupTop + 7 + seriesIndex * (barHeight + 2);
              const placeValueAbove =
                (value < 0 && rectX < left + 72) ||
                (value >= 0 && rectX + rectWidth > width - right - 64);
              const valueLabelX = placeValueAbove
                ? Math.min(width - right - 8, Math.max(left + 8, rectX + rectWidth / 2))
                : value >= 0
                ? rectX + rectWidth + 5
                : rectX - 5;
              const valueLabelY = placeValueAbove ? Math.max(14, rectY - 4) : rectY + barHeight - 1;
              const valueTextAnchor = placeValueAbove ? 'middle' : value >= 0 ? 'start' : 'end';
              return (
                <g key={`${item.name}-${seriesIndex}`}>
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={barHeight}
                    rx={2}
                    fill={CHART_COLORS[seriesIndex % CHART_COLORS.length]}
                  />
                  <text
                    x={valueLabelX}
                    y={valueLabelY}
                    textAnchor={valueTextAnchor}
                    className="fill-slate-500 text-[10px] font-bold"
                  >
                    {formatChartValue(value)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function VerticalBarChartSvg({ series }: { series: ProjectionSheetChart['series'] }) {
  const labels = getChartLabels(series);
  const width = Math.max(760, labels.length * Math.max(56, series.length * 18 + 18) + 100);
  const height = 360;
  const left = 58;
  const right = 28;
  const top = 26;
  const bottom = 86;
  const plotWidth = width - left - right;
  const { min, max } = getValueExtent(series.flatMap((item) => item.values));
  const y = (value: number) => scaleValue(value, min, max, height - bottom, top);
  const zeroY = y(0);
  const ticks = makeTicks(min, max, 5);
  const groupWidth = plotWidth / Math.max(labels.length, 1);
  const barWidth = Math.max(5, Math.min(20, (groupWidth - 10) / Math.max(series.length, 1)));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className="block max-w-none"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {ticks.map((tick) => {
        const tickY = y(tick);
        return (
          <g key={tick}>
            <line x1={left} y1={tickY} x2={width - right} y2={tickY} stroke="#dbe3ef" />
            <text x={left - 10} y={tickY + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">
              {formatChartValue(tick)}
            </text>
          </g>
        );
      })}
      <line x1={left} y1={zeroY} x2={width - right} y2={zeroY} stroke="#475569" strokeWidth={1.5} />
      {labels.map((label, labelIndex) => {
        const groupX = left + labelIndex * groupWidth;
        return (
          <g key={`${label}-${labelIndex}`}>
            {series.map((item, seriesIndex) => {
              const value = item.values[labelIndex];
              if (!Number.isFinite(value)) return null;
              const barX = groupX + (groupWidth - barWidth * series.length) / 2 + seriesIndex * barWidth;
              const valueY = y(value);
              const rectY = Math.min(zeroY, valueY);
              const rectHeight = Math.max(1, Math.abs(valueY - zeroY));
              return (
                <rect
                  key={`${item.name}-${seriesIndex}`}
                  x={barX}
                  y={rectY}
                  width={barWidth - 2}
                  height={rectHeight}
                  rx={2}
                  fill={CHART_COLORS[seriesIndex % CHART_COLORS.length]}
                />
              );
            })}
            <text
              x={groupX + groupWidth / 2}
              y={height - bottom + 24}
              textAnchor="end"
              transform={`rotate(-42 ${groupX + groupWidth / 2} ${height - bottom + 24})`}
              className="fill-slate-600 text-[11px] font-bold"
            >
              {truncateLabel(label, 16)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChartSvg({
  series,
  fillArea,
}: {
  series: ProjectionSheetChart['series'];
  fillArea: boolean;
}) {
  const labels = getChartLabels(series);
  const pointCount = Math.max(labels.length, ...series.map((item) => item.values.length));
  const width = Math.max(760, pointCount * 48 + 100);
  const height = 360;
  const left = 58;
  const right = 28;
  const top = 26;
  const bottom = 78;
  const { min, max } = getValueExtent(series.flatMap((item) => item.values));
  const y = (value: number) => scaleValue(value, min, max, height - bottom, top);
  const x = (index: number) => scaleValue(index, 0, Math.max(pointCount - 1, 1), left, width - right);
  const zeroY = y(0);
  const ticks = makeTicks(min, max, 5);
  const labelStep = Math.max(1, Math.ceil(labels.length / 10));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className="block max-w-none"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {ticks.map((tick) => {
        const tickY = y(tick);
        return (
          <g key={tick}>
            <line x1={left} y1={tickY} x2={width - right} y2={tickY} stroke="#dbe3ef" />
            <text x={left - 10} y={tickY + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">
              {formatChartValue(tick)}
            </text>
          </g>
        );
      })}
      <line x1={left} y1={zeroY} x2={width - right} y2={zeroY} stroke="#475569" strokeWidth={1.5} />
      {series.map((item, seriesIndex) => {
        const points = item.values
          .map((value, index) => (Number.isFinite(value) ? `${x(index)},${y(value)}` : null))
          .filter(Boolean)
          .join(' ');
        const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];
        const areaPoints = `${left},${zeroY} ${points} ${x(item.values.length - 1)},${zeroY}`;
        return (
          <g key={`${item.name}-${seriesIndex}`}>
            {fillArea && <polygon points={areaPoints} fill={color} opacity={0.14} />}
            <polyline points={points} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {item.values.map((value, index) => (
              Number.isFinite(value) ? (
                <circle key={index} cx={x(index)} cy={y(value)} r={3.5} fill={color} stroke="#ffffff" strokeWidth={1.5} />
              ) : null
            ))}
          </g>
        );
      })}
      {labels.map((label, index) => (
        index % labelStep === 0 ? (
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={height - bottom + 24}
            textAnchor="end"
            transform={`rotate(-36 ${x(index)} ${height - bottom + 24})`}
            className="fill-slate-600 text-[11px] font-bold"
          >
            {truncateLabel(label, 14)}
          </text>
        ) : null
      ))}
    </svg>
  );
}

function ScatterChartSvg({ series }: { series: ProjectionSheetChart['series'] }) {
  const pointsBySeries = series.map((item) => ({
    name: item.name,
    points: item.values.map((value, index) => {
      const categoryValue = parseChartNumber(item.categories[index]);
      return {
        x: Number.isFinite(categoryValue) ? categoryValue : index + 1,
        y: value,
        label: item.pointLabels?.[index] || '',
      };
    }),
  }));
  const xValues = pointsBySeries.flatMap((item) => item.points.map((point) => point.x));
  const yValues = pointsBySeries.flatMap((item) => item.points.map((point) => point.y));
  const width = 760;
  const height = 360;
  const left = 62;
  const right = 30;
  const top = 24;
  const bottom = 56;
  const xExtent = getValueExtent(xValues, false);
  const yExtent = getValueExtent(yValues);
  const x = (value: number) => scaleValue(value, xExtent.min, xExtent.max, left, width - right);
  const y = (value: number) => scaleValue(value, yExtent.min, yExtent.max, height - bottom, top);
  const xTicks = makeTicks(xExtent.min, xExtent.max, 5);
  const yTicks = makeTicks(yExtent.min, yExtent.max, 5);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      className="block w-full max-w-none"
      style={{ minWidth: `${width}px`, height: `${height}px` }}
    >
      {yTicks.map((tick) => {
        const tickY = y(tick);
        return (
          <g key={`y-${tick}`}>
            <line x1={left} y1={tickY} x2={width - right} y2={tickY} stroke="#dbe3ef" />
            <text x={left - 10} y={tickY + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-bold">
              {formatChartValue(tick)}
            </text>
          </g>
        );
      })}
      {xTicks.map((tick) => {
        const tickX = x(tick);
        return (
          <g key={`x-${tick}`}>
            <line x1={tickX} y1={top} x2={tickX} y2={height - bottom} stroke="#e2e8f0" />
            <text x={tickX} y={height - 18} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">
              {formatChartValue(tick)}
            </text>
          </g>
        );
      })}
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#475569" strokeWidth={1.5} />
      <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#475569" strokeWidth={1.5} />
      {pointsBySeries.map((item, seriesIndex) => {
        const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];
        return (
          <g key={`${item.name}-${seriesIndex}`}>
            {item.points.map((point, pointIndex) => (
              <g key={pointIndex}>
                <circle cx={x(point.x)} cy={y(point.y)} r={4} fill={color} opacity={0.9} />
                {point.label && (
                  <text
                    x={x(point.x) + (pointIndex % 2 === 0 ? 8 : -8)}
                    y={y(point.y) + (pointIndex % 3 === 0 ? -8 : 14)}
                    textAnchor={pointIndex % 2 === 0 ? 'start' : 'end'}
                    className="fill-slate-700 text-[11px] font-bold"
                  >
                    {truncateLabel(point.label, 18)}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function getChartLabels(series: ProjectionSheetChart['series']) {
  const longestCategories = series.reduce<string[]>(
    (longest, item) => (item.categories.length > longest.length ? item.categories : longest),
    []
  );
  const length = Math.max(longestCategories.length, ...series.map((item) => item.values.length));
  return Array.from({ length }, (_, index) => longestCategories[index] || String(index + 1));
}

function getValueExtent(values: number[], includeZero = true) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return { min: 0, max: 1 };

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    const padding = Math.abs(min) > 1 ? Math.abs(min) * 0.2 : 1;
    min -= padding;
    max += padding;
  }

  return { min, max };
}

function makeTicks(min: number, max: number, count: number) {
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function scaleValue(value: number, min: number, max: number, start: number, end: number) {
  if (min === max) return (start + end) / 2;
  return start + ((value - min) / (max - min)) * (end - start);
}

function formatChartValue(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 10000) return new Intl.NumberFormat('ja-JP', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  if (absolute > 0 && absolute < 1) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(value);
}

function truncateLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function parseChartNumber(value: string | undefined) {
  const parsed = Number((value || '').replace(/,/g, '').replace(/%$/, '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function WordProjection({
  document,
  editMode,
  onEditBlock,
}: {
  document: ProjectionWordDocument;
  editMode: boolean;
  onEditBlock: (blockId: string, text: string) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-auto bg-slate-200 px-4 pb-10 pt-24 text-slate-950 sm:px-8">
      <article className="mx-auto min-h-full max-w-5xl bg-white px-8 py-10 shadow-sm ring-1 ring-slate-300 sm:px-12">
        <div className="space-y-5">
          {document.blocks.map((block) => {
            if (block.type === 'paragraph') {
              const headingClass =
                block.headingLevel === 1
                  ? 'text-3xl font-extrabold leading-tight'
                  : block.headingLevel === 2
                  ? 'text-2xl font-extrabold leading-tight'
                  : block.headingLevel
                  ? 'text-xl font-bold leading-tight'
                  : 'text-base font-medium leading-8';

              return (
                <p
                  key={block.id}
                  contentEditable={editMode}
                  suppressContentEditableWarning
                  onBlur={editMode ? (event) => onEditBlock(block.id, event.currentTarget.innerText) : undefined}
                  className={`whitespace-pre-wrap break-words text-slate-900 ${headingClass} ${
                    editMode ? 'cursor-text rounded-sm outline-none focus:ring-2 focus:ring-sky-500' : ''
                  }`}
                  style={{ textAlign: block.textAlign }}
                >
                  {block.text}
                </p>
              );
            }

            if (block.type === 'image') {
              return (
                <figure key={block.id} className="overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200">
                  <img src={block.src} alt={block.alt} className="max-h-[720px] w-full object-contain" />
                </figure>
              );
            }

            return (
              <div key={block.id} className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, columnIndex) => (
                          <td
                            key={`${rowIndex}-${columnIndex}`}
                            className="max-w-[360px] whitespace-pre-wrap break-words border border-slate-300 px-3 py-2 align-top text-slate-900"
                          >
                            {cell || <span className="text-slate-300"> </span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function PresentationProjection({
  slide,
  slideSize,
}: {
  slide: ProjectionSlide;
  slideSize: { width: number; height: number };
}) {
  return (
    <div className="absolute inset-0 bg-neutral-950">
      <svg
        className="block h-full w-full"
        viewBox={`0 0 ${slideSize.width} ${slideSize.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={slide.title}
        style={{ backgroundColor: slide.backgroundColor }}
      >
        {slide.elements.length === 0 && (
          <text
            x={slideSize.width / 2}
            y={slideSize.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#64748b"
            fontSize={24 * 12700}
            fontWeight={700}
          >
            このスライドは静的プレビューで表示できる要素がありません
          </text>
        )}
        {slide.elements.map((element) => (
          <PresentationSlideElement key={element.id} element={element} slideSize={slideSize} />
        ))}
      </svg>
    </div>
  );
}

function PresentationSlideElement({
  element,
  slideSize,
}: {
  element: ProjectionSlideElement;
  slideSize: { width: number; height: number };
}) {
  const rect = {
    x: (element.rect.left / 100) * slideSize.width,
    y: (element.rect.top / 100) * slideSize.height,
    width: (element.rect.width / 100) * slideSize.width,
    height: (element.rect.height / 100) * slideSize.height,
  };

  if (element.type === 'image') {
    return (
      <image
        href={element.src}
        aria-label={element.alt}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        preserveAspectRatio="none"
      />
    );
  }

  if (element.type === 'shape') {
    return (
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={element.backgroundColor}
      />
    );
  }

  const paddingX = Math.min(rect.width * 0.06, Math.max(element.fontSizeEmu * 0.3, rect.width * 0.015));
  const paddingY = Math.min(rect.height * 0.18, Math.max(element.fontSizeEmu * 0.2, rect.height * 0.035));

  return (
    <foreignObject
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
    >
      <div
        style={{
          boxSizing: 'border-box',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          padding: `${paddingY}px ${paddingX}px`,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.12,
          backgroundColor: element.backgroundColor || 'transparent',
          color: element.color,
          fontSize: `${element.fontSizeEmu}px`,
          fontWeight: element.fontWeight,
          textAlign: element.textAlign,
        }}
      >
        {element.text}
      </div>
    </foreignObject>
  );
}
function StagePollDeck({
  polls,
  pollVotes,
  nowMs,
  startingPollId,
  onStartPoll,
  closingPollId,
  onClosePoll,
}: {
  polls: Poll[];
  pollVotes: Record<string, PollVote[]>;
  nowMs: number;
  startingPollId: string | null;
  onStartPoll: (pollId: string) => void;
  closingPollId: string | null;
  onClosePoll: (pollId: string) => void;
}) {
  if (polls.length === 0) {
    return (
      <div className="rounded-lg border border-[#e9e7e7] bg-[#f7f5f5] px-4 py-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#ebf3ff]">
          <Trees className="h-5 w-5 text-[#aac8ff]" />
        </div>
        <p className="text-sm font-bold text-[#595959]">アクティブなカードはありません</p>
      </div>
    );
  }

  // 複数アクティブでも先頭（1番目）のカードだけ表示。締切で次のカードが先頭になる。
  const poll = polls[0];
  const hasNext = polls.length > 1;
  return (
    <div className="space-y-3">
      <StagePollCard
        key={poll.id}
        poll={poll}
        votes={pollVotes[poll.id] || []}
        nowMs={nowMs}
        label={hasNext ? `カード 1 / ${polls.length}` : 'カード 1'}
        starting={startingPollId === poll.id}
        onStart={() => onStartPoll(poll.id)}
        hasNext={hasNext}
        closing={closingPollId === poll.id}
        onClose={() => onClosePoll(poll.id)}
      />
    </div>
  );
}

function StagePollCard({
  poll,
  votes,
  nowMs,
  label,
  starting,
  onStart,
  hasNext,
  closing,
  onClose,
}: {
  poll: Poll;
  votes: PollVote[];
  nowMs: number;
  label: string;
  starting: boolean;
  onStart: () => void;
  hasNext: boolean;
  closing: boolean;
  onClose: () => void;
}) {
  const { meta, options } = extractPollPayload(poll.options);
  const mode = getPollMode(meta.mode);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const quizQuestions = mode === 'quiz' ? getQuizQuestions(meta, options) : [];
  const safeQuizIndex = Math.min(activeQuizIndex, Math.max(quizQuestions.length - 1, 0));
  const counts = options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalCast = counts.reduce((sum, count) => sum + count, 0);
  const totalRespondents =
    mode === 'free_text'
      ? votes.filter((vote) => !!vote.value).length
      : mode === 'ranking' || mode === 'quiz'
      ? new Set(votes.map((v) => v.participant_id).filter(Boolean)).size || totalCast
      : totalCast;
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const timeLimit = Number(meta.timeLimitSeconds || 0);
  const timerStartMs = poll.started_at ? new Date(poll.started_at).getTime() : null;
  const timerRemaining =
    timeLimit > 0 && timerStartMs
      ? Math.max(0, Math.ceil(timeLimit - (nowMs - timerStartMs) / 1000))
      : null;
  const requiresManualStart = timeLimit > 0;
  const timerNotStarted = requiresManualStart && !timerStartMs;
  // 投票時間ありの場合のみ「集計中」を挟む。締切後は新たな回答は増えないため、
  // 在時間内に届いた票の収集（realtime 伝播）が終わるまでの一定時間だけ集計中を表示してから開示する。
  // 投票時間なし（deadlineMs===null）は従来どおり即時反映（集計中を出さない）。
  const deadlineMs = timeLimit > 0 && timerStartMs ? timerStartMs + timeLimit * 1000 : null;
  const aggregating =
    deadlineMs !== null && nowMs >= deadlineMs && nowMs < deadlineMs + POLL_AGGREGATION_SETTLE_MS;
  const revealed =
    mode === 'standard'
      ? timeLimit === 0 || (!!timerStartMs && timerRemaining !== null && timerRemaining <= 0 && !aggregating)
      : mode === 'quiz'
      ? !timerNotStarted && (timeLimit === 0 || (timerRemaining !== null && timerRemaining <= 0 && !aggregating))
      : timeLimit === 0 || (!!timerStartMs && timerRemaining !== null && timerRemaining <= 0 && !aggregating);
  const answering = timeLimit > 0 && !!timerStartMs && !revealed && !aggregating;
  const fmtTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const activeQuizQuestion = quizQuestions[safeQuizIndex];
  const activeQuizStats = activeQuizQuestion
    ? (() => {
        const questionVotes = votes.filter((vote) => Number(vote.value) === safeQuizIndex + 1);
        const questionTotal = new Set(questionVotes.map((vote) => vote.participant_id)).size;
        const correctOffsets = getQuizCorrectOptionOffsets(activeQuizQuestion);
        const hasKey = correctOffsets.length > 0;
        const votesByParticipant = new Map<string, number[]>();

        questionVotes.forEach((vote) => {
          if (typeof vote.option_index !== 'number') return;
          const offset = vote.option_index - activeQuizQuestion.optionStart;
          if (offset < 0 || offset >= activeQuizQuestion.optionCount) return;
          const list = votesByParticipant.get(vote.participant_id) || [];
          list.push(offset);
          votesByParticipant.set(vote.participant_id, list);
        });

        const correctCount = hasKey
          ? Array.from(votesByParticipant.values()).filter((offsets) => {
              const sortedOffsets = offsets.slice().sort((a, b) => a - b);
              return (
                sortedOffsets.length === correctOffsets.length &&
                correctOffsets.every((offset, index) => sortedOffsets[index] === offset)
              );
            }).length
          : 0;
        const correctRate =
          hasKey && questionTotal > 0 ? Math.round((correctCount / questionTotal) * 100) : 0;

        return { questionTotal, correctOffsets, hasKey, correctCount, correctRate };
      })()
    : null;
  const displayOptions =
    mode === 'quiz' && activeQuizQuestion
      ? options.slice(
          activeQuizQuestion.optionStart,
          activeQuizQuestion.optionStart + activeQuizQuestion.optionCount
        )
      : options;
  const optionIndexOffset = mode === 'quiz' && activeQuizQuestion ? activeQuizQuestion.optionStart : 0;
  const optionGridClass = displayOptions.length >= 5 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <article className="rounded-lg border border-[#e9e7e7] bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#ebf3ff] px-2 py-0.5 text-[11px] font-bold text-[#1e46aa]">
              {label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[11px] font-bold text-[#00963c]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00963c]" />
              Live
            </span>
          </div>
          <h4 className="mt-1.5 break-words text-sm font-extrabold leading-snug text-[#323232]">
            {poll.question}
          </h4>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-[#595959]">
          {totalRespondents}件
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {mode === 'quiz' && quizQuestions.length > 0 && (
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#f7f5f5] p-1">
            <button
              type="button"
              onClick={() => setActiveQuizIndex((index) => Math.max(0, index - 1))}
              disabled={safeQuizIndex === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#2864f0] ring-1 ring-[#e1dcdc] disabled:opacity-40"
              aria-label="前の問題"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-xs font-bold tabular-nums text-[#595959]">
              問題 {safeQuizIndex + 1}/{quizQuestions.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveQuizIndex((index) => Math.min(quizQuestions.length - 1, index + 1))}
              disabled={safeQuizIndex >= quizQuestions.length - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#2864f0] ring-1 ring-[#e1dcdc] disabled:opacity-40"
              aria-label="次の問題"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {timerNotStarted ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2864f0] px-3 text-xs font-bold text-white transition-colors hover:bg-[#285ac8] disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            {timeLimit > 0 ? `回答開始（${fmtTime(timeLimit)}）` : '回答開始'}
          </button>
        ) : timeLimit > 0 ? (
          <div className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ${
            answering ? 'bg-[#e8f7ee] text-[#00963c]' : 'bg-[#f7f5f5] text-[#595959]'
          }`}>
            <Clock className="h-3.5 w-3.5 text-[#2864f0]" />
            {answering ? fmtTime(timerRemaining ?? timeLimit) : '0:00'}
          </div>
        ) : requiresManualStart ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8f7ee] px-2 py-1 text-xs font-bold text-[#00963c]">
            受付中
          </div>
        ) : null}
        {timerNotStarted ? (
          <span className="text-[11px] font-bold leading-snug text-[#595959]">
            「回答開始」ボタンを押すと回答受付が始まります。
          </span>
        ) : answering && timeLimit > 0 ? (
          <span className="text-[11px] font-bold leading-snug text-[#595959]">
            回答受付中です。結果は投票時間後に表示します。
          </span>
        ) : null}
        {hasNext && revealed && (
          <button
            type="button"
            onClick={onClose}
            disabled={closing}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
            title="このカードを締め切って次のカードへ進みます"
          >
            {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
            次に進む
          </button>
        )}
      </div>

      {mode === 'quiz' && activeQuizQuestion && (
        <div className="mb-2 rounded-lg bg-[#f7f5f5] px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-bold text-[#2864f0]">問題 {activeQuizQuestion.questionNumber}</p>
            {revealed && activeQuizStats?.hasKey && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
                正答率 {activeQuizStats.correctRate}%（{activeQuizStats.correctCount}/{activeQuizStats.questionTotal}）
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-start gap-2">
            <p className="min-w-0 flex-1 break-words text-xs font-bold leading-snug text-[#323232]">
              {activeQuizQuestion.question}
            </p>
            {activeQuizQuestion.questionImageUrl && (
              <img
                src={activeQuizQuestion.questionImageUrl}
                alt={`問題 ${activeQuizQuestion.questionNumber} の画像`}
                className="h-16 w-24 shrink-0 rounded-md bg-white object-contain ring-1 ring-[#e1dcdc]"
              />
            )}
          </div>
        </div>
      )}

      {aggregating && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-[#f7f5f5] px-3 py-3 ring-1 ring-[#e1dcdc]">
          <Loader2 className="h-4 w-4 animate-spin text-[#00963c]" />
          <span className="text-xs font-bold text-[#323232]">回答を集計中です… まもなく結果を表示します</span>
        </div>
      )}
      {mode === 'free_text' ? (
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-3 ring-1 ring-orange-200">
          <Hand className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
          <p className="text-xs font-bold leading-relaxed text-orange-900">
            ブレスト形式は付箋ボードで表示します。「ワークスペース画面」をご確認ください。
          </p>
        </div>
      ) : mode === 'ranking' ? (
        revealed ? (
          <RankingResults
            options={options}
            votes={votes}
            rankCount={maxSelections}
            weights={meta.rankingWeights}
            displayMode={getRankingDisplayMode(meta.rankingDisplayMode)}
            size="compact"
          />
        ) : (
          <p className="rounded-lg bg-[#f7f5f5] px-3 py-4 text-center text-xs font-bold text-[#595959]">
            回答受付中です。結果はホストが締め切るまで表示しません。
          </p>
        )
      ) : (
        <div className="space-y-2">
          {!revealed && !timerNotStarted && timeLimit === 0 && (
            <p className="rounded-lg bg-[#f7f5f5] px-3 py-3 text-center text-xs font-bold text-[#595959]">
              回答受付中です。選択肢は参加者画面にも表示されています。
            </p>
          )}
          <div className={`grid gap-2 ${optionGridClass}`}>
            {displayOptions.map((option, i) => {
              const optionIndex = optionIndexOffset + i;
              const count = counts[optionIndex] || 0;
              const questionTotal =
                mode === 'quiz' && activeQuizStats ? activeQuizStats.questionTotal : totalCast;
              const pct = questionTotal > 0 ? Math.round((count / questionTotal) * 100) : 0;
              const imageUrl = getPollOptionImageUrl(option);
              const isCorrect =
                mode === 'quiz' &&
                revealed &&
                !!activeQuizStats?.hasKey &&
                activeQuizStats.correctOffsets.includes(i);
              return (
                <div
                  key={i}
                  className={`relative min-h-[72px] overflow-hidden rounded-lg bg-white ring-1 ${
                    isCorrect ? 'ring-2 ring-emerald-400' : 'ring-[#e9e7e7]'
                  }`}
                >
                  {revealed && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.45 }}
                      className={`absolute inset-y-0 left-0 ${
                        mode === 'quiz' ? 'bg-emerald-100/80' : 'bg-[#dce8ff]'
                      }`}
                      aria-hidden
                    />
                  )}
                  <div className="relative flex h-full flex-col justify-between gap-2 px-3 py-2.5">
                    <span className="flex min-w-0 items-start gap-1.5 break-words text-xs font-semibold leading-snug text-[#323232]">
                      {mode === 'quiz' && (
                        <span className="shrink-0 font-bold text-emerald-700">{optionLetter(i)}</span>
                      )}
                      {imageUrl && (
                        <span
                          className="shrink-0 rounded-md ring-1 ring-[#e1dcdc]"
                          aria-hidden
                        >
                          <img
                            src={imageUrl}
                            alt={`${mode === 'quiz' ? `解答 ${optionLetter(i)}` : `選択肢 ${i + 1}`} の画像`}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        </span>
                      )}
                      <span className="line-clamp-2 min-w-0">
                        {getPollOptionLabel(
                          option,
                          mode === 'quiz' ? `解答 ${optionLetter(i)}` : `選択肢 ${i + 1}`
                        )}
                      </span>
                    </span>
                    {revealed && (
                      <span className="flex items-center gap-2">
                        {isCorrect && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            正解
                          </span>
                        )}
                        <span className="ml-auto self-end text-xs font-bold tabular-nums text-[#595959]">
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
      )}
    </article>
  );
}
