// DELETE /api/rooms/[roomCode]/report?date=YYYY/M/D
// レポートの「特定の実施日」のワークデータ（投票結果）を物理削除する。
// ホスト本人のみ・復元不可。誤って全件削除しないよう date（実施日ラベル）を必須にする。
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { extractPollPayload, buildPollOptionsPayload, type PollMeta } from '@/lib/pollModes';
import { collectPollRuns } from '@/lib/sessionReport';

// レポート画面の実施日ドロップダウン（runDateLabel）と同一のラベルを生成する。
// 各回ごとの startedAtTimeZone を用いるため、画面表示と厳密に一致する。
function runDateLabel(startedAt: string | null, timeZone: string | null): string {
  if (!startedAt) return '日時不明';
  const date = new Date(startedAt);
  if (!Number.isFinite(date.getTime())) return '日時不明';
  try {
    return date.toLocaleDateString('ja-JP', {
      timeZone: timeZone || 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
}

// cleared_at の表記揺れ（+00:00 と Z 等）を時刻で正規化して比較する。
function normalizeRunTimestamp(value: string) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? String(t) : value;
}

// meta の各「回」マップから、削除対象の cleared_at キーを取り除く。
function pruneMetaRunKeys(meta: PollMeta, targetKeys: string[]): PollMeta {
  const normalizedTargets = new Set(targetKeys.map(normalizeRunTimestamp));
  const pruneMap = <T,>(rec?: Record<string, T>): Record<string, T> | undefined => {
    if (!rec) return rec;
    const next: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!normalizedTargets.has(normalizeRunTimestamp(k))) next[k] = v;
    }
    return next;
  };
  return {
    ...meta,
    runStartedAtByClearedAt: pruneMap(meta.runStartedAtByClearedAt),
    runStartedAtClientAtByClearedAt: pruneMap(meta.runStartedAtClientAtByClearedAt),
    runStartedAtTimeZoneByClearedAt: pruneMap(meta.runStartedAtTimeZoneByClearedAt),
    runVoteSnapshotsByClearedAt: pruneMap(meta.runVoteSnapshotsByClearedAt),
  };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: '削除するには実施日の指定が必須です' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [pollsRes, votesRes] = await Promise.all([
      supabase
        .from('polls')
        .select('id, question, status, options, max_selections, created_at, started_at')
        .eq('room_id', room.id),
      supabase
        .from('poll_votes')
        .select('poll_id, option_index, value, participant_id, created_at, cleared_at')
        .eq('room_id', room.id),
    ]);

    const polls = pollsRes.data || [];
    const votes = votesRes.data || [];

    let deletedRuns = 0;
    let deletedVotes = 0;

    for (const poll of polls) {
      const { meta, options } = extractPollPayload(poll.options);
      const pollVotes = votes.filter((v) => v.poll_id === poll.id);
      const runs = collectPollRuns(
        {
          id: poll.id,
          question: poll.question,
          status: poll.status,
          options: poll.options,
          max_selections: poll.max_selections,
          created_at: poll.created_at,
          started_at: poll.started_at,
        },
        pollVotes.map((v) => ({ ...v, group_label: null })),
        meta
      );

      const matching = runs.filter(
        (run) => runDateLabel(run.startedAt, run.startedAtTimeZone) === date
      );
      if (matching.length === 0) continue;

      const liveMatch = matching.some((r) => r.clearedAt === null);
      // DB票の削除に使うキー（run 識別キー＋実票の cleared_at 生値。表記揺れに強くする）
      const deleteKeys = Array.from(
        new Set(
          matching.flatMap((r) => [
            ...(r.clearedAt ? [r.clearedAt] : []),
            ...r.votes.map((v) => v.cleared_at).filter((k): k is string => !!k),
          ])
        )
      );

      if (liveMatch) {
        const { data: del } = await supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', poll.id)
          .is('cleared_at', null)
          .select('poll_id');
        deletedVotes += del?.length ?? 0;
      }
      if (deleteKeys.length > 0) {
        const { data: del } = await supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', poll.id)
          .in('cleared_at', deleteKeys)
          .select('poll_id');
        deletedVotes += del?.length ?? 0;

        // 物理削除された票はスナップショットが唯一の復元元。meta からも取り除く。
        const newMeta = pruneMetaRunKeys(meta, deleteKeys);
        const newOptions = buildPollOptionsPayload(newMeta, options);
        await supabase.from('polls').update({ options: newOptions }).eq('id', poll.id);
      }

      deletedRuns += matching.length;
    }

    return NextResponse.json({ deletedRuns, deletedVotes, date });
  } catch (err) {
    console.error('Report delete error:', err);
    return NextResponse.json({ error: 'Failed to delete report data' }, { status: 500 });
  }
}
