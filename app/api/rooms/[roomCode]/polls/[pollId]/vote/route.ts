import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  extractPollPayload,
  FREE_TEXT_CARD_COLORS,
  getPollMode,
  getQuizAnswerLimit,
  getQuizQuestions,
} from '@/lib/pollModes';

// 投票送信は DB 往復を伴うため、既定の 10s では稀にタイムアウトし票が一部しか保存されないことがあった。
// 本来の挿入は問題数に依存しない数往復で完了するが、安全側の余裕として上限を引き上げる。
export const maxDuration = 30;

// 旧クライアント（押下時刻 clientElapsedMs を送らない版）向けに、サーバー到達時刻ベースの
// 締切判定へ持たせる遅延吸収の猶予。締切直前送信のネットワーク遅延・処理待ちを吸収する。
const VOTE_DEADLINE_GRACE_MS = 5000;

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
    const { participantId, optionIndex, optionIndexes, value, authorName, isAnonymous, color, clientElapsedMs } = body as {
      participantId?: string;
      optionIndex?: number;
      optionIndexes?: number[];
      value?: string | null;
      authorName?: string | null;
      isAnonymous?: boolean;
      color?: string | null;
      clientElapsedMs?: number;
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
      const limitMs = timeLimitSeconds * 1000;
      // 締切判定はサーバー到達時刻ではなく「ボタン押下が時間内だったか」で行う。
      // 参加者の送信ボタンはクライアントのカウントダウン（now - started_at）で時間内のみ有効。
      // 締切直前の同時送信ではネットワーク遅延でサーバー到達が締切を跨ぎ、本来時間内の回答が
      // 全拒否されて「未回答」になっていた。クライアントが押下時点の経過時間（カウントダウンと同一計算）
      // を送ってきた場合はそれを信頼し、遅れて届いても押下が時間内なら受理する。
      const clientWithinTime =
        typeof clientElapsedMs === 'number' &&
        Number.isFinite(clientElapsedMs) &&
        clientElapsedMs < limitMs;
      // 旧クライアント（clientElapsedMs 未送信）向けの保険として、サーバー時刻にも遅延吸収の猶予を持たせる。
      const serverWithinGrace =
        Number.isFinite(startedAtMs) && Date.now() - startedAtMs < limitMs + VOTE_DEADLINE_GRACE_MS;
      if (!clientWithinTime && !serverWithinGrace) {
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

    const tStart = Date.now();
    const logCtx = { pollId: params.pollId, participantId, mode: pollMode, rowCount: indexes.length };

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

    // 既存票を一括削除してから新しい選択肢を一括 INSERT する（投票やり直しもサポート）。
    // 本番DBの unique 制約 (poll_id, participant_id, option_index) はアーカイブ票（過去回 cleared_at!=null）
    // も含むため、ライブ票だけ消すと今回挿入する option_index がアーカイブ票と衝突（23505）する。
    // 旧実装はそのとき 1 行ずつ復活させていたが、20問規模では最大 ~80 往復に達し Vercel の 10s で
    // タイムアウト → 票が一部しか保存されない原因だった。ここでは衝突しうるアーカイブ票も一括で消し、
    // INSERT は常に 1 回で済むようにする（問題数に依存しない 3 往復固定）。
    const tDel = Date.now();
    const [delLive, delArchived] = await Promise.all([
      // 今回の参加者のライブ票を全削除（再投票で旧選択を置き換える）
      supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', params.pollId)
        .eq('participant_id', participantId)
        .is('cleared_at', null),
      // 今回挿入する option_index と衝突する過去回のアーカイブ票を削除（unique 制約回避）
      supabase
        .from('poll_votes')
        .delete()
        .eq('poll_id', params.pollId)
        .eq('participant_id', participantId)
        .in('option_index', indexes)
        .not('cleared_at', 'is', null),
    ]);
    if (delLive.error) throw delLive.error;
    if (delArchived.error) throw delArchived.error;
    console.log('[vote] deletes done', { ...logCtx, ms: Date.now() - tDel });

    // バルク INSERT（衝突源は上で除去済みのため通常は 1 回で成立）。
    const tIns = Date.now();
    const bulk = await supabase.from('poll_votes').insert(rows).select();
    if (!bulk.error) {
      console.log('[vote] bulk insert ok', {
        ...logCtx,
        inserted: bulk.data?.length ?? 0,
        insertMs: Date.now() - tIns,
        totalMs: Date.now() - tStart,
      });
      return NextResponse.json({ votes: bulk.data ?? [], count: rows.length }, { status: 201 });
    }
    console.error('[vote] bulk insert error → per-row fallback', {
      ...logCtx,
      code: (bulk.error as SupabaseErrorLike).code,
      message: bulk.error.message,
      insertMs: Date.now() - tIns,
    });
    if (!isDuplicateKeyError(bulk.error)) throw bulk.error;

    // 最終手段: 1 行ずつ（衝突除去後もなお失敗するケースはごく稀。万一に備えて残す）。
    const data = [];
    for (const row of rows) {
      const { data: vote, error } = await insertOrReactivateVote(supabase, row);
      if (error) throw error;
      if (vote) data.push(vote);
    }
    console.log('[vote] per-row fallback done', {
      ...logCtx,
      inserted: data.length,
      totalMs: Date.now() - tStart,
    });

    return NextResponse.json({ votes: data ?? [], count: rows.length }, { status: 201 });
  } catch (err) {
    console.error('Poll vote error:', err);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}
