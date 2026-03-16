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

    // Realtime subscription
    const channel = supabase
      .channel(`room-questions-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'questions',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setQuestions((prev) => {
          switch (payload.eventType) {
            case 'INSERT':
              return sortQuestions([...prev, payload.new as Question]);
            case 'UPDATE':
              return sortQuestions(
                prev.map((q) => (q.id === (payload.new as Question).id ? (payload.new as Question) : q))
              );
            case 'DELETE':
              return prev.filter((q) => q.id !== (payload.old as { id: string }).id);
            default:
              return prev;
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, sortQuestions]);

  return { questions, loading };
}
