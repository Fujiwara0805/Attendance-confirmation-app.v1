'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface CaptureStreamContextValue {
  captureStream: MediaStream | null;
  captureSurface: string | null;
  captureError: string | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  clearCaptureError: () => void;
}

const CaptureStreamContext = createContext<CaptureStreamContextValue | null>(null);

export function useCaptureStream(): CaptureStreamContextValue {
  const ctx = useContext(CaptureStreamContext);
  if (!ctx) {
    throw new Error('useCaptureStream must be used within /rooms/[roomCode]/layout');
  }
  return ctx;
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const [captureSurface, setCaptureSurface] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  // ルーム離脱時のクリーンアップで参照するため、最新ストリームを ref に保持。
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    streamRef.current = captureStream;
  }, [captureStream]);

  const stopScreenShare = useCallback(() => {
    setCaptureSurface(null);
    setCaptureStream((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const clearCaptureError = useCallback(() => setCaptureError(null), []);

  const startScreenShare = useCallback(async () => {
    setCaptureError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCaptureError('このブラウザでは画面共有を利用できません。Chrome または Edge でお試しください。');
      return;
    }

    try {
      // 既存ストリームがあれば停止してから取り直す。
      streamRef.current?.getTracks().forEach((track) => track.stop());

      // CaptureController で「共有先にフォーカスを移さない」よう指示する。
      // これを使わないと Chrome/Edge は共有対象のタブ/ウィンドウへ自動でフォーカスを移し、
      // ざせきくんの画面から離れてしまう。
      const CaptureControllerCtor = (
        window as unknown as {
          CaptureController?: new () => {
            setFocusBehavior: (behavior: 'focus-captured-surface' | 'no-focus-change') => void;
          };
        }
      ).CaptureController;
      const controller = CaptureControllerCtor ? new CaptureControllerCtor() : undefined;
      const stream = await navigator.mediaDevices.getDisplayMedia({
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
        // 一度しか呼べず、呼び出しが遅すぎると例外になるため握りつぶす。
        controller?.setFocusBehavior('no-focus-change');
      } catch {
        /* CaptureController 非対応／呼び出しタイミング超過時は無視 */
      }
      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings() as MediaTrackSettings & { displaySurface?: string };
      setCaptureSurface(settings?.displaySurface || null);
      track?.addEventListener('ended', () => {
        setCaptureSurface(null);
        setCaptureStream(null);
      });
      setCaptureStream(stream);
      // CaptureController 非対応ブラウザ向けのフォールバック（従来挙動を維持）
      if (!controller) {
        window.setTimeout(() => window.focus(), 200);
      }
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'NotAllowedError';
      setCaptureError(isAbort ? '資料の取り込みがキャンセルされました。' : '資料画面の取り込みに失敗しました。');
    }
  }, []);

  // ルーム配下から離脱したら必ずトラックを停止する。
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <CaptureStreamContext.Provider
      value={{
        captureStream,
        captureSurface,
        captureError,
        startScreenShare,
        stopScreenShare,
        clearCaptureError,
      }}
    >
      {children}
    </CaptureStreamContext.Provider>
  );
}
