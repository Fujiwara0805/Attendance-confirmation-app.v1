'use client';

/**
 * 画面共有 MediaStream を**モジュールスコープ**で保持するシングルトンストア。
 *
 * なぜモジュールスコープか:
 *   React の Context/Layout で保持しても、Next.js App Router の遷移条件によっては
 *   再マウント（= State クリア）が起きる可能性があり、画面共有ストリームが
 *   消えてしまうため、もっとも上位の「JS モジュール」にステートを持たせる。
 *   タブがリロード or 閉じられるまで、ストリームの参照は確実に保持される。
 */

import { useEffect, useReducer } from 'react';

type Listener = () => void;

let stream: MediaStream | null = null;
let surface: string | null = null;
let error: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  // Listener が解除されても安全に巡回できるよう一旦コピー
  Array.from(listeners).forEach((listener) => {
    try {
      listener();
    } catch {
      /* 個々の listener エラーで他に伝播させない */
    }
  });
}

function stopCurrentTracks() {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* 既に stop 済みなど */
    }
  });
}

export const captureStreamStore = {
  getStream: () => stream,
  getSurface: () => surface,
  getError: () => error,
  hasStream: () => !!stream,

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setError(next: string | null) {
    if (error === next) return;
    error = next;
    emit();
  },

  /**
   * 画面共有を開始（または取り直し）。既存ストリームは停止して置き換える。
   */
  async start() {
    error = null;
    emit();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      error = 'このブラウザでは画面共有を利用できません。Chrome または Edge でお試しください。';
      emit();
      return;
    }

    // 既存ストリームを停止
    stopCurrentTracks();
    stream = null;
    surface = null;

    try {
      // CaptureController で「共有先にフォーカスを移さない」よう指示する。
      const CaptureControllerCtor = (
        window as unknown as {
          CaptureController?: new () => {
            setFocusBehavior: (behavior: 'focus-captured-surface' | 'no-focus-change') => void;
          };
        }
      ).CaptureController;
      const controller = CaptureControllerCtor ? new CaptureControllerCtor() : undefined;

      const next = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
          displaySurface: 'monitor',
        },
        audio: false,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'exclude',
        controller,
      } as DisplayMediaStreamOptions);

      try {
        controller?.setFocusBehavior('no-focus-change');
      } catch {
        /* CaptureController 非対応／呼び出しタイミング超過時は無視 */
      }

      const [track] = next.getVideoTracks();
      const settings = track?.getSettings() as MediaTrackSettings & { displaySurface?: string };

      // ユーザーが「共有を停止」した場合などに track が終了するので、その時点でクリア
      track?.addEventListener('ended', () => {
        if (stream === next) {
          stream = null;
          surface = null;
          emit();
        }
      });

      stream = next;
      surface = settings?.displaySurface || null;

      if (!controller) {
        window.setTimeout(() => window.focus(), 200);
      }
      emit();
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'NotAllowedError';
      error = isAbort ? '資料の取り込みがキャンセルされました。' : '資料画面の取り込みに失敗しました。';
      emit();
    }
  },

  /**
   * 明示的にストリームを停止して破棄。
   */
  stop() {
    if (!stream && !surface) return;
    stopCurrentTracks();
    stream = null;
    surface = null;
    emit();
  },
};

/**
 * Store 購読フック。Store が更新されると再レンダリングする。
 */
export function useCaptureStream() {
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    return captureStreamStore.subscribe(() => forceUpdate());
  }, []);
  return {
    captureStream: captureStreamStore.getStream(),
    captureSurface: captureStreamStore.getSurface(),
    captureError: captureStreamStore.getError(),
    startScreenShare: () => captureStreamStore.start(),
    stopScreenShare: () => captureStreamStore.stop(),
    clearCaptureError: () => captureStreamStore.setError(null),
  };
}
