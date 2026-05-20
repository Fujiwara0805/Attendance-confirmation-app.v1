import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import {
  extractPollPayload,
  getPollMode,
  getPollOptionLabel,
  getQuizQuestions,
  getRankingLeaderboard,
  POLL_MODE_LABELS,
  type PollOption,
} from '@/lib/pollModes';

// GET: Export room data (host only)
export async function GET(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('id, host_id, title, created_at')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const type = req.nextUrl.searchParams.get('type') || 'summary';
    const format = req.nextUrl.searchParams.get('format') || 'json';

    if (type === 'questions') {
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', room.id)
        .order('upvote_count', { ascending: false });

      if (format === 'csv') {
        const csv = questionsToCSV(questions || []);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="questions-${params.roomCode}.csv"`,
          },
        });
      }
      return NextResponse.json(questions);
    }

    if (type === 'polls') {
      const { data: polls } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false });

      const pollIds = (polls || []).map((p) => p.id);
      // 過去回（cleared_at != NULL）も CSV では出力対象にする
      let votes: Array<{ poll_id: string; option_index: number | null; value: string | null; participant_id: string; cleared_at: string | null }> = [];
      if (pollIds.length > 0) {
        const { data } = await supabase
          .from('poll_votes')
          .select('poll_id, option_index, value, participant_id, cleared_at')
          .in('poll_id', pollIds);
        votes = data || [];
      }

      // JSON 用の集計（既存形 — ライブのみ）
      const pollResults = (polls || []).map((poll) => {
        const pollVotes = votes.filter((v) => v.poll_id === poll.id && !v.cleared_at);
        const optionCounts: Record<number, number> = {};
        pollVotes.forEach((v) => {
          if (v.option_index !== null) {
            optionCounts[v.option_index] = (optionCounts[v.option_index] || 0) + 1;
          }
        });
        return {
          ...poll,
          totalVotes: pollVotes.length,
          results: extractPollPayload(poll.options).options.map((opt, i: number) => ({
            option: getPollOptionLabel(opt, `選択肢 ${i + 1}`),
            count: optionCounts[i] || 0,
            percentage: pollVotes.length > 0
              ? Math.round(((optionCounts[i] || 0) / pollVotes.length) * 100)
              : 0,
          })),
        };
      });

      if (format === 'csv') {
        const csv = pollsToRichCSV(polls || [], votes);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="polls-${params.roomCode}.csv"`,
          },
        });
      }
      return NextResponse.json(pollResults);
    }

    // Default: summary
    const [questionsRes, pollsRes, votesRes] = await Promise.all([
      supabase.from('questions').select('id, upvote_count, text').eq('room_id', room.id).order('upvote_count', { ascending: false }),
      supabase.from('polls').select('id, question, status').eq('room_id', room.id),
      supabase.from('poll_votes').select('participant_id').eq('room_id', room.id),
    ]);

    const questions = questionsRes.data || [];
    const polls = pollsRes.data || [];
    const uniqueParticipants = new Set((votesRes.data || []).map((v) => v.participant_id));

    // Also count unique question participants from question_votes
    const { data: qVotes } = await supabase
      .from('question_votes')
      .select('participant_id, question_id, questions!inner(room_id)')
      .eq('questions.room_id', room.id);

    if (qVotes) {
      qVotes.forEach((v) => uniqueParticipants.add(v.participant_id));
    }

    return NextResponse.json({
      room: { title: room.title, code: params.roomCode, createdAt: room.created_at },
      stats: {
        totalQuestions: questions.length,
        totalPolls: polls.length,
        totalUpvotes: questions.reduce((sum, q) => sum + (q.upvote_count || 0), 0),
        uniqueParticipants: uniqueParticipants.size,
      },
      topQuestions: questions,
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

function displayAuthorForExport(name: string) {
  return name === 'Anonymous' ? '匿名' : name;
}

function questionsToCSV(questions: Array<{ text: string; author_name: string; upvote_count: number; is_answered: boolean; created_at: string }>) {
  const header = '質問,投稿者,いいね数,回答済み,投稿日時\n';
  const rows = questions.map((q) => {
    const author = displayAuthorForExport(q.author_name).replace(/"/g, '""');
    return `"${q.text.replace(/"/g, '""')}","${author}",${q.upvote_count},${q.is_answered ? 'はい' : 'いいえ'},"${new Date(q.created_at).toLocaleString('ja-JP')}"`;
  }).join('\n');
  return '\uFEFF' + header + rows; // BOM for Excel
}


type PollRow = {
  id: string;
  question: string;
  status: string;
  options: unknown;
  max_selections?: number | null;
  created_at: string;
};

type VoteRow = {
  poll_id: string;
  option_index: number | null;
  value: string | null;
  participant_id: string;
  cleared_at: string | null;
};

function csvEscape(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// \u901A\u5E38\u6295\u7968\u30FB\u51FA\u984C\u5F62\u5F0F\u30FB\u5E0C\u671B\u9806\u4F4D\u6295\u7968\u306E\u3059\u3079\u3066\u306E\u9805\u76EE\u3092\u7DB2\u7F85\u3059\u308B CSV \u3092\u751F\u6210\u3002
// 1 \u884C = 1 \u9078\u629E\u80A2\uFF08\u51FA\u984C\u5F62\u5F0F\u306F\u554F\u984C\u3054\u3068\u306B\u5206\u5272\u3001\u9806\u4F4D\u6295\u7968\u306F\u5019\u88DC\u3054\u3068\uFF09\u3002
// \u51FA\u984C\u30EA\u30BB\u30C3\u30C8\u5C65\u6B74\u306F cleared_at \u3067\u30B0\u30EB\u30FC\u30D7\u5206\u3051\u3057\u300C\u5B9F\u65BD\u56DE\u300D\u5217\u3067\u533A\u5225\u3002
function pollsToRichCSV(polls: PollRow[], votes: VoteRow[]) {
  const headers = [
    '\u5B9F\u65BD\u56DE',
    '\u6295\u7968\u5F62\u5F0F',
    '\u6295\u7968\u30BF\u30A4\u30C8\u30EB',
    '\u72B6\u614B',
    '\u554F\u984C\u756A\u53F7',
    '\u554F\u984C\u6587',
    '\u9078\u629E\u80A2',
    '\u6B63\u89E3',
    '\u5F97\u7968\u6570',
    '\u5F97\u7968\u7387(%)',
    '1\u4F4D\u7968',
    '2\u4F4D\u7968',
    '3\u4F4D\u7968',
    'Borda\u30B9\u30B3\u30A2',
    '\u56DE\u7B54\u8005\u6570',
    '\u4F5C\u6210\u65E5\u6642',
  ];
  const lines: string[] = [headers.join(',')];

  for (const poll of polls) {
    const { meta, options } = extractPollPayload(poll.options);
    const mode = getPollMode(meta.mode);
    const modeLabel = POLL_MODE_LABELS[mode] || '\u901A\u5E38\u6295\u7968';
    const createdAt = new Date(poll.created_at).toLocaleString('ja-JP');
    const allPollVotes = votes.filter((v) => v.poll_id === poll.id);

    // \u5B9F\u65BD\u56DE\u3054\u3068\u306B\u30B0\u30EB\u30FC\u30D7\u5316\uFF08cleared_at NULL = \u73FE\u5728 / \u305D\u308C\u4EE5\u5916 = \u30A2\u30FC\u30AB\u30A4\u30D6\uFF09
    const runs = new Map<string | null, VoteRow[]>();
    for (const v of allPollVotes) {
      const key = v.cleared_at ?? null;
      if (!runs.has(key)) runs.set(key, []);
      runs.get(key)!.push(v);
    }
    if (runs.size === 0) runs.set(null, []); // \u6295\u7968\u306A\u3057\u3067\u3082\u51FA\u984C\u81EA\u4F53\u306F1\u884C\u51FA\u3059

    // \u53E4\u3044\u9806\uFF08archived ASC\uFF09\u2192 \u6700\u5F8C\u306B\u73FE\u5728
    const archivedKeys = Array.from(runs.keys())
      .filter((k): k is string => typeof k === 'string')
      .sort();
    const orderedKeys: Array<string | null> = [...archivedKeys];
    if (runs.has(null)) orderedKeys.push(null);

    for (const runKey of orderedKeys) {
      const pollVotes = runs.get(runKey) || [];
      const runLabel = runKey
        ? `\u30EA\u30BB\u30C3\u30C8 ${new Date(runKey).toLocaleString('ja-JP')}`
        : '\u73FE\u5728';
      const respondents = new Set(pollVotes.map((v) => v.participant_id)).size;
      const counts = options.map((_, i) => pollVotes.filter((v) => v.option_index === i).length);
      const totalVotes = counts.reduce((s, c) => s + c, 0);

      if (mode === 'quiz') {
        const quizQuestions = getQuizQuestions(meta, options);
        quizQuestions.forEach((q, qIndex) => {
          const qTotal = pollVotes.filter((v) => Number(v.value) === qIndex + 1).length;
          const slice = options.slice(q.optionStart, q.optionStart + q.optionCount);
          slice.forEach((opt: PollOption, offset: number) => {
            const i = q.optionStart + offset;
            const c = counts[i];
            const pct = qTotal > 0 ? Math.round((c / qTotal) * 100) : 0;
            const isCorrect =
              typeof q.correctOptionOffset === 'number' && q.correctOptionOffset === offset;
            lines.push(
              [
                csvEscape(runLabel),
                csvEscape(modeLabel),
                csvEscape(poll.question),
                csvEscape(poll.status),
                csvEscape(`\u554F${q.questionNumber ?? qIndex + 1}`),
                csvEscape(q.question || ''),
                csvEscape(getPollOptionLabel(opt, `\u89E3\u7B54 ${offset + 1}`)),
                csvEscape(isCorrect ? '\u25EF' : ''),
                csvEscape(c),
                csvEscape(pct),
                '',
                '',
                '',
                '',
                csvEscape(qTotal),
                csvEscape(createdAt),
              ].join(',')
            );
          });
        });
      } else if (mode === 'ranking') {
        const rankCount = Math.max(1, Number(poll.max_selections ?? meta.rankCount ?? 3));
        const board = getRankingLeaderboard(
          pollVotes.map((v) => ({ option_index: v.option_index, value: v.value })),
          options.length,
          rankCount
        );
        const byIndex = [...board].sort((a, b) => a.optionIndex - b.optionIndex);
        byIndex.forEach((entry) => {
          const opt = options[entry.optionIndex];
          const firstChoice = entry.rankCounts[0] ?? 0;
          const pct = respondents > 0 ? Math.round((firstChoice / respondents) * 100) : 0;
          lines.push(
            [
              csvEscape(runLabel),
              csvEscape(modeLabel),
              csvEscape(poll.question),
              csvEscape(poll.status),
              '',
              '',
              csvEscape(getPollOptionLabel(opt, `\u5019\u88DC ${entry.optionIndex + 1}`)),
              '',
              csvEscape(firstChoice),
              csvEscape(pct),
              csvEscape(entry.rankCounts[0] ?? 0),
              csvEscape(entry.rankCounts[1] ?? 0),
              csvEscape(entry.rankCounts[2] ?? 0),
              csvEscape(entry.score),
              csvEscape(respondents),
              csvEscape(createdAt),
            ].join(',')
          );
        });
      } else {
        // \u901A\u5E38\u6295\u7968
        options.forEach((opt, i) => {
          const c = counts[i];
          const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
          lines.push(
            [
              csvEscape(runLabel),
              csvEscape(modeLabel),
              csvEscape(poll.question),
              csvEscape(poll.status),
              '',
              '',
              csvEscape(getPollOptionLabel(opt, `\u9078\u629E\u80A2 ${i + 1}`)),
              '',
              csvEscape(c),
              csvEscape(pct),
              '',
              '',
              '',
              '',
              csvEscape(respondents),
              csvEscape(createdAt),
            ].join(',')
          );
        });
      }
    }
  }

  return '\uFEFF' + lines.join('\n');
}
