'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { PollOption } from '@/lib/pollModes';

export interface Poll {
  id: string;
  room_id: string;
  question: string;
  type: 'multiple_choice' | 'word_cloud' | 'rating' | 'quiz' | 'ranking' | string;
  options: PollOption[];
  status: 'draft' | 'active' | 'closed';
  allow_multiple: boolean;
  max_selections?: number | null;
  created_at: string;
  /** active 遷移時に DB がセットするサーバー時刻。全問共通タイマーの開始基準。 */
  started_at?: string | null;
}

export interface PollVote {
  id: string;
  poll_id: string;
  participant_id: string;
  option_index: number | null;
  value: string | null;
  created_at: string;
  /** リセット時刻。NULL = ライブ（現在の実施回）／非NULL = アーカイブ（過去回）。 */
  cleared_at?: string | null;
}

// Realtime 切断中のみ短間隔でフェッチ
const FALLBACK_POLL_INTERVAL_MS = 5000;
// Realtime 接続中の保険ポーリング。Disk IO 削減のため大幅に長くし、
// かつ重い polls.options ではなく poll_votes のみ取り直す（poll 変更は realtime で来る）。
const SAFETY_POLL_INTERVAL_MS = 60000;

export function useRealtimePolls(roomId: string | null) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // 即時に投票を反映（複数選択・順位投票は同一 participant で複数行を持つ）
  // cleared_at が付与された UPDATE（アーカイブ）は state から除去する。
  const upsertVote = useCallback((v: PollVote) => {
    setPollVotes((prev) => {
      const next = { ...prev };
      const list = next[v.poll_id] ? [...next[v.poll_id]] : [];
      const idx = list.findIndex((x) => x.id === v.id);
      if (v.cleared_at) {
        if (idx >= 0) list.splice(idx, 1);
      } else if (idx >= 0) {
        list[idx] = v;
      } else {
        list.push(v);
      }
      next[v.poll_id] = list;
      return next;
    });
  }, []);

  const optimisticDeletePoll = useCallback((pollId: string) => {
    setPolls((prev) => prev.filter((p) => p.id !== pollId));
    setPollVotes((prev) => {
      if (!prev[pollId]) return prev;
      const next = { ...prev };
      delete next[pollId];
      return next;
    });
  }, []);

  const optimisticUpsertPoll = useCallback((poll: Poll, options?: { clearVotes?: boolean }) => {
    setPolls((prev) => {
      const exists = prev.some((p) => p.id === poll.id);
      const next = exists ? prev.map((p) => (p.id === poll.id ? poll : p)) : [poll, ...prev];
      return [...next].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
    if (options?.clearVotes) {
      setPollVotes((prev) => {
        if (!prev[poll.id]) return prev;
        return { ...prev, [poll.id]: [] };
      });
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createBrowserClient();
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setInterval> | null = null;

    // 集計: poll_id 配列から poll_votes をフェッチして state に反映（ライブ＝cleared_at IS NULL のみ）
    const refetchVotes = async (pollIds: string[]) => {
      if (pollIds.length === 0) {
        setPollVotes({});
        return;
      }
      const { data: votesData } = await supabase
        .from('poll_votes')
        .select('id, poll_id, participant_id, option_index, value, created_at, cleared_at')
        .in('poll_id', pollIds)
        .is('cleared_at', null);
      if (cancelled || !votesData) return;
      const grouped: Record<string, PollVote[]> = {};
      (votesData as PollVote[]).forEach((v) => {
        if (!grouped[v.poll_id]) grouped[v.poll_id] = [];
        grouped[v.poll_id].push(v);
      });
      setPollVotes(grouped);
    };

    // 全件（polls + poll_votes）: 初回と切断時のリカバリでのみ使用
    const fetchAll = async () => {
      const { data: pollsData } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (pollsData) {
        setPolls(pollsData as Poll[]);
        await refetchVotes(pollsData.map((p) => p.id));
      }
      setLoading(false);
    };

    // 保険ポーリング: 重い polls.options は取らず、poll_votes だけ追いつき同期
    const safetyRefetch = async () => {
      const { data: pollsData } = await supabase
        .from('polls')
        .select('id')
        .eq('room_id', roomId);
      if (cancelled || !pollsData) return;
      await refetchVotes(pollsData.map((p) => p.id));
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

    // realtime 接続中の保険ポーリング（票だけ追いつき同期、60s 間隔で Disk IO を削減）
    safetyTimer = setInterval(safetyRefetch, SAFETY_POLL_INTERVAL_MS);

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

  return {
    polls,
    pollVotes,
    activePoll,
    loading,
    connected,
    optimisticDeletePoll,
    optimisticUpsertPoll,
  };
}
