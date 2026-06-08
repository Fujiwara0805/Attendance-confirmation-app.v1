'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { extractPollPayload, getPollMode } from '@/lib/pollModes';
import type { Poll, PollVote } from './useRealtimePolls';

// 集計ポーリング間隔（参加者画面のライブ集計）。個別票を購読しない代わりにこの間隔で集計値だけ取得する。
const AGGREGATE_INTERVAL_MS = 4000;
// 自分の票の追従取得間隔（自分の投票後の整合性のため、集計より低頻度で十分）。
const OWN_REFETCH_INTERVAL_MS = 16000;
// ranking/free_text の取りこぼし保険ポーリング。
const SAFETY_REFETCH_MS = 60000;

type AggregateRow = { option_index: number; value: string | null; cnt: number };

// 集計のみで結果描画が成立するモード（option_index ごとの件数だけで足りる）。
// standard: 結果バーは option_index 件数のみ。quiz: 正誤はクライアントが自分の回答で判定、
// 棒グラフは option_index 件数のみ。→ 個別票を配る必要がない（1,000人規模の主因を排除）。
function usesAggregate(mode: string | null): boolean {
  return mode === 'standard' || mode === 'quiz';
}

// 集計値から PollVote[] を合成する。
// 自分の票だけは実データを保持し、他者票は集計件数ぶんの匿名行を合成する。
// これにより「あなたの回答」（自分の participant_id 一致行）も、集計バー（option_index 件数）も両立する。
function synthesizeVotes(
  pollId: string,
  startedAt: string | null,
  ownVotes: PollVote[],
  rows: AggregateRow[]
): PollVote[] {
  // 自分の票を (option_index, value) キーで数え、集計から差し引いて二重計上を防ぐ
  const ownByKey = new Map<string, number>();
  for (const v of ownVotes) {
    if (typeof v.option_index !== 'number') continue;
    const key = `${v.option_index}::${v.value ?? ''}`;
    ownByKey.set(key, (ownByKey.get(key) || 0) + 1);
  }
  const createdAt = startedAt || new Date(0).toISOString();
  const synthetic: PollVote[] = [];
  let seq = 0;
  for (const row of rows) {
    const key = `${row.option_index}::${row.value ?? ''}`;
    const remaining = Math.max(0, row.cnt - (ownByKey.get(key) || 0));
    for (let i = 0; i < remaining; i++) {
      synthetic.push({
        id: `agg-${pollId}-${row.option_index}-${row.value ?? ''}-${seq}`,
        poll_id: pollId,
        participant_id: `agg-${seq}`,
        option_index: row.option_index,
        value: row.value,
        created_at: createdAt,
      });
      seq++;
    }
  }
  return [...ownVotes, ...synthetic];
}

/**
 * 参加者画面で「現在表示中の1枚」の投票データだけを供給するフック。
 *
 * 旧構成は useRealtimePolls がルーム内の全 poll_votes を購読しており、
 * 1,000人 × 50問 = 5万行が全クライアントへファンアウトしていた。
 * 本フックは表示中のアクティブ投票1枚に対象を絞り、さらにモードで方式を分ける:
 *  - standard / quiz（票数が最も多い・結果は集計のみで成立）: 個別票を購読せず、
 *    集計 RPC を間引きポーリング＋自分の票だけ実取得して合成。
 *  - ranking / free_text（順位や本文など行ごとの中身が必要・票数の乗数は小さい）:
 *    その poll の票だけを realtime 購読（ルーム全体ではない）。
 *
 * 返り値は ActivePollCard がそのまま使える PollVote[]。
 */
export function useActivePollVotes(
  activePoll: Poll | null,
  participantId: string | null
): PollVote[] {
  const [votes, setVotes] = useState<PollVote[]>([]);
  const ownVotesRef = useRef<PollVote[]>([]);

  const pollId = activePoll?.id ?? null;
  const startedAt = activePoll?.started_at ?? null;
  const mode = activePoll ? getPollMode(extractPollPayload(activePoll.options).meta.mode) : null;
  const aggregate = usesAggregate(mode);

  useEffect(() => {
    if (!pollId) {
      setVotes([]);
      ownVotesRef.current = [];
      return;
    }

    const supabase = createBrowserClient();
    let cancelled = false;

    // --- standard / quiz: 集計ポーリング方式 ---
    if (aggregate) {
      const fetchOwn = async () => {
        if (!participantId) {
          ownVotesRef.current = [];
          return;
        }
        const { data } = await supabase
          .from('poll_votes')
          .select('*')
          .eq('poll_id', pollId)
          .eq('participant_id', participantId)
          .is('cleared_at', null);
        if (!cancelled && data) ownVotesRef.current = data as PollVote[];
      };

      const tick = async () => {
        const { data, error } = await supabase.rpc('get_poll_vote_counts', {
          p_poll_ids: [pollId],
        });
        if (cancelled || error) return;
        const rows = (data as AggregateRow[]) || [];
        setVotes(synthesizeVotes(pollId, startedAt, ownVotesRef.current, rows));
      };

      void (async () => {
        await fetchOwn();
        await tick();
      })();
      const aggTimer = setInterval(tick, AGGREGATE_INTERVAL_MS);
      const ownTimer = setInterval(() => {
        void (async () => {
          await fetchOwn();
          await tick();
        })();
      }, OWN_REFETCH_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(aggTimer);
        clearInterval(ownTimer);
      };
    }

    // --- ranking / free_text: その poll の票だけを realtime 購読 ---
    const refetch = async () => {
      const { data } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('poll_id', pollId)
        .is('cleared_at', null);
      if (!cancelled && data) setVotes(data as PollVote[]);
    };

    const upsert = (v: PollVote) => {
      setVotes((prev) => {
        const list = [...prev];
        const idx = list.findIndex((x) => x.id === v.id);
        if (v.cleared_at) {
          if (idx >= 0) list.splice(idx, 1);
        } else if (idx >= 0) {
          list[idx] = v;
        } else {
          list.push(v);
        }
        return list;
      });
    };

    void refetch();
    const channel = supabase
      .channel(`active-poll-votes-${pollId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` },
        (payload) => upsert(payload.new as PollVote)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` },
        (payload) => upsert(payload.new as PollVote)
      )
      .subscribe();
    const safetyTimer = setInterval(refetch, SAFETY_REFETCH_MS);

    return () => {
      cancelled = true;
      clearInterval(safetyTimer);
      supabase.removeChannel(channel);
    };
  }, [pollId, startedAt, aggregate, participantId]);

  return votes;
}
