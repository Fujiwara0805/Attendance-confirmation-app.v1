'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export interface Question {
  id: string;
  room_id: string;
  text: string;
  author_name: string;
  is_anonymous: boolean;
  upvote_count: number;
  is_answered: boolean;
  is_pinned: boolean;
  created_at: string;
  deleted_at?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  participant_id?: string | null;
}

interface Options {
  participantOnly?: boolean; // 参加者画面ではモデレーション通過分のみ
  ownIds?: Set<string>;       // 自分が投稿した質問は pending でも表示
}

// Realtime が落ちている場合の保険ポーリング間隔
const FALLBACK_POLL_INTERVAL_MS = 5000;
// Realtime 接続中の保険ポーリング（イベント取りこぼし対策）。
// Disk IO 削減のため大幅に長くする。realtime が機能していれば追加遅延は最大 60s 程度。
const SAFETY_POLL_INTERVAL_MS = 60000;

export function useRealtimeQuestions(
  roomId: string | null,
  { participantOnly = false, ownIds }: Options = {}
) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const sortQuestions = useCallback((qs: Question[]) => {
    return [...qs].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (
        b.upvote_count - a.upvote_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, []);

  const filterForView = useCallback(
    (qs: Question[]) => {
      const liveQuestions = qs.filter((q) => !q.deleted_at);
      if (!participantOnly) return liveQuestions;
      return liveQuestions.filter(
        (q) =>
          q.status === undefined ||
          q.status === 'approved' ||
          (q.status === 'pending' && ownIds && ownIds.has(q.id))
      );
    },
    [participantOnly, ownIds]
  );

  // 楽観的挿入: ユーザーが自分の投稿を即時画面に表示するため
  const sortRef = useRef(sortQuestions);
  sortRef.current = sortQuestions;

  // 楽観的削除/更新
  const optimisticDelete = useCallback((questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }, []);

  const optimisticUpdateUpvote = useCallback((questionId: string, nextCount: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, upvote_count: nextCount } : q))
    );
  }, []);

  const optimisticUpdateQuestions = useCallback((updates: Question[]) => {
    if (updates.length === 0) return;
    setQuestions((prev) => {
      const map = new Map(prev.map((q) => [q.id, q] as const));
      updates.forEach((q) => map.set(q.id, q));
      return sortRef.current(Array.from(map.values()));
    });
  }, []);

  const optimisticInsert = useCallback((q: Question) => {
    setQuestions((prev) => {
      if (prev.some((x) => x.id === q.id)) return prev;
      return sortRef.current([q, ...prev]);
    });
  }, []);

  // 即時 upsert: realtime / poll 経由のイベントを反映
  const upsertQuestion = useCallback((q: Question) => {
    setQuestions((prev) => {
      const map = new Map(prev.map((x) => [x.id, x] as const));
      map.set(q.id, q);
      return sortRef.current(Array.from(map.values()));
    });
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createBrowserClient();
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setInterval> | null = null;

    const fetchAll = async () => {
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', roomId)
        .is('deleted_at', null)
        .order('upvote_count', { ascending: false });
      if (cancelled) return;
      if (data) {
        setQuestions(sortRef.current(data as Question[]));
      }
      setLoading(false);
    };

    fetchAll();

    // realtime が落ちているときに走る速いポーリング
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

    // realtime が繋がっていてもイベントが取りこぼされる可能性があるため
    // 常に保険として軽いポーリングを並走させる（最新状態をリロードなしに同期）
    safetyTimer = setInterval(fetchAll, SAFETY_POLL_INTERVAL_MS);

    const channel = supabase
      .channel(`room-questions-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'questions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => upsertQuestion(payload.new as Question)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'questions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const next = payload.new as Question;
          if (next.deleted_at) removeQuestion(next.id);
          else upsertQuestion(next);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'questions',
        },
        (payload) => removeQuestion((payload.old as { id: string }).id)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          stopFallbackPolling();
          // 再接続時に取りこぼし対策で再フェッチ
          fetchAll();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
          startFallbackPolling();
        }
      });

    // 接続が確立する前から速いポーリングも走らせる（最初の接続が遅い場合に備える）
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
  }, [roomId, upsertQuestion, removeQuestion]);

  return {
    questions: filterForView(questions),
    rawQuestions: questions,
    loading,
    connected,
    optimisticDelete,
    optimisticUpdateUpvote,
    optimisticUpdateQuestions,
    optimisticInsert,
  };
}
