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
let persistentVideo: HTMLVideoElement | null = null;
let hiddenVideoHost: HTMLDivElement | null = null;
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

function getHiddenVideoHost() {
  if (typeof document === 'undefined') return null;
  if (hiddenVideoHost && document.body.contains(hiddenVideoHost)) return hiddenVideoHost;

  hiddenVideoHost = document.createElement('div');
  hiddenVideoHost.setAttribute('data-capture-video-host', 'true');
  hiddenVideoHost.setAttribute('aria-hidden', 'true');
  Object.assign(hiddenVideoHost.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '2px',
    height: '2px',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0.01',
    zIndex: '0',
  });
  document.body.appendChild(hiddenVideoHost);
  return hiddenVideoHost;
}

function getPersistentVideo() {
  if (typeof document === 'undefined') return null;
  if (persistentVideo) return persistentVideo;

  persistentVideo = document.createElement('video');
  persistentVideo.muted = true;
  persistentVideo.autoplay = true;
  persistentVideo.playsInline = true;
  persistentVideo.controls = false;
  persistentVideo.setAttribute('aria-hidden', 'true');
  persistentVideo.tabIndex = -1;
  persistentVideo.disablePictureInPicture = true;
  return persistentVideo;
}

function syncPersistentVideo() {
  const video = persistentVideo;
  if (!video) return;
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  if (stream) {
    video.play().catch(() => {
      /* 表示側のイベント／再試行に任せる */
    });
  }
}

function setVisibleVideoStyles(video: HTMLVideoElement) {
  Object.assign(video.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'contain',
    background: '#000',
    opacity: '1',
    pointerEvents: 'none',
    zIndex: '0',
  });
}

function setParkedVideoStyles(video: HTMLVideoElement) {
  Object.assign(video.style, {
    position: 'absolute',
    inset: '0',
    width: '2px',
    height: '2px',
    display: 'block',
    objectFit: 'contain',
    background: '#000',
    opacity: '1',
    pointerEvents: 'none',
    zIndex: '0',
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
    syncPersistentVideo();

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
          syncPersistentVideo();
          emit();
        }
      });

      stream = next;
      surface = settings?.displaySurface || null;
      syncPersistentVideo();

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
    syncPersistentVideo();
    emit();
  },

  /**
   * 共有映像用の video 要素を表示コンテナへ移動する。
   * video DOM 自体を破棄しないことで、stage <-> present の遷移時に
   * Chrome が同じ MediaStream の再アタッチで黒画面になる挙動を避ける。
   */
  mountVideo(container: HTMLElement) {
    const video = getPersistentVideo();
    if (!video) return null;
    setVisibleVideoStyles(video);
    if (video.parentElement !== container) {
      container.prepend(video);
    }
    syncPersistentVideo();
    return video;
  },

  /**
   * video 要素を隠しホストへ退避して再生を維持する。
   */
  parkVideo() {
    const video = getPersistentVideo();
    const host = getHiddenVideoHost();
    if (!video || !host) return;
    setParkedVideoStyles(video);
    if (video.parentElement !== host) {
      host.appendChild(video);
    }
    syncPersistentVideo();
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
