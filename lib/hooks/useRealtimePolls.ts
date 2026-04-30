'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export interface Poll {
  id: string;
  room_id: string;
  question: string;
  type: 'multiple_choice' | 'word_cloud' | 'rating';
  options: string[];
  status: 'draft' | 'active' | 'closed';
  allow_multiple: boolean;
  max_selections?: number | null;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  participant_id: string;
  option_index: number | null;
  value: string | null;
  created_at: string;
}

const FALLBACK_POLL_INTERVAL_MS = 5000;
const SAFETY_POLL_INTERVAL_MS = 8000;

export function useRealtimePolls(roomId: string | null) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // 即時に投票を反映（同じ participant の重複を upsert で防止）
  const upsertVote = useCallback((v: PollVote) => {
    setPollVotes((prev) => {
      const next = { ...prev };
      const list = next[v.poll_id] ? [...next[v.poll_id]] : [];
      const idx = list.findIndex(
        (x) => x.id === v.id || x.participant_id === v.participant_id
      );
      if (idx >= 0) list[idx] = v;
      else list.push(v);
      next[v.poll_id] = list;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createBrowserClient();
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setInterval> | null = null;

    const fetchAll = async () => {
      const { data: pollsData } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (pollsData) {
        setPolls(pollsData as Poll[]);
        const pollIds = pollsData.map((p) => p.id);
        if (pollIds.length > 0) {
          const { data: votesData } = await supabase
            .from('poll_votes')
            .select('*')
            .in('poll_id', pollIds);

          if (votesData && !cancelled) {
            const grouped: Record<string, PollVote[]> = {};
            (votesData as PollVote[]).forEach((v) => {
              if (!grouped[v.poll_id]) grouped[v.poll_id] = [];
              grouped[v.poll_id].push(v);
            });
            setPollVotes(grouped);
          }
        } else {
          setPollVotes({});
        }
      }
      setLoading(false);
    };

    fetchAll();

    const startFallbackPolling = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(fetchAll, FALLBACK_POLL_INTERVAL_MS);
    };
    const stopFallbackPolling = () => {
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    // realtime が繋がっていてもイベント取りこぼし対策で常に保険ポーリング
    safetyTimer = setInterval(fetchAll, SAFETY_POLL_INTERVAL_MS);

    const channel = supabase
      .channel(`room-polls-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'polls',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setPolls((prev) => {
            switch (payload.eventType) {
              case 'INSERT':
                if (prev.some((p) => p.id === (payload.new as Poll).id)) return prev;
                return [payload.new as Poll, ...prev];
              case 'UPDATE':
                return prev.map((p) =>
                  p.id === (payload.new as Poll).id ? (payload.new as Poll) : p
                );
              case 'DELETE':
                return prev.filter((p) => p.id !== (payload.old as { id: string }).id);
              default:
                return prev;
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'poll_votes',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => upsertVote(payload.new as PollVote)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poll_votes',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => upsertVote(payload.new as PollVote)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          stopFallbackPolling();
          fetchAll();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
          startFallbackPolling();
        }
      });

    // 初回接続前から速いポーリングを走らせて即時性を担保
    startFallbackPolling();

    return () => {
      cancelled = true;
      stopFallbackPolling();
      if (safetyTimer) {
        clearInterval(safetyTimer);
        safetyTimer = null;
      }
      supabase.removeChannel(channel);
    };
  }, [roomId, upsertVote]);

  const activePoll = polls.find((p) => p.status === 'active') || null;

  return { polls, pollVotes, activePoll, loading, connected };
}
