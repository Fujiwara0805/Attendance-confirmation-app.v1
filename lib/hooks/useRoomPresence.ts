'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const HEARTBEAT_INTERVAL_MS = 15000; // 15秒ごとに鼓動（アクティブ判定窓は30秒）

/**
 * 参加者数をライブ集計するフック。
 *
 * 旧実装は Supabase Presence を使っていたが、Presence は join/leave のたびに
 * 全参加者の状態を全クライアントへ sync するため、参加者数 N に対して O(N^2) の
 * トラフィックになり 1,000 人規模で破綻する。
 *
 * 本実装は DB ハートビート方式に置き換える。各クライアントは 15 秒ごとに
 * `upsert_room_heartbeat` RPC を呼び、自分の last_seen を更新しつつ、直近 30 秒に
 * アクティブだった人数を受け取るだけ。クライアント間のファンアウトが無いため、
 * 人数によらず 1 クライアントあたり一定コスト（15 秒に 1 往復）で済む。
 * Realtime が落ちている間は最後に観測した値を保持する（UIフリッカ防止）。
 */
export function useRoomPresence(roomId: string | null, participantId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const supabase = createBrowserClient();
    let cancelled = false;

    const beat = async () => {
      const { data, error } = await supabase.rpc('upsert_room_heartbeat', {
        p_room_id: roomId,
        p_participant_id: participantId,
      });
      if (cancelled || error) return;
      if (typeof data === 'number') setCount(data);
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomId, participantId]);

  return count;
}
