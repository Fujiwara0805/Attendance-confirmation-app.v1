import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  extractPollPayload,
  FREE_TEXT_CARD_COLORS,
  getPollMode,
  getQuizAnswerLimit,
  getQuizQuestions,
} from '@/lib/pollModes';

type PollVoteRow = {
  poll_id: string;
  room_id: string;
  participant_id: string;
  option_index: number;
  cleared_at: null;
  value: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function isDuplicateKeyError(error: unknown): error is SupabaseErrorLike {
  return !!error && typeof error === 'object' && (error as SupabaseErrorLike).code === '23505';
}

async function insertOrReactivateVote(
  supabase: ReturnType<typeof createServerClient>,
  row: PollVoteRow
) {
  let inserted = await supabase
    .from('poll_votes')
    .insert(row)
    .select()
    .single();

  if (!inserted.error) return inserted;
  if (!isDuplicateKeyError(inserted.error)) return inserted;

  const { data: duplicates, error: lookupError } = await supabase
    .from('poll_votes')
    .select('id, cleared_at')
    .eq('poll_id', row.poll_id)
    .eq('participant_id', row.participant_id)
    .eq('option_index', row.option_index);
  if (lookupError) return { data: null, error: lookupError };

  const archivedIds = (duplicates || [])
    .filter((vote) => !!vote.cleared_at)
    .map((vote) => vote.id)
    .filter(Boolean);
  if (archivedIds.length > 0) {
    const { error: deleteArchivedError } = await supabase
      .from('poll_votes')
      .delete()
      .in('id', archivedIds);
    if (deleteArchivedError) return { data: null, error: deleteArchivedError };

    inserted = await supabase
      .from('poll_votes')
      .insert(row)
      .select()
      .single();
    if (!inserted.error || !isDuplicateKeyError(inserted.error)) return inserted;
  }

  return supabase
    .from('poll_votes')
    .update({
      room_id: row.room_id,
      value: row.value,
      cleared_at: null,
    })
    .eq('poll_id', row.poll_id)
    .eq('participant_id', row.participant_id)
    .eq('option_index', row.option_index)
    .select()
    .single();
}

// POST: Submit a vote on a poll (public)
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string; pollId: string } }
) {
  try {
    const body = await req.json();
    const { participantId, optionIndex, optionIndexes, value, authorName, isAnonymous, color } = body as {
      participantId?: string;
      optionIndex?: number;
      optionIndexes?: number[];
      value?: string | null;
      authorName?: string | null;
      isAnonymous?: boolean;
      color?: string | null;
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

    // 自由回答: indexes が空、value のみ。何回でも投稿できる。
    if (indexes.length === 0 && value) {
      if (pollMode !== 'free_text') {
        return NextResponse.json({ error: '自由回答形式ではありません' }, { status: 400 });
      }

      const trimmedValue = String(value).trim().slice(0, 160);
      if (!trimmedValue) {
        return NextResponse.json({ error: '回答を入力してください' }, { status: 400 });
      }
      const normalizedColor = FREE_TEXT_CARD_COLORS.includes(color as typeof FREE_TEXT_CARD_COLORS[number])
        ? color
        : 'yellow';
      const anonymous = isAnonymous !== false;
      const trimmedAuthor = typeof authorName === 'string' ? authorName.trim().slice(0, 24) : '';

      const { data, error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: params.pollId,
          room_id: poll.room_id,
          participant_id: participantId,
          option_index: null,
          value: trimmedValue,
          response_color: normalizedColor,
          response_author_name: anonymous ? '匿名' : (trimmedAuthor || '匿名'),
          response_is_anonymous: anonymous,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }

    if (indexes.length === 0) {
      return NextResponse.json({ error: 'optionIndex(es) required' }, { status: 400 });
    }
    const quizQuestions = pollMode === 'quiz' ? getQuizQuestions(meta, options) : [];
    const effectiveMaxSelections =
      pollMode === 'quiz'
        ? quizQuestions.reduce((sum, question) => sum + getQuizAnswerLimit(question), 0)
        : maxSelections;

    if (indexes.length > effectiveMaxSelections) {
      return NextResponse.json(
        { error: `最大 ${effectiveMaxSelections} 件まで選択できます` },
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
      // 各問題の正解数に応じて複数解答を許容。時間切れによる未回答（部分提出）は許容する。
      const answerCountsByQuestion = new Map<number, number>();
      for (const idx of indexes) {
        const questionIndex = quizQuestions.findIndex(
          (q) => idx >= q.optionStart && idx < q.optionStart + q.optionCount
        );
        if (questionIndex < 0) {
          return NextResponse.json(
            { error: '解答の選択範囲が正しくありません' },
            { status: 400 }
          );
        }
        const nextCount = (answerCountsByQuestion.get(questionIndex) || 0) + 1;
        const answerLimit = getQuizAnswerLimit(quizQuestions[questionIndex]);
        if (nextCount > answerLimit) {
          return NextResponse.json(
            { error: `問題${questionIndex + 1}は最大${answerLimit}つまで選択できます` },
            { status: 400 }
          );
        }
        answerCountsByQuestion.set(questionIndex, nextCount);
      }
      if (answerCountsByQuestion.size === 0) {
        return NextResponse.json(
          { error: '解答を選択してください' },
          { status: 400 }
        );
      }
    }

    // 既存のライブ票を一旦削除 → 新しい選択肢で置換（投票やり直しもサポート）。
    // 本番DBの unique 制約定義に差分があるため ON CONFLICT は使わず、
    // INSERT 重複時だけ既存行をライブ票へ戻して回答を成立させる。
    await supabase
      .from('poll_votes')
      .delete()
      .eq('poll_id', params.pollId)
      .eq('participant_id', participantId)
      .is('cleared_at', null);

    const rows: PollVoteRow[] = indexes.map((idx, rank) => {
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
      cleared_at: null,
      value:
        pollMode === 'ranking'
          ? String(rank + 1)
          : pollMode === 'quiz'
          ? String(quizQuestionIndex + 1)
          : null as string | null,
      };
    });

    // 高速化: 全選択肢を 1 回のバルク INSERT で登録する（50問規模でも DELETE+INSERT の 2 往復で済み、
    // 問題数に比例した直列ラウンドトリップを排除）。ライブ票は上で削除済みのため通常は衝突しない。
    // 単一 INSERT 文は原子的なので、アーカイブ票（cleared_at != null）との unique 衝突（23505）が
    // 起きた場合は 0 件挿入で失敗する → そのときだけ従来の 1 行ずつ復活処理にフォールバックする。
    const bulk = await supabase.from('poll_votes').insert(rows).select();
    if (!bulk.error) {
      return NextResponse.json({ votes: bulk.data ?? [], count: rows.length }, { status: 201 });
    }
    if (!isDuplicateKeyError(bulk.error)) throw bulk.error;

    const data = [];
    for (const row of rows) {
      const { data: vote, error } = await insertOrReactivateVote(supabase, row);
      if (error) throw error;
      if (vote) data.push(vote);
    }

    return NextResponse.json({ votes: data ?? [], count: rows.length }, { status: 201 });
  } catch (err) {
    console.error('Poll vote error:', err);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}
