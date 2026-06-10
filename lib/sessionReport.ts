import {
  extractPollPayload,
  getPollMode,
  getPollOptionLabel,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getRankingLeaderboard,
  getRankingWeights,
  normalizeFreeTextGroups,
  POLL_MODE_LABELS,
  type PollMeta,
  type PollMode,
  type PollOption,
} from '@/lib/pollModes';

// ============================================================
// セッションレポート集計
// 1ルーム分の「出席 / Q&A / ワーク別結果（複数回実施対応）」を組み立てる。
// 票はリセット時に物理削除され meta.runVoteSnapshotsByClearedAt へ退避される
// 不変条件があるため、必ず「DBの票（cleared_at付き含む）＋metaスナップショット」
// の両方から実施回を復元する（export の CSV と同じ規約）。
// ============================================================

export interface SessionReportRoomInput {
  code: string;
  title: string;
  status: string;
  created_at: string;
  linked_course_code?: string | null;
}

export interface SessionReportQuestionInput {
  text: string;
  author_name: string | null;
  is_anonymous: boolean | null;
  upvote_count: number | null;
  is_answered: boolean | null;
  participant_id?: string | null;
  created_at: string;
}

export interface SessionReportPollInput {
  id: string;
  question: string;
  status: string;
  options: unknown;
  max_selections?: number | null;
  created_at: string;
  started_at?: string | null;
}

export interface SessionReportVoteInput {
  poll_id: string;
  option_index: number | null;
  value: string | null;
  participant_id: string;
  created_at?: string | null;
  cleared_at: string | null;
  group_label?: string | null;
}

export type SessionReportRunResult =
  | {
      kind: 'standard';
      options: Array<{ label: string; count: number; pct: number }>;
    }
  | {
      kind: 'quiz';
      questions: Array<{
        title: string;
        respondents: number;
        /** 正解未設定の問題は null（採点対象外） */
        correctRate: number | null;
        options: Array<{ label: string; count: number; pct: number; isCorrect: boolean }>;
      }>;
    }
  | {
      kind: 'ranking';
      entries: Array<{ rank: number; label: string; score: number; total: number }>;
    }
  | {
      kind: 'free_text';
      totalCards: number;
      groups: Array<{ label: string; count: number }>;
      samples: string[];
    };

export interface SessionReportRun {
  startedAt: string | null;
  startedAtTimeZone: string | null;
  respondents: number;
  result: SessionReportRunResult;
}

export interface SessionReportWork {
  id: string;
  title: string;
  mode: PollMode;
  modeLabel: string;
  status: string;
  runs: SessionReportRun[];
}

export interface SessionReportData {
  room: { code: string; title: string; status: string; createdAt: string };
  attendance: {
    linked: boolean;
    courseCode?: string;
    courseName?: string;
    total?: number;
  };
  qa: {
    total: number;
    answered: number;
    totalUpvotes: number;
    top: Array<{
      text: string;
      author: string;
      upvotes: number;
      isAnswered: boolean;
      createdAt: string;
    }>;
  };
  works: SessionReportWork[];
  totals: {
    workCount: number;
    runCount: number;
    uniqueParticipants: number;
  };
  generatedAt: string;
}

function normalizeRunTimestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? String(time) : value;
}

function getByNormalizedRunTime(
  record: Record<string, string> | undefined,
  key: string | null | undefined
) {
  if (!record || !key) return undefined;
  if (record[key]) return record[key];
  const normalizedKey = normalizeRunTimestamp(key);
  return Object.entries(record).find(
    ([recordKey]) => normalizeRunTimestamp(recordKey) === normalizedKey
  )?.[1];
}

interface CollectedRun {
  clearedAt: string | null;
  votes: SessionReportVoteInput[];
  startedAt: string | null;
  startedAtTimeZone: string | null;
}

/**
 * 1カード分の票を「実施回」単位に復元する。
 * DBの票（cleared_at付き含む）と meta のスナップショットをマージし、
 * 票が1件もない過去回は除外する（CSVエクスポートと同じ扱い）。
 */
