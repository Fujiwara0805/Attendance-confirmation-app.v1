import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { extractPollPayload, getPollMode, getQuizQuestions } from '@/lib/pollModes';

// POST: Submit a vote on a poll (public)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
) {
  try {
    const body = await req.json();
    const { participantId, optionIndex, optionIndexes, value } = body as {
      participantId?: string;
      optionIndex?: number;
      optionIndexes?: number[];
      value?: string | null;
    };
    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Verify poll exists and is active
    const { data: poll } = await supabase
      .from('polls')
      .select('id, room_id, status, max_selections, options, started_at')
      .eq('id', params.pollId)
      .single();

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    if (poll.status !== 'active') {
      return NextResponse.json({ error: 'Poll is not active' }, { status: 400 });
    }

    const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
    const { meta, options } = extractPollPayload(poll.options);
    const pollMode = getPollMode(meta.mode);
    const optionCount = options.length;
    const timeLimitSeconds = Number(meta.timeLimitSeconds || 0);
    if (timeLimitSeconds > 0) {
      if (!poll.started_at) {
        return NextResponse.json({ error: '投票はまだ開始されていません' }, { status: 400 });
      }
      const startedAtMs = new Date(poll.started_at).getTime();
      if (Number.isFinite(startedAtMs) && Date.now() - startedAtMs >= timeLimitSeconds * 1000) {
        return NextResponse.json({ error: '投票時間が終了しました' }, { status: 400 });
      }
    }

    // 複数選択リスト or 単一選択 を統一して配列で扱う
    const indexes: number[] = Array.isArray(optionIndexes) && optionIndexes.length > 0
      ? Array.from(new Set(optionIndexes.filter((i) => Number.isInteger(i) && i >= 0 && i < optionCount)))
      : typeof optionIndex === 'number' && optionIndex >= 0 && optionIndex < optionCount
      ? [optionIndex]
      : [];

    // 自由記述: indexes が空、value のみ
    if (indexes.length === 0 && value) {
      const { data, error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: params.pollId,
          room_id: poll.room_id,
          participant_id: participantId,
          option_index: null,
          value,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    if (indexes.length === 0) {
      return NextResponse.json({ error: 'optionIndex(es) required' }, { status: 400 });
    }
    if (indexes.length > maxSelections) {
      return NextResponse.json(
        { error: `最大 ${maxSelections} 件まで選択できます` },
        { status: 400 }
      );
    }
    if (pollMode === 'ranking' && indexes.length !== maxSelections) {
      return NextResponse.json(
        { error: `${maxSelections} 件のランキングを選択してください` },
        { status: 400 }
      );
    }
    if (pollMode === 'quiz') {
      // 各問題につき最大1解答。時間切れによる未回答（部分提出）は許容する。
      const quizQuestions = getQuizQuestions(meta, options);
      const answeredQuestions = new Set<number>();
      for (const idx of indexes) {
        const questionIndex = quizQuestions.findIndex(
          (q) => idx >= q.optionStart && idx < q.optionStart + q.optionCount
        );
        if (questionIndex < 0 || answeredQuestions.has(questionIndex)) {
          return NextResponse.json(
            { error: '各問題につき1つの解答を選択してください' },
            { status: 400 }
          );
        }
        answeredQuestions.add(questionIndex);
      }
      if (answeredQuestions.size === 0) {
        return NextResponse.json(
          { error: '解答を選択してください' },
          { status: 400 }
        );
      }
    }

    // 既存票を一旦削除 → 新しい選択肢で置換（投票やり直しもサポート）
    await supabase
      .from('poll_votes')
      .delete()
      .eq('poll_id', params.pollId)
      .eq('participant_id', participantId);

    const quizQuestions = pollMode === 'quiz' ? getQuizQuestions(meta, options) : [];
    const rows = indexes.map((idx, rank) => {
      const quizQuestionIndex = pollMode === 'quiz'
        ? quizQuestions.findIndex(
            (q) => idx >= q.optionStart && idx < q.optionStart + q.optionCount
          )
        : -1;
      return {
      poll_id: params.pollId,
      room_id: poll.room_id,
      participant_id: participantId,
      option_index: idx,
      value:
        pollMode === 'ranking'
          ? String(rank + 1)
          : pollMode === 'quiz'
          ? String(quizQuestionIndex + 1)
          : null as string | null,
      };
    });

    const { data, error } = await supabase
      .from('poll_votes')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({ votes: data ?? [], count: rows.length }, { status: 201 });
  } catch (err) {
    console.error('Poll vote error:', err);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}
