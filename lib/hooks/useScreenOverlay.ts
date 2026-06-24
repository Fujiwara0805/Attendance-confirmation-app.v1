'use client';

/**
 * スクリーン画面（present）のオーバーレイ表示を、ホスト管理画面と
 * スクリーン画面の間で同期するフック。
 *
 * 現状は「参加QRコードの拡大表示（enlarged）」の ON/OFF のみを扱う。
 * 表示状態は永続化不要の揮発的コマンドのため、DB（postgres_changes）ではなく
 * Supabase Realtime の **broadcast** で同期する。`broadcast.self:false` のため、
 * ホスト・present のどちらの端末から切り替えても相手側へ反映される
 * （ホストのボタン表示と present のモーダルが常に一致する）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserClient } from '@/lib/supabase';

const QR_EVENT = 'qr-enlarged';

export function useScreenQrOverlay(roomId: string | null) {
  const [enlarged, setEnlargedState] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId) {
      channelRef.current = null;
      return;
    }

    const supabase = createBrowserClient();
    const channel = supabase.channel(`room-screen-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: QR_EVENT }, ({ payload }) => {
        setEnlargedState(!!(payload as { visible?: boolean })?.visible);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // ローカル state を更新しつつ、相手端末へ broadcast する。
  // roomId 未設定（チャンネル未確立）でもローカル state は更新され、
  // present 単独でのローカル開閉は従来どおり機能する。
  const setEnlarged = useCallback((visible: boolean) => {
    setEnlargedState(visible);
    channelRef.current?.send({
      type: 'broadcast',
      event: QR_EVENT,
      payload: { visible },
    });
  }, []);

  return { enlarged, setEnlarged };
}