export function collectPollRuns(
  poll: SessionReportPollInput,
  allPollVotes: SessionReportVoteInput[],
  meta: PollMeta
): CollectedRun[] {
  const runs = new Map<
    string | null,
    {
      clearedAt: string | null;
      votes: SessionReportVoteInput[];
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

  // スナップショットは物理削除された票の唯一の復元元。同キーのDB票より優先する。
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

  return Array.from(runs.values())
    .map((run) => {
      const fallbackStartedAt = run.votes
        .map((v) => v.created_at)
        .filter((v): v is string => !!v)
        .sort()[0];
      const startedAt =
        run.snapshotStartedAtClientAt ||
        (run.clearedAt
          ? getByNormalizedRunTime(meta.runStartedAtClientAtByClearedAt, run.clearedAt)
          : meta.startedAtClientAt) ||
        run.snapshotStartedAt ||
        (run.clearedAt
          ? getByNormalizedRunTime(meta.runStartedAtByClearedAt, run.clearedAt)
          : poll.started_at) ||
        fallbackStartedAt ||
        (run.clearedAt ?? poll.started_at ?? null);
      const startedAtTimeZone =
        run.snapshotStartedAtTimeZone ||
        (run.clearedAt
          ? getByNormalizedRunTime(meta.runStartedAtTimeZoneByClearedAt, run.clearedAt)
          : meta.startedAtTimeZone) ||
        null;
      return {
        clearedAt: run.clearedAt,
        votes: run.votes,
        startedAt: startedAt || null,
        startedAtTimeZone,
      };
    })
    .filter((run) => run.votes.length > 0)
    .sort((a, b) => {
      const aTime = new Date(a.startedAt || '').getTime();
      const bTime = new Date(b.startedAt || '').getTime();
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      return 0;
    });
}

function buildStandardResult(
  votes: SessionReportVoteInput[],
  options: PollOption[]
): SessionReportRunResult {
  const counts = options.map(
    (_, i) => votes.filter((v) => v.option_index === i).length
  );
  const totalVotes = counts.reduce((s, c) => s + c, 0);
  return {
    kind: 'standard',
    options: options.map((opt, i) => ({
      label: getPollOptionLabel(opt, `選択肢 ${i + 1}`),
      count: counts[i],
      pct: totalVotes > 0 ? Math.round((counts[i] / totalVotes) * 100) : 0,
    })),
  };
}

function buildQuizResult(
  votes: SessionReportVoteInput[],
  options: PollOption[],
  meta: PollMeta
): SessionReportRunResult {
  const quizQuestions = getQuizQuestions(meta, options);
  return {
    kind: 'quiz',
    questions: quizQuestions.map((q, qIndex) => {
      // クイズの票は value に問題番号（1始まり）を持つ
      const qVotes = votes.filter((v) => Number(v.value) === qIndex + 1);
      const respondents = new Set(qVotes.map((v) => v.participant_id)).size;
      const correctOffsets = getQuizCorrectOptionOffsets(q);
      const slice = options.slice(q.optionStart, q.optionStart + q.optionCount);

      // 正答率: 選んだ選択肢集合が正解集合と一致した参加者の割合
      let correctRate: number | null = null;
      if (correctOffsets.length > 0 && respondents > 0) {
        const byParticipant = new Map<string, number[]>();
        qVotes.forEach((v) => {
          if (v.option_index === null) return;
          const offset = v.option_index - q.optionStart;
          if (offset < 0 || offset >= q.optionCount) return;
          const list = byParticipant.get(v.participant_id) || [];
          list.push(offset);
          byParticipant.set(v.participant_id, list);
        });
        let correct = 0;
        byParticipant.forEach((offsets) => {
          const sorted = Array.from(new Set(offsets)).sort((a, b) => a - b);
          const expected = [...correctOffsets].sort((a, b) => a - b);
          if (
            sorted.length === expected.length &&
            expected.every((offset, i) => sorted[i] === offset)
          ) {
            correct += 1;
          }
        });
        correctRate = Math.round((correct / respondents) * 100);
      }

      return {
        title: q.question || `問${q.questionNumber ?? qIndex + 1}`,
        respondents,
        correctRate,
        options: slice.map((opt, offset) => {
          const i = q.optionStart + offset;
          const count = votes.filter((v) => v.option_index === i).length;
          return {
            label: getPollOptionLabel(opt, `解答 ${offset + 1}`),
            count,
            pct: respondents > 0 ? Math.round((count / respondents) * 100) : 0,
            isCorrect: correctOffsets.includes(offset),
          };
        }),
      };
    }),
  };
}

function buildRankingResult(
  votes: SessionReportVoteInput[],
  options: PollOption[],
  meta: PollMeta,
  maxSelections: number | null | undefined
): SessionReportRunResult {
  const rankCount = Math.max(1, Number(maxSelections ?? meta.rankCount ?? 3));
  const weights = getRankingWeights(rankCount, meta.rankingWeights);
  const board = getRankingLeaderboard(
    votes.map((v) => ({ option_index: v.option_index, value: v.value })),
    options.length,
    rankCount,
    weights
  );
  return {
    kind: 'ranking',
    entries: board.map((entry) => ({
      rank: entry.rank,
      label: getPollOptionLabel(options[entry.optionIndex], `候補 ${entry.optionIndex + 1}`),
      score: entry.score,
      total: entry.total,
    })),
  };
}

function buildFreeTextResult(
  votes: SessionReportVoteInput[],
  meta: PollMeta
): SessionReportRunResult {
  const cards = votes.filter((v) => (v.value || '').trim().length > 0);
  const groupLabels = normalizeFreeTextGroups(meta.freeTextGroups);
  const groupCounts = new Map<string, number>();
  cards.forEach((v) => {
    const label = (v.group_label || '').trim() || '未分類';
    groupCounts.set(label, (groupCounts.get(label) || 0) + 1);
  });
  // 設定済みグループを先頭に、その他は件数順
  const orderedGroups = [
    ...groupLabels
      .filter((label) => groupCounts.has(label))
      .map((label) => ({ label, count: groupCounts.get(label)! })),
    ...Array.from(groupCounts.entries())
      .filter(([label]) => !groupLabels.includes(label))
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  ];
  return {
    kind: 'free_text',
    totalCards: cards.length,
    groups: orderedGroups,
    samples: cards.slice(0, 10).map((v) => (v.value || '').trim()),
  };
}

function displayAuthor(name: string | null, isAnonymous: boolean | null) {
  if (isAnonymous || !name || name === 'Anonymous') return '匿名';
  return name;
}

export function buildSessionReport(input: {
  room: SessionReportRoomInput;
  course?: { code: string; name: string } | null;
  attendanceCount?: number | null;
  questions: SessionReportQuestionInput[];
  polls: SessionReportPollInput[];
  votes: SessionReportVoteInput[];
}): SessionReportData {
  const { room, course, attendanceCount, questions, polls, votes } = input;

  const uniqueParticipants = new Set<string>();
  votes.forEach((v) => uniqueParticipants.add(v.participant_id));
  questions.forEach((q) => {
    if (q.participant_id) uniqueParticipants.add(q.participant_id);
  });

  const works: SessionReportWork[] = polls.map((poll) => {
    const { meta, options } = extractPollPayload(poll.options);
    const mode = getPollMode(meta.mode);
    const pollVotes = votes.filter((v) => v.poll_id === poll.id);
    const runs = collectPollRuns(poll, pollVotes, meta);

    return {
      id: poll.id,
      title: poll.question,
      mode,
      modeLabel: POLL_MODE_LABELS[mode],
      status: poll.status,
      runs: runs.map((run) => ({
        startedAt: run.startedAt,
        startedAtTimeZone: run.startedAtTimeZone,
        respondents: new Set(run.votes.map((v) => v.participant_id)).size,
        result:
          mode === 'quiz'
            ? buildQuizResult(run.votes, options, meta)
            : mode === 'ranking'
            ? buildRankingResult(run.votes, options, meta, poll.max_selections)
            : mode === 'free_text'
            ? buildFreeTextResult(run.votes, meta)
            : buildStandardResult(run.votes, options),
      })),
    };
  });

  const sortedQuestions = [...questions].sort(
    (a, b) => (b.upvote_count || 0) - (a.upvote_count || 0)
  );

  return {
    room: {
      code: room.code,
      title: room.title,
      status: room.status,
      createdAt: room.created_at,
    },
    attendance: room.linked_course_code
      ? {
          linked: true,
          courseCode: course?.code || room.linked_course_code,
          courseName: course?.name,
          total: attendanceCount ?? 0,
        }
      : { linked: false },
    qa: {
      total: questions.length,
      answered: questions.filter((q) => q.is_answered).length,
      totalUpvotes: questions.reduce((s, q) => s + (q.upvote_count || 0), 0),
      top: sortedQuestions.slice(0, 5).map((q) => ({
        text: q.text,
        author: displayAuthor(q.author_name, q.is_anonymous),
        upvotes: q.upvote_count || 0,
        isAnswered: !!q.is_answered,
        createdAt: q.created_at,
      })),
    },
    works,
    totals: {
      workCount: works.length,
      runCount: works.reduce((s, w) => s + w.runs.length, 0),
      uniqueParticipants: uniqueParticipants.size,
    },
    generatedAt: new Date().toISOString(),
  };
}
