'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export interface Poll {
  id: string;
  room_id: string;
  question: string;
  type: 'multiple_choice' | 'word_cloud' | 'rating';
  options: string[];
  status: 'draft' | 'active' | 'closed';
  allow_multiple: boolean;
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

export function useRealtimePolls(roomId: string | null) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const supabase = createBrowserClient();

    // Initial fetch
    const fetchData = async () => {
      const { data: pollsData } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (pollsData) {
        setPolls(pollsData);

        const pollIds = pollsData.map((p) => p.id);
        if (pollIds.length > 0) {
          const { data: votesData } = await supabase
            .from('poll_votes')
            .select('*')
            .in('poll_id', pollIds);

          if (votesData) {
            const grouped: Record<string, PollVote[]> = {};
            votesData.forEach((v) => {
              if (!grouped[v.poll_id]) grouped[v.poll_id] = [];
              grouped[v.poll_id].push(v);
            });
            setPollVotes(grouped);
          }
        }
      }
      setLoading(false);
    };

    fetchData();

    // Realtime subscriptions
    const channel = supabase
      .channel(`room-polls-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setPolls((prev) => {
          switch (payload.eventType) {
            case 'INSERT':
              return [payload.new as Poll, ...prev];
            case 'UPDATE':
              return prev.map((p) => (p.id === (payload.new as Poll).id ? (payload.new as Poll) : p));
            case 'DELETE':
              return prev.filter((p) => p.id !== (payload.old as { id: string }).id);
            default:
              return prev;
          }
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'poll_votes',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const vote = payload.new as PollVote;
        setPollVotes((prev) => ({
          ...prev,
          [vote.poll_id]: [...(prev[vote.poll_id] || []), vote],
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const activePoll = polls.find((p) => p.status === 'active') || null;

  return { polls, pollVotes, activePoll, loading };
}
