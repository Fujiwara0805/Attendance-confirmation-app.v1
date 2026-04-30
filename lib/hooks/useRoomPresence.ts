'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

/**
 * Realtime presence で参加者数をライブ集計するフック。
 * Realtime が落ちている間は最後に観測した値を保持する（UIフリッカ防止）。
 */
export function useRoomPresence(roomId: string | null, participantId: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const supabase = createBrowserClient();
    const channel = supabase.channel(`room-presence-${roomId}`, {
      config: { presence: { key: participantId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ joined_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, participantId]);

  return count;
}
