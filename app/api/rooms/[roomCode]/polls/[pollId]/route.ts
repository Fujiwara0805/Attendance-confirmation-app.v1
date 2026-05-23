import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import {
  buildPollOptionsPayload,
  clampNumber,
  extractPollPayload,
  getPollMode,
  type PollMeta,
  type PollMode,
  type PollOption,
} from '@/lib/pollModes';

// PATCH: Update poll status or content (host only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const body = (await req.json()) as {
      status?: string;
      question?: string;
      options?: PollOption[];
      meta?: PollMeta;
      mode?: PollMode;
      maxSelections?: number;
      allowMultiple?: boolean;
      resetVotes?: boolean;
      // 出題タイマーを開始ボタンを押した端末時刻で開始（present 画面の「開始」ボタン由来）。
      // true: started_at = clientStartedAt（未指定時のみサーバー時刻） / false or undefined: 触らない。
      startTimer?: boolean;
      clientStartedAt?: string;
      clientTimeZone?: string;
      // 同じ出題を再利用するための完全リセット: poll_votes 削除＋started_at=null＋status='draft'
      reset?: boolean;
    };

    // --- Reset path: 同じ出題形式を繰り返し使うためのリセット ---
    // 投票結果は削除せず cleared_at=now() でアーカイブ（CSV では過去回として出力可）。
    if (body.reset) {
      const clearedAt = new Date().toISOString();
      const { data: currentPoll } = await supabase
        .from('polls')
        .select('options, started_at')
        .eq('id', params.pollId)
        .eq('room_id', room.id)
        .single();
      const { data: liveVotes } = await supabase
        .from('poll_votes')
        .select('option_index, value, participant_id, created_at')
        .eq('poll_id', params.pollId)
        .is('cleared_at', null);
      let nextOptions: unknown | undefined;
      if (currentPoll?.options && currentPoll.started_at) {
        const { meta, options } = extractPollPayload(currentPoll.options);
        const voteSnapshot =
          liveVotes && liveVotes.length > 0
            ? {
                startedAt: currentPoll.started_at,
                startedAtClientAt: meta.startedAtClientAt ?? null,
                startedAtTimeZone: meta.startedAtTimeZone ?? null,
                votes: liveVotes.map((v) => ({
                  optionIndex: v.option_index,
                  value: v.value,
                  participantId: v.participant_id,
                  createdAt: v.created_at,
                })),
              }
            : undefined;
        nextOptions = buildPollOptionsPayload(
          {
            ...meta,
            startedAtClientAt: undefined,
            startedAtTimeZone: undefined,
            runStartedAtByClearedAt: {
              ...(meta.runStartedAtByClearedAt || {}),
              [clearedAt]: currentPoll.started_at,
            },
            runStartedAtClientAtByClearedAt: meta.startedAtClientAt
              ? {
                  ...(meta.runStartedAtClientAtByClearedAt || {}),
                  [clearedAt]: meta.startedAtClientAt,
                }
              : meta.runStartedAtClientAtByClearedAt,
            runStartedAtTimeZoneByClearedAt: meta.startedAtTimeZone
              ? {
                  ...(meta.runStartedAtTimeZoneByClearedAt || {}),
                  [clearedAt]: meta.startedAtTimeZone,
                }
              : meta.runStartedAtTimeZoneByClearedAt,
            runVoteSnapshotsByClearedAt: voteSnapshot
              ? {
                  ...(meta.runVoteSnapshotsByClearedAt || {}),
                  [clearedAt]: voteSnapshot,
                }
              : meta.runVoteSnapshotsByClearedAt,
          },
          options
        );
      }
      await supabase
        .from('poll_votes')
        .update({ cleared_at: clearedAt })
        .eq('poll_id', params.pollId)
        .is('cleared_at', null);
      const resetUpdate: { started_at: null; status: 'draft'; options?: unknown } = {
        started_at: null,
        status: 'draft',
      };
      if (nextOptions) resetUpdate.options = nextOptions;
      const { data, error } = await supabase
        .from('polls')
        .update(resetUpdate)
        .eq('id', params.pollId)
        .eq('room_id', room.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    // --- Start-timer path: 出題タイマー（全問共通カウントダウン）を開始する ---
    if (body.startTimer) {
      const clientStartedAtMs = body.clientStartedAt
        ? new Date(body.clientStartedAt).getTime()
        : NaN;
      const clientStartedAt = Number.isFinite(clientStartedAtMs)
        ? new Date(clientStartedAtMs).toISOString()
        : undefined;
      const startedAt = new Date().toISOString();
      let clientTimeZone: string | undefined;
      if (typeof body.clientTimeZone === 'string' && body.clientTimeZone.trim()) {
        try {
          Intl.DateTimeFormat('ja-JP', { timeZone: body.clientTimeZone });
          clientTimeZone = body.clientTimeZone;
        } catch {
          clientTimeZone = undefined;
        }
      }
      let nextOptions: unknown | undefined;
      if (clientStartedAt || clientTimeZone) {
        const { data: currentPoll } = await supabase
          .from('polls')
          .select('options')
          .eq('id', params.pollId)
          .eq('room_id', room.id)
          .single();
        if (currentPoll?.options) {
          const { meta, options } = extractPollPayload(currentPoll.options);
          nextOptions = buildPollOptionsPayload(
            { ...meta, startedAtClientAt: clientStartedAt, startedAtTimeZone: clientTimeZone },
            options
          );
        }
      }
      const { data, error } = await supabase
        .from('polls')
        .update(nextOptions ? { started_at: startedAt, options: nextOptions } : { started_at: startedAt })
        .eq('id', params.pollId)
        .eq('room_id', room.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    // --- Content edit path (出題形式などの編集・更新) ---
    const isContentEdit =
      typeof body.question === 'string' ||
      Array.isArray(body.options) ||
      !!body.meta;

    if (isContentEdit) {
      if (!body.question || !Array.isArray(body.options) || body.options.length < 2) {
        return NextResponse.json(
          { error: 'Question and at least 2 options are required' },
          { status: 400 }
        );
      }

      const pollMode = getPollMode(body.mode || body.meta?.mode);
      const optionCount = body.options.length;
      const rawMax = Number.isFinite(body.maxSelections) ? Number(body.maxSelections) : 1;
      const clampedMax =
        pollMode === 'ranking'
          ? clampNumber(body.meta?.rankCount ?? rawMax, 1, Math.max(1, optionCount), 3)
          : Math.max(1, Math.min(rawMax, Math.max(1, optionCount)));
      const isMulti = pollMode === 'ranking' || body.allowMultiple || clampedMax > 1;
      const payloadOptions = buildPollOptionsPayload(
        { ...(body.meta || {}), mode: pollMode },
        body.options
      );

      // 構造が変わるため、依頼どおり既存の回答をリセットしてから更新
      if (body.resetVotes) {
        await supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', params.pollId)
          .is('cleared_at', null);
      }

      const { data, error } = await supabase
        .from('polls')
        .update({
          question: body.question.trim(),
          options: payloadOptions,
          allow_multiple: isMulti,
          max_selections: isMulti ? clampedMax : 1,
        })
        .eq('id', params.pollId)
        .eq('room_id', room.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json(data);
    }

    // --- Status-only path ---
    const status = body.status;
    if (!status || !['draft', 'active', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    let nextOptionsForStart: unknown | undefined;
    // If activating, close any other active poll in this room
    if (status === 'active') {
      const { data: currentPoll } = await supabase
        .from('polls')
        .select('options, started_at')
        .eq('id', params.pollId)
        .eq('room_id', room.id)
        .single();
      if (currentPoll?.options) {
        const clearedAt = new Date().toISOString();
        const { meta, options } = extractPollPayload(currentPoll.options);
        const { data: liveVotes } = await supabase
          .from('poll_votes')
          .select('option_index, value, participant_id, created_at')
          .eq('poll_id', params.pollId)
          .is('cleared_at', null);
        const voteSnapshot =
          currentPoll.started_at && liveVotes && liveVotes.length > 0
            ? {
                startedAt: currentPoll.started_at,
                startedAtClientAt: meta.startedAtClientAt ?? null,
                startedAtTimeZone: meta.startedAtTimeZone ?? null,
                votes: liveVotes.map((v) => ({
                  optionIndex: v.option_index,
                  value: v.value,
                  participantId: v.participant_id,
                  createdAt: v.created_at,
                })),
              }
            : undefined;
        await supabase
          .from('poll_votes')
          .update({ cleared_at: clearedAt })
          .eq('poll_id', params.pollId)
          .is('cleared_at', null);
        if (currentPoll.started_at) {
          nextOptionsForStart = buildPollOptionsPayload(
            {
              ...meta,
              startedAtClientAt: undefined,
              startedAtTimeZone: undefined,
              runStartedAtByClearedAt: {
                ...(meta.runStartedAtByClearedAt || {}),
                [clearedAt]: currentPoll.started_at,
              },
              runStartedAtClientAtByClearedAt: meta.startedAtClientAt
                ? {
                    ...(meta.runStartedAtClientAtByClearedAt || {}),
                    [clearedAt]: meta.startedAtClientAt,
                  }
                : meta.runStartedAtClientAtByClearedAt,
              runStartedAtTimeZoneByClearedAt: meta.startedAtTimeZone
                ? {
                    ...(meta.runStartedAtTimeZoneByClearedAt || {}),
                    [clearedAt]: meta.startedAtTimeZone,
                  }
                : meta.runStartedAtTimeZoneByClearedAt,
              runVoteSnapshotsByClearedAt: voteSnapshot
                ? {
                    ...(meta.runVoteSnapshotsByClearedAt || {}),
                    [clearedAt]: voteSnapshot,
                  }
                : meta.runVoteSnapshotsByClearedAt,
            },
            options
          );
        }
      }
      await supabase
        .from('polls')
        .update({ status: 'closed' })
        .eq('room_id', room.id)
        .eq('status', 'active');
    }

    // 投影画面の「開始」ボタンで started_at を記録する。
    const update: { status: string; started_at?: string | null; options?: unknown } = { status };
    if (status === 'active') update.started_at = null;
    if (nextOptionsForStart) update.options = nextOptionsForStart;

    const { data, error } = await supabase
      .from('polls')
      .update(update)
      .eq('id', params.pollId)
      .eq('room_id', room.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Poll update error:', err);
    return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 });
  }
}

// DELETE: Delete a poll (host only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Delete associated votes first, then the poll
    await supabase
      .from('poll_votes')
      .delete()
      .eq('poll_id', params.pollId);

    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('id', params.pollId)
      .eq('room_id', room.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Poll delete error:', err);
    return NextResponse.json({ error: 'Failed to delete poll' }, { status: 500 });
  }
}
