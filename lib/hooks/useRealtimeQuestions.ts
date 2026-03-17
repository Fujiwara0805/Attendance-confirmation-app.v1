'use client';

import { useState, useEffect, useCallback } from 'react';
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
}

export function useRealtimeQuestions(roomId: string | null) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const sortQuestions = useCallback((qs: Question[]) => {
    return [...qs].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.upvote_count - a.upvote_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, []);

  // 楽観的削除: UI即時反映 → DB削除は呼び出し側で実行
  const optimisticDelete = useCallback((questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createBrowserClient();

    // Initial fetch
    supabase
      .from('questions')
      .select('*')
      .eq('room_id', roomId)
      .order('upvote_count', { ascending: false })
      .then(({ data }) => {
        if (data) setQuestions(sortQuestions(data));
        setLoading(false);
      });

    // INSERT/UPDATE はフィルタ付きチャンネルで受信
    // (DELETE は payload.old に room_id が含まれないためフィルタにマッチしない
    //  → 楽観的削除で対応)
    const channel = supabase
      .channel(`room-questions-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'questions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setQuestions((prev) => {
          // 楽観的追加で既に存在する場合は重複を避ける
          if (prev.some((q) => q.id === (payload.new as Question).id)) return prev;
          return sortQuestions([...prev, payload.new as Question]);
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'questions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setQuestions((prev) =>
          sortQuestions(
            prev.map((q) => (q.id === (payload.new as Question).id ? (payload.new as Question) : q))
          )
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'questions',
      }, (payload) => {
        // フィルタなしで全 DELETE を受信し、ローカル state に存在するもののみ処理
        const deletedId = (payload.old as { id: string }).id;
        setQuestions((prev) => prev.filter((q) => q.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, sortQuestions]);

  return { questions, loading, optimisticDelete };
}
