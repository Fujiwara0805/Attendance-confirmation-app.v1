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

/**
 * 操作ハブ（ホストのステージ管理タブ）と投影窓（present / stage）の間で、
 * 「操作コマンド」と「現在の画面状態」を broadcast 同期する。
 *
 * 揮発的な操作・状態のため DB ではなく Realtime broadcast を使う。QR表示は
 * 既存 `useScreenQrOverlay`（別チャネル）が担うため、ここは触れない。
 */
export type ScreenName = 'present' | 'stage';
export type PresentView = 'qa' | 'poll';

export type ScreenCommand =
  | { type: 'present-view'; view: PresentView }
  | { type: 'navigate'; target: ScreenName; view?: PresentView }
  | { type: 'stage-chat'; collapsed: boolean }
  | { type: 'stage-stop' }
  | { type: 'stage-fullscreen' };

export type ScreenState = {
  screen: ScreenName;
  view?: PresentView;
  chatCollapsed?: boolean;
  qrVisible?: boolean;
  hasDoc?: boolean;
  capturing?: boolean;
};

const CMD_EVENT = 'screen-cmd';
const STATE_EVENT = 'screen-state';
const REQUEST_STATE_EVENT = 'request-state';

function controlChannelName(roomId: string) {
  return `room-control-${roomId}`;
}

// 操作側（ホストのステージ管理タブ）。投影窓へコマンドを送り、最新状態を受け取る。
// 投影窓（present/stage）は presence を track するため、`screenOpen` で
// 「スクリーンが開いているか」を判定できる（窓を閉じれば leave で false に戻る）。
export function useScreenControl(roomId: string | null) {
  const [screenState, setScreenState] = useState<ScreenState | null>(null);
  const [screenOpen, setScreenOpen] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomId) {
      channelRef.current = null;
      return;
    }

    const supabase = createBrowserClient();
    const channel = supabase.channel(controlChannelName(roomId), {
      config: { broadcast: { self: false } },
    });

    const clearCloseTimer = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    // 投影窓が「開いている」と確実に分かったとき（状態受信 or presence join）。
    const markOpen = () => {
      clearCloseTimer();
      setScreenOpen(true);
    };
    // presence から投影窓の有無を判定。present↔stage 遷移の一瞬の離脱は猶予で吸収。
    const recomputeFromPresence = () => {
      const hasDisplay = Object.keys(channel.presenceState()).length > 0;
      if (hasDisplay) {
        markOpen();
      } else {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
          setScreenOpen(false);
          setScreenState(null);
        }, 1500);
      }
    };

    channel
      .on('broadcast', { event: STATE_EVENT }, ({ payload }) => {
        const state = (payload as { state?: ScreenState | null })?.state ?? null;
        setScreenState(state);
        // 状態を受信した = 投影窓が生きている。broadcast は presence より確実なので
        // これを「開いている」判定の主軸にする（presence は閉じ検知に使う）。
        if (state) markOpen();
      })
      .on('presence', { event: 'sync' }, recomputeFromPresence)
      .on('presence', { event: 'join' }, markOpen)
      .on('presence', { event: 'leave' }, recomputeFromPresence)
      .subscribe((status) => {
        // 後から操作画面を開いたとき、投影窓へ現在状態の再送を促す。
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: REQUEST_STATE_EVENT, payload: {} });
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendCommand = useCallback((cmd: ScreenCommand) => {
    channelRef.current?.send({ type: 'broadcast', event: CMD_EVENT, payload: { cmd } });
  }, []);

  return { screenState, screenOpen, sendCommand };
}

// 表示側（present / stage）。コマンドを購読して反映し、自分の画面状態を publish する。
export function useScreenDisplay(
  roomId: string | null,
  onCommand: (cmd: ScreenCommand) => void,
  state: ScreenState
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!roomId) {
      channelRef.current = null;
      return;
    }

    const supabase = createBrowserClient();
    const channel = supabase.channel(controlChannelName(roomId), {
      config: { broadcast: { self: false } },
    });

    const publish = () => {
      channel.send({ type: 'broadcast', event: STATE_EVENT, payload: { state: stateRef.current } });
    };

    channel
      .on('broadcast', { event: CMD_EVENT }, ({ payload }) => {
        const cmd = (payload as { cmd?: ScreenCommand })?.cmd;
        if (cmd) onCommandRef.current(cmd);
      })
      .on('broadcast', { event: REQUEST_STATE_EVENT }, () => {
        publish();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          publish();
          // 操作側が「スクリーンが開いている」と判定できるよう presence を track。
          void channel.track({ role: 'display' });
        }
      });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 画面状態が変わるたびに publish（オブジェクト参照ではなく中身で判定）。
  const signature = JSON.stringify(state);
  useEffect(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: STATE_EVENT,
      payload: { state: stateRef.current },
    });
  }, [signature]);
}
