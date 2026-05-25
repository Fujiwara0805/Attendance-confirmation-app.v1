'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useCaptureStream } from '@/lib/captureStreamStore';

/**
 * ルーム配下の共通 Layout。
 *
 * 役割:
 *   stage と present で共有する画面共有 MediaStream を「ウォーム」な状態に保つために、
 *   非表示の "keep-alive" video 要素を常設する。
 *
 *   背景:
 *     画面共有ストリームを stage の video 要素にバインドしてから unmount し、
 *     再 mount した別 video 要素に同じストリームを attach し直すと、Chrome では
 *     canplay/playing が発火せずローディングのまま固まる挙動が観測される。
 *     Layout に常駐する非表示 video を介してストリームを常時接続しておくことで、
 *     ストリームが宙に浮く瞬間を作らず、stage 側の表示用 video へ自然に映像が
 *     流れるようにする。
 *
 *   MediaStream の保持自体は `lib/captureStreamStore` のモジュールスコープに
 *   持たせているので、Layout は表示の補助に徹する。
 */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KeepAliveVideo />
      {children}
    </>
  );
}

function KeepAliveVideo() {
  const { captureStream } = useCaptureStream();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.srcObject !== captureStream) {
      v.srcObject = captureStream;
    }
    if (captureStream) {
      v.play().catch(() => {
        /* 非表示 video の play エラーは無視 */
      });
    }
  }, [captureStream]);

  return (
    <video
      ref={videoRef}
      muted
      autoPlay
      playsInline
      controls={false}
      aria-hidden="true"
      tabIndex={-1}
      // 視覚的にもアクセシビリティ的にも完全に存在しないように見せる
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
}
