'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { extractPollPayload, type PollOption } from '@/lib/pollModes';

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
  display_x?: number | null;
  display_y?: number | null;
  group_label?: string | null;
  display_order?: number | null;
  is_pinned?: boolean | null;
  response_color?: string | null;
  response_author_name?: string | null;
  response_is_anonymous?: boolean | null;
}

// polls の TOAST 対象（extended storage）カラム。Postgres の論理レプリケーションは、
// これらの大きいカラムが UPDATE で変更されていない場合「unchanged toast」プレースホルダを送り、
// Supabase Realtime ではそれが null として届く。例えば status だけを更新する「表示する／締切」操作では、
// 変更していない options（クイズなどカードが大きいほど TOAST 化されやすい）が null で来てしまい、
// カードを丸ごと置換すると extractPollPayload(null) が mode:'standard' を返し、
// クイズが通常投票として描画されてしまう。
// これらの列はアプリ上いずれも実質 NOT NULL（DB 制約 or 常に配列）で、意図的に null になることはないため、
// realtime で null が来たら「未変更」とみなして既存値を保持する。容量・カード種別に依存しない恒久対策。
// 一方 started_at 等の小さい列は plain storage で常に正しく届くため対象外（activation 時の意図的な null を壊さない）。
const POLL_TOASTABLE_KEYS: ReadonlyArray<keyof Poll> = ['question', 'type', 'options', 'status'];

function mergePollUpdate(prev: Poll, incoming: Poll): Poll {
  const merged = { ...prev, ...incoming };
  for (const key of POLL_TOASTABLE_KEYS) {
    if (incoming[key] == null && prev[key] != null) {
      (merged as Record<keyof Poll, unknown>)[key] = prev[key];
    }
  }
  return merged;
}

// 締切直後の権威的同期オフセット（締切起点）。投票時間ありの poll は、締切間際に届いた票が
// realtime のトリックル配信だけでは全て揃わないことがある（バースト時の遅延）。締切と締切後の数点で
// DB から該当 poll の票を取り直し、画面の reveal（締切+SETTLE）までに件数を確定させる。
const DEADLINE_SYNC_OFFSETS_MS = [0, 2000, 4000];

// Realtime 切断中のみ短間隔でフェッチ
const FALLBACK_POLL_INTERVAL_MS = 5000;
// Realtime 接続中の保険ポーリング。Disk IO 削減のため大幅に長くし、
// かつ重い polls.options ではなく poll_votes のみ取り直す（poll 変更は realtime で来る）。
const SAFETY_POLL_INTERVAL_MS = 60000;

export function useRealtimePolls(
  roomId: string | null,
  options: { subscribeVotes?: boolean } = {}
) {
  // subscribeVotes=false: 個別票（poll_votes）の購読・取得を一切行わない。
  // 1,000人規模の参加者画面では、全票のファンアウト（人数×票数のイベント）を避けるため
  // 票を購読せず、集計値は別途 useActivePollAggregate で取得する。
  // host/present/stage は既定（true）のままで挙動は変わらない。
  const subscribeVotes = options.subscribeVotes !== false;
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
        .select('*')
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
        if (subscribeVotes) {
          await refetchVotes(pollsData.map((p) => p.id));
        } else {
          setPollVotes({});
        }
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

    // realtime 接続中の保険ポーリング（票だけ追いつき同期、60s 間隔で Disk IO を削減）。
    // 票を購読しないモードでは不要。
    if (subscribeVotes) {
      safetyTimer = setInterval(safetyRefetch, SAFETY_POLL_INTERVAL_MS);
    }

    let channelBuilder = supabase
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
              case 'UPDATE': {
                const newRow = payload.new as Poll;
                return prev.map((p) =>
                  p.id === newRow.id ? mergePollUpdate(p, newRow) : p
                );
              }
              case 'DELETE':
                return prev.filter((p) => p.id !== (payload.old as { id: string }).id);
              default:
                return prev;
            }
          });
        }
      );

    // 個別票の購読は subscribeVotes=true のときのみ。参加者画面（false）では張らない。
    if (subscribeVotes) {
      channelBuilder = channelBuilder
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
        );
    }

    const channel = channelBuilder.subscribe((status) => {
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
  }, [roomId, upsertVote, subscribeVotes]);

  // 投票時間ありの active poll について、締切前後で DB から票を権威的に取り直す。
  // realtime は個別 INSERT を順次配信するため、締切間際の一括送信（バースト）では reveal までに
  // 全票が届かず件数が不足することがある。締切起点の数点で取り直し、reveal 時に件数を確定させる。
  // 依存は「active な timed poll の id:started_at 署名」に限定し、票の到着では再実行しない。
  // フィールド区切りは '|'（started_at の ISO 文字列にコロンが含まれるため ':' は使わない）。
  const timedPollSignature = polls
    .filter((p) => p.status === 'active' && p.started_at)
    .map((p) => {
      const timeLimit = Number(extractPollPayload(p.options).meta.timeLimitSeconds || 0);
      return timeLimit > 0 ? `${p.id}|${p.started_at}|${timeLimit}` : '';
    })
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!subscribeVotes || !timedPollSignature) return;
    const supabase = createBrowserClient();
    let cancelled = false;

    const syncOne = async (pollId: string) => {
      const { data } = await supabase
        .from('poll_votes')
        .select('*')
        .eq('poll_id', pollId)
        .is('cleared_at', null);
      if (cancelled || !data) return;
      // 該当 poll の票を権威的に置換（realtime のトリックル遅延に依存せず確定値にする）。
      setPollVotes((prev) => ({ ...prev, [pollId]: data as PollVote[] }));
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const entry of timedPollSignature.split(',')) {
      const [pollId, startedAt, timeLimitStr] = entry.split('|');
      const startedAtMs = new Date(startedAt).getTime();
      const timeLimitMs = Number(timeLimitStr) * 1000;
      if (!Number.isFinite(startedAtMs) || !Number.isFinite(timeLimitMs)) continue;
      const deadlineMs = startedAtMs + timeLimitMs;
      for (const offset of DEADLINE_SYNC_OFFSETS_MS) {
        const delay = deadlineMs + offset - Date.now();
        // 締切が遠すぎる未来は予約のみ。締切から大きく過ぎた点はスキップ（無駄打ち防止）。
        if (delay < -60000) continue;
        timers.push(setTimeout(() => void syncOne(pollId), Math.max(0, delay)));
      }
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [timedPollSignature, subscribeVotes]);

  const activePolls = polls.filter((p) => p.status === 'active');
  const activePoll = activePolls[0] || null;

  return {
    polls,
    pollVotes,
    activePoll,
    activePolls,
    loading,
    connected,
    optimisticDeletePoll,
    optimisticUpsertPoll,
  };
}
