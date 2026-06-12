import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import {
  getHistoryRetentionDays,
  getUserSubscription,
  isWithinHistoryRetention,
} from '@/lib/subscription';
import {
  extractPollPayload,
  getPollMode,
  getPollOptionLabel,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getRankingLeaderboard,
  getRankingWeights,
  POLL_MODE_LABELS,
  type PollOption,
} from '@/lib/pollModes';
import { buildSessionReport } from '@/lib/sessionReport';

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
      .select('id, host_id, title, status, created_at, linked_course_code, report_view_count')
      .eq('code', params.roomCode.toUpperCase())
      .single();

    if (!room || room.host_id !== session.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 履歴保持の課金ゲート（個数→反復への移行）。Free は作成から30日を超えた
    // セッション記録の閲覧・出力を不可にし、Pro/Enterprise は無期限。データは消さず
    // アクセスのみ制限するため、アップグレードで即座に過去の記録へ戻れる。
    const subscription = await getUserSubscription(session.email);
    if (!isWithinHistoryRetention(subscription.plan, room.created_at)) {
      const retentionDays = getHistoryRetentionDays(subscription.plan);
      return NextResponse.json(
        {
          error: `この記録は作成から${retentionDays}日を超えています。Proプランにアップグレードすると過去の記録をいつでも閲覧・出力できます。`,
          code: 'RETENTION_LIMIT',
          retentionDays,
        },
        { status: 403 }
      );
    }

    const type = req.nextUrl.searchParams.get('type') || 'summary';

    if (type === 'report') {
      const [questionsRes, pollsRes, votesRes] = await Promise.all([
        supabase
          .from('questions')
          .select('text, author_name, is_anonymous, upvote_count, is_answered, participant_id, created_at')
          .eq('room_id', room.id)
          .is('deleted_at', null)
          .eq('status', 'approved'),
        supabase
          .from('polls')
          .select('id, question, status, options, max_selections, created_at, started_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('poll_votes')
          .select('poll_id, option_index, value, participant_id, created_at, cleared_at, group_label')
          .eq('room_id', room.id),
      ]);

      // 出席フォーム連携時はルーム作成時刻以降の出席数を同送する
      let course: { code: string; name: string } | null = null;
      let attendanceCount: number | null = null;
      if (room.linked_course_code) {
        const { data: linkedCourse } = await supabase
          .from('courses')
          .select('id, code, name')
          .eq('code', room.linked_course_code)
          .single();
        if (linkedCourse?.id) {
          course = { code: linkedCourse.code, name: linkedCourse.name };
          const { count } = await supabase
            .from('attendance')
            .select('id', { count: 'exact', head: true })
            .eq('course_id', linkedCourse.id)
            .gte('created_at', room.created_at);
          attendanceCount = count ?? 0;
        }
      }

      const report = buildSessionReport({
        room: {
          code: params.roomCode.toUpperCase(),
          title: room.title,
          status: room.status,
          created_at: room.created_at,
        },
        course,
        attendanceCount,
        questions: questionsRes.data || [],
        polls: pollsRes.data || [],
        votes: votesRes.data || [],
      });

      // 閲覧計測（戦略9章「レポート閲覧・出力率」）。失敗してもレポートは返す
      await supabase
        .from('rooms')
        .update({
          report_view_count: ((room as { report_view_count?: number }).report_view_count ?? 0) + 1,
          report_last_viewed_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      return NextResponse.json(report);
    }
    const format = req.nextUrl.searchParams.get('format') || 'json';
    const exportTimeZone = getValidExportTimeZone(req.nextUrl.searchParams.get('timeZone'));

    if (type === 'questions') {
      const { data: questions } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', room.id)
        .order('upvote_count', { ascending: false });

      if (format === 'csv') {
        const csv = questionsToCSV(questions || [], exportTimeZone);
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
      const filterPollId = req.nextUrl.searchParams.get('pollId');
      let pollsQuery = supabase
        .from('polls')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false });
      if (filterPollId) {
        pollsQuery = pollsQuery.eq('id', filterPollId);
      }
      const { data: polls } = await pollsQuery;

      const pollIds = (polls || []).map((p) => p.id);
      // 過去回（cleared_at != NULL）も CSV では出力対象にする
      let votes: Array<{ poll_id: string; option_index: number | null; value: string | null; participant_id: string; cleared_at: string | null }> = [];
      if (pollIds.length > 0) {
        const { data } = await supabase
          .from('poll_votes')
          .select('poll_id, option_index, value, participant_id, created_at, cleared_at')
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
        const suffix = filterPollId ? `-${filterPollId.slice(0, 8)}` : '';
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="polls-${params.roomCode}${suffix}.csv"`,
          },
        });
      }
      return NextResponse.json(pollResults);
    }

    // Default: summary
    const [questionsRes, pollsRes, votesRes] = await Promise.all([
      supabase.from('questions').select('id, upvote_count, text').eq('room_id', room.id).is('deleted_at', null).order('upvote_count', { ascending: false }),
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
      .eq('questions.room_id', room.id)
      .is('questions.deleted_at', null);

    if (qVotes) {
      qVotes.forEach((v) => uniqueParticipants.add(v.participant_id));
    }

    // ルームと出席フォームが紐付いている場合は出席数も同送（ルーム作成時刻以降）
    let totalAttendance: number | null = null;
    if (room.linked_course_code) {
      const { data: linkedCourse } = await supabase
        .from('courses')
        .select('id')
        .eq('code', room.linked_course_code)
        .single();
      if (linkedCourse?.id) {
        const { count } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', linkedCourse.id)
          .gte('created_at', room.created_at);
        totalAttendance = count ?? 0;
      }
    }

    return NextResponse.json({
      room: { title: room.title, code: params.roomCode, createdAt: room.created_at },
      stats: {
        totalQuestions: questions.length,
        totalPolls: polls.length,
        totalUpvotes: questions.reduce((sum, q) => sum + (q.upvote_count || 0), 0),
        uniqueParticipants: uniqueParticipants.size,
        attendanceLinked: !!room.linked_course_code,
        totalAttendance,
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

function questionStatusForExport(status: string | null | undefined, deletedAt?: string | null) {
  if (deletedAt) return '削除済み';
  if (status === 'pending') return '承認待ち';
  if (status === 'rejected') return '非表示';
  return '公開';
}

function questionsToCSV(
  questions: Array<{
    text: string;
    author_name: string;
    upvote_count: number;
    is_answered: boolean;
    status?: string | null;
    created_at: string;
    deleted_at?: string | null;
  }>,
  timeZone?: string
) {
  const header = '質問,投稿者,いいね数,回答済み,表示状態,投稿日時,削除日時\n';
  const rows = questions.map((q) => {
    const author = displayAuthorForExport(q.author_name).replace(/"/g, '""');
    const createdAt = formatExportDate(q.created_at, timeZone);
    const deletedAt = formatExportDate(q.deleted_at, timeZone);
    return `"${q.text.replace(/"/g, '""')}","${author}",${q.upvote_count},${q.is_answered ? 'はい' : 'いいえ'},"${questionStatusForExport(q.status, q.deleted_at)}","${createdAt}","${deletedAt}"`;
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
  started_at?: string | null;
};

type VoteRow = {
  poll_id: string;
  option_index: number | null;
  value: string | null;
  participant_id: string;
  created_at?: string | null;
  cleared_at: string | null;
};

function csvEscape(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const DEFAULT_EXPORT_TIME_ZONE = 'Asia/Tokyo';

function getValidExportTimeZone(value: string | null) {
  if (!value) return DEFAULT_EXPORT_TIME_ZONE;
  try {
    Intl.DateTimeFormat('ja-JP', { timeZone: value });
    return value;
  } catch {
    return DEFAULT_EXPORT_TIME_ZONE;
  }
}

function formatExportDate(value: string | null | undefined, timeZone?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return date.toLocaleString('ja-JP', { timeZone: timeZone || DEFAULT_EXPORT_TIME_ZONE });
  } catch {
    return date.toLocaleString('ja-JP', { timeZone: DEFAULT_EXPORT_TIME_ZONE });
  }
}

function normalizeRunTimestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? String(time) : value;
}

function getByNormalizedRunTime(record: Record<string, string> | undefined, key: string | null | undefined) {
  if (!record || !key) return undefined;
  if (record[key]) return record[key];
  const normalizedKey = normalizeRunTimestamp(key);
  return Object.entries(record).find(([recordKey]) => normalizeRunTimestamp(recordKey) === normalizedKey)?.[1];
}

// \u901A\u5E38\u6295\u7968\u30FB\u51FA\u984C\u5F62\u5F0F\u30FB\u5E0C\u671B\u9806\u4F4D\u6295\u7968\u306E\u3059\u3079\u3066\u306E\u9805\u76EE\u3092\u7DB2\u7F85\u3059\u308B CSV \u3092\u751F\u6210\u3002
// 1 \u884C = 1 \u9078\u629E\u80A2\uFF08\u51FA\u984C\u5F62\u5F0F\u306F\u554F\u984C\u3054\u3068\u306B\u5206\u5272\u3001\u9806\u4F4D\u6295\u7968\u306F\u5019\u88DC\u3054\u3068\uFF09\u3002
// 同じカード内の実施履歴は開始日時で区別し、票がない過去回は出力しない。
function pollsToRichCSV(polls: PollRow[], votes: VoteRow[]) {
  const maxRankColumns = Math.max(
    3,
    ...polls.map((poll) => {
      const { meta } = extractPollPayload(poll.options);
      return Math.max(1, Number(poll.max_selections ?? meta.rankCount ?? 3));
    })
  );
  const headers = [
    '\u6295\u7968\u5F62\u5F0F',
    '\u6295\u7968\u30BF\u30A4\u30C8\u30EB',
    '\u72B6\u614B',
    '\u554F\u984C\u756A\u53F7',
    '\u554F\u984C\u6587',
    '\u9078\u629E\u80A2',
    '\u6B63\u89E3',
    '\u5F97\u7968\u6570',
    '\u5F97\u7968\u7387(%)',
    ...Array.from({ length: maxRankColumns }, (_, i) => `${i + 1}\u4F4D\u7968`),
    '\u5F97\u70B9\u6570',
    '\u56DE\u7B54\u8005\u6570',
    '\u958B\u59CB\u65E5\u6642',
  ];
  const lines: string[] = [headers.join(',')];

  for (const poll of polls) {
    const { meta, options } = extractPollPayload(poll.options);
    const mode = getPollMode(meta.mode);
    const modeLabel = POLL_MODE_LABELS[mode] || '\u901A\u5E38\u6295\u7968';
    const allPollVotes = votes.filter((v) => v.poll_id === poll.id);

    // 開始回ごとにグループ化。cleared_at は DB と meta で表記が揺れるため時刻で正規化する。
    const runs = new Map<
      string | null,
      {
        clearedAt: string | null;
        votes: VoteRow[];
        snapshotStartedAt?: string | null;
        snapshotStartedAtClientAt?: string | null;
        snapshotStartedAtTimeZone?: string | null;
      }
    >();
    for (const v of allPollVotes) {
      const key = v.cleared_at ? normalizeRunTimestamp(v.cleared_at) : null;
      if (!runs.has(key)) runs.set(key, { clearedAt: v.cleared_at, votes: [] });
      runs.get(key)!.votes.push(v);
    }
    const archivedRunKeys = new Set([
      ...Object.keys(meta.runStartedAtByClearedAt || {}),
      ...Object.keys(meta.runStartedAtClientAtByClearedAt || {}),
      ...Object.keys(meta.runStartedAtTimeZoneByClearedAt || {}),
      ...Object.keys(meta.runVoteSnapshotsByClearedAt || {}),
    ]);
    archivedRunKeys.forEach((key) => {
      const normalizedKey = normalizeRunTimestamp(key);
      if (!runs.has(normalizedKey)) runs.set(normalizedKey, { clearedAt: key, votes: [] });
    });
    Object.entries(meta.runVoteSnapshotsByClearedAt || {}).forEach(([key, snapshot]) => {
      const normalizedKey = normalizeRunTimestamp(key);
      runs.set(normalizedKey, {
        clearedAt: key,
        snapshotStartedAt: snapshot.startedAt,
        snapshotStartedAtClientAt: snapshot.startedAtClientAt,
        snapshotStartedAtTimeZone: snapshot.startedAtTimeZone,
        votes: snapshot.votes.map((v) => ({
          poll_id: poll.id,
          option_index: v.optionIndex,
          value: v.value ?? null,
          participant_id: v.participantId,
          created_at: v.createdAt ?? null,
          cleared_at: key,
        })),
      });
    });
    if (poll.status === 'active' && poll.started_at && !runs.has(null)) {
      runs.set(null, { clearedAt: null, votes: [] });
    }
    if (runs.size === 0) runs.set(null, { clearedAt: null, votes: [] });

    const runItems = Array.from(runs.values())
      .map((run) => {
        const pollVotes = run.votes;
        const fallbackStartedAt = pollVotes
          .map((v) => v.created_at)
          .filter((v): v is string => !!v)
          .sort()[0];
        const runStartedAt =
          run.snapshotStartedAtClientAt ||
          (run.clearedAt ? getByNormalizedRunTime(meta.runStartedAtClientAtByClearedAt, run.clearedAt) : meta.startedAtClientAt) ||
          run.snapshotStartedAt ||
          (run.clearedAt ? getByNormalizedRunTime(meta.runStartedAtByClearedAt, run.clearedAt) : poll.started_at) ||
          fallbackStartedAt ||
          (run.clearedAt ?? poll.started_at ?? poll.created_at);
        const runStartedAtTimeZone = run.snapshotStartedAtTimeZone || (run.clearedAt
          ? getByNormalizedRunTime(meta.runStartedAtTimeZoneByClearedAt, run.clearedAt)
          : meta.startedAtTimeZone);
        return {
          ...run,
          startedAt: runStartedAt,
          startedAtTimeZone: runStartedAtTimeZone,
        };
      })
      // 票がある履歴だけを出す。全く票がないカードだけ、空の集計行を残す。
      .filter((run) => run.votes.length > 0 || allPollVotes.length === 0)
      .sort((a, b) => {
        const aTime = new Date(a.startedAt || '').getTime();
        const bTime = new Date(b.startedAt || '').getTime();
        if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
        return 0;
      });

    for (const run of runItems) {
      const pollVotes = run.votes;
      const fallbackStartedAt = pollVotes
        .map((v) => v.created_at)
        .filter((v): v is string => !!v)
        .sort()[0];
      const startedAtLabel = formatExportDate(run.startedAt || fallbackStartedAt, run.startedAtTimeZone);
      const respondents = new Set(pollVotes.map((v) => v.participant_id)).size;
      const counts = options.map((_, i) => pollVotes.filter((v) => v.option_index === i).length);
      const totalVotes = counts.reduce((s, c) => s + c, 0);

      if (mode === 'quiz') {
        const quizQuestions = getQuizQuestions(meta, options);
        quizQuestions.forEach((q, qIndex) => {
          const qVotes = pollVotes.filter((v) => Number(v.value) === qIndex + 1);
          const qTotal = new Set(qVotes.map((v) => v.participant_id)).size;
          const slice = options.slice(q.optionStart, q.optionStart + q.optionCount);
          slice.forEach((opt: PollOption, offset: number) => {
            const i = q.optionStart + offset;
            const c = counts[i];
            const pct = qTotal > 0 ? Math.round((c / qTotal) * 100) : 0;
            const isCorrect = getQuizCorrectOptionOffsets(q).includes(offset);
            lines.push(
              [
                csvEscape(modeLabel),
                csvEscape(poll.question),
                csvEscape(poll.status),
                csvEscape(`\u554F${q.questionNumber ?? qIndex + 1}`),
                csvEscape(q.question || ''),
                csvEscape(getPollOptionLabel(opt, `\u89E3\u7B54 ${offset + 1}`)),
                csvEscape(isCorrect ? '\u25EF' : ''),
                csvEscape(c),
                csvEscape(pct),
                ...Array.from({ length: maxRankColumns }, () => ''),
                '',
                csvEscape(qTotal),
                csvEscape(startedAtLabel),
              ].join(',')
            );
          });
        });
      } else if (mode === 'ranking') {
        const rankCount = Math.max(1, Number(poll.max_selections ?? meta.rankCount ?? 3));
        const weights = getRankingWeights(rankCount, meta.rankingWeights);
        const board = getRankingLeaderboard(
          pollVotes.map((v) => ({ option_index: v.option_index, value: v.value })),
          options.length,
          rankCount,
          weights
        );
        const byIndex = [...board].sort((a, b) => a.optionIndex - b.optionIndex);
        byIndex.forEach((entry) => {
          const opt = options[entry.optionIndex];
          // \u30E9\u30F3\u30AD\u30F3\u30B0\u5F62\u5F0F\u3067\u306F\u5F97\u7968\u6570\u30FB\u5F97\u7968\u7387\u306F\u96C6\u8A08\u5BFE\u8C61\u5916\u306E\u305F\u3081 0 \u56FA\u5B9A\u3002
          // \u9806\u4F4D\u5225\u7968\u6570\u306F ${i + 1}\u4F4D\u7968\u3001\u30E9\u30F3\u30AD\u30F3\u30B0\u5F97\u70B9\u306F\u300C\u5F97\u70B9\u6570\u300D\u5217\u3067\u8868\u73FE\u3059\u308B\u3002
          lines.push(
            [
              csvEscape(modeLabel),
              csvEscape(poll.question),
              csvEscape(poll.status),
              '',
              '',
              csvEscape(getPollOptionLabel(opt, `\u5019\u88DC ${entry.optionIndex + 1}`)),
              '',
              csvEscape(0),
              csvEscape(0),
              ...Array.from({ length: maxRankColumns }, (_, rankIndex) =>
                csvEscape(entry.rankCounts[rankIndex] ?? 0)
              ),
              csvEscape(entry.score),
              csvEscape(respondents),
              csvEscape(startedAtLabel),
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
              csvEscape(modeLabel),
              csvEscape(poll.question),
              csvEscape(poll.status),
              '',
              '',
              csvEscape(getPollOptionLabel(opt, `\u9078\u629E\u80A2 ${i + 1}`)),
              '',
              csvEscape(c),
              csvEscape(pct),
              ...Array.from({ length: maxRankColumns }, () => ''),
              '',
              csvEscape(respondents),
              csvEscape(startedAtLabel),
            ].join(',')
          );
        });
      }
    }
  }

  return '\uFEFF' + lines.join('\n');
}
