'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  MonitorUp,
  PauseCircle,
  Presentation,
  RefreshCw,
  Trees,
  Upload,
} from 'lucide-react';

// pptx を Gotenberg で PDF 化したものを pdf.js でスライド表示する。
// PowerPoint と同じ見た目（フォント・表・図形・QR）で正確に投影できる。
export default function PdfProjection({
  pdfUrl,
  fileName,
  onFullscreen,
  onOpenClassicScreen,
  onOpenPollScreen,
  onStartScreenCapture,
  onPickFile,
  onClear,
  importingFile,
}: {
  pdfUrl: string;
  fileName: string;
  onFullscreen: () => void;
  onOpenClassicScreen: () => void;
  onOpenPollScreen: () => void;
  onStartScreenCapture: () => void;
  onPickFile: () => void;
  onClear: () => void;
  importingFile: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  // PDF を読み込む。
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);
    setPageIndex(0);

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('PDF を読み込めませんでした。');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [pdfUrl]);

  // 現在ページを、コンテナにフィットさせつつ高解像度で描画する。
  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || numPages === 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(container.clientWidth / base.width, container.clientHeight / base.height);
      if (!Number.isFinite(fit) || fit <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: fit * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch {
        // ページ切替やリサイズでキャンセルされた場合は無視。
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageIndex, numPages, resizeTick]);

  // コンテナのサイズ変化（全画面化・分割リサイズ）で再描画。
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setResizeTick((tick) => tick + 1));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const goPrev = () => setPageIndex((index) => Math.max(0, index - 1));
  const goNext = () => setPageIndex((index) => Math.min(Math.max(numPages - 1, 0), index + 1));

  return (
    <div className="absolute inset-0 bg-neutral-950">
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="block" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="rounded-xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white">{error}</p>
          </div>
        )}
      </div>

      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="inline-flex max-w-[min(62vw,520px)] items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
            <Presentation className="h-4 w-4 shrink-0 text-sky-300" />
            <span className="shrink-0">PowerPoint投影中</span>
            <span className="truncate text-white/70">{fileName}</span>
          </div>

          {numPages > 0 && (
            <div className="inline-flex h-9 items-center rounded-lg bg-black/60 p-1 text-xs font-semibold text-white backdrop-blur-md">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageIndex === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-35"
                aria-label="前のスライド"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[66px] px-2 text-center tabular-nums">
                {pageIndex + 1} / {numPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={pageIndex >= numPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/15 disabled:opacity-35"
                aria-label="次のスライド"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
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
    </div>
  );
}
