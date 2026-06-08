export type PollMode = 'standard' | 'quiz' | 'ranking' | 'free_text';

export type PollOption = string | {
  text?: string;
  imageUrl?: string;
  detail?: string;
};

export interface QuizQuestionConfig {
  id?: string;
  question: string;
  questionImageUrl?: string;
  chapterTitle?: string;
  chapterNumber?: number;
  questionNumber?: number;
  timeLimitSeconds?: number;
  optionStart: number;
  optionCount: number;
  /** @deprecated Use correctOptionOffsets. Kept for existing saved quiz cards. */
  correctOptionOffset?: number;
  /** 0-based offsets (within this question's options) of correct answers. undefined/empty = no answer key. */
  correctOptionOffsets?: number[];
}

export interface PollMeta {
  mode?: PollMode;
  questionImageUrl?: string;
  optionCount?: number;
  chapterTitle?: string;
  chapterNumber?: number;
  questionNumber?: number;
  timeLimitSeconds?: number;
  quizQuestions?: QuizQuestionConfig[];
  rankCount?: number;
  candidateCount?: number;
  rankingWeights?: number[];
  rankingDisplayMode?: 'number' | 'number_text';
  freeTextGroups?: string[];
  /** 一斉開始時にホスト選択順を保持する。値が小さいほど上に表示される（1始まり）。null/未設定は単独実行扱い。 */
  bulkOrder?: number | null;
  /** ホスト管理画面のワークカード並び順。画面遷移・リロード後も管理用の並びを復元する。 */
  hostOrder?: number | null;
  startedAtClientAt?: string;
  startedAtTimeZone?: string;
  runStartedAtByClearedAt?: Record<string, string>;
  runStartedAtClientAtByClearedAt?: Record<string, string>;
  runStartedAtTimeZoneByClearedAt?: Record<string, string>;
  runVoteSnapshotsByClearedAt?: Record<
    string,
    {
      startedAt?: string | null;
      startedAtClientAt?: string | null;
      startedAtTimeZone?: string | null;
      votes: Array<{
        optionIndex: number | null;
        value?: string | null;
        participantId: string;
        createdAt?: string | null;
      }>;
    }
  >;
}

type PollMetaEntry = PollMeta & { __pollMeta: true };

export const POLL_MODE_LABELS: Record<PollMode, string> = {
  standard: '通常投票',
  quiz: 'クイズ形式',
  ranking: 'ランキング形式',
  free_text: 'ブレスト形式',
};

// 締切（時間切れ）直後、結果を開示するまでの「集計中」最低待機時間。
// 締切間際に届いた在時間内の票（ネットワーク遅延ぶん）と realtime 伝播、
// および参加者画面の集計ポーリング（4秒間隔）が揃うのを待ってから開示することで、
// 「未回答」表示のちらつきや件数の後追い増加を防ぐ。各画面で共有する。
export const POLL_AGGREGATION_SETTLE_MS = 5000;

// 参加者画面で「自分の送信した全回答」がサーバーから取得できるまで集計中を延長する上限。
// 送信直後は自票の取得が間に合わず件数が不足することがあるため、自票が揃うまで（最大この時間まで）
// ローディングを継続する。取得が完了すれば上限を待たずに開示する。
export const POLL_AGGREGATION_MAX_SETTLE_MS = 15000;

export const QUIZ_OPTION_COUNTS = [2, 4, 6, 8] as const;
export const RANKING_CANDIDATE_PRESETS = [10, 25, 50, 100] as const;
export const FREE_TEXT_CARD_COLORS = ['yellow', 'green', 'blue', 'orange'] as const;

export type FreeTextCardColor = (typeof FREE_TEXT_CARD_COLORS)[number];

export const FREE_TEXT_CARD_COLOR_LABELS: Record<FreeTextCardColor, string> = {
  yellow: '黄色',
  green: '緑',
  blue: '青',
  orange: 'オレンジ',
};

export const DEPRECATED_FREE_TEXT_GROUPS = ['気持ち・心', '生きもの・自然', 'こと・行動', '想像・未来', 'その他'];

export function normalizeFreeTextGroups(groups?: string[]) {
  const deprecated = new Set(DEPRECATED_FREE_TEXT_GROUPS);
  return (groups || [])
    .map((group) => group.trim())
    .filter((group, index, list) => !!group && !deprecated.has(group) && list.indexOf(group) === index)
    .slice(0, 8);
}

export function getPollMode(mode?: string | null): PollMode {
  if (mode === 'quiz' || mode === 'ranking' || mode === 'free_text') return mode;
  return 'standard';
}

export function isPollMetaEntry(value: unknown): value is PollMetaEntry {
  return !!value && typeof value === 'object' && (value as { __pollMeta?: unknown }).__pollMeta === true;
}

export function extractPollPayload(
  rawOptions: unknown,
  fallbackMode: PollMode = 'standard'
): { meta: PollMeta; options: PollOption[] } {
  const list = Array.isArray(rawOptions) ? rawOptions : [];
  const first = list[0];
  const meta = isPollMetaEntry(first) ? first : { mode: fallbackMode };
  return {
    meta: {
      ...meta,
      mode: getPollMode(meta.mode || fallbackMode),
    },
    options: (isPollMetaEntry(first) ? list.slice(1) : list) as PollOption[],
  };
}

export function buildPollOptionsPayload(meta: PollMeta, options: PollOption[]) {
  const mode = getPollMode(meta.mode);
  const shouldStoreMeta =
    mode !== 'standard' ||
    !!meta.timeLimitSeconds ||
    meta.bulkOrder !== undefined ||
    meta.hostOrder !== undefined ||
    !!meta.startedAtClientAt ||
    !!meta.startedAtTimeZone ||
    !!meta.runStartedAtByClearedAt ||
    !!meta.runStartedAtClientAtByClearedAt ||
    !!meta.runStartedAtTimeZoneByClearedAt ||
    !!meta.runVoteSnapshotsByClearedAt;
  if (!shouldStoreMeta) return options;
  return [{ __pollMeta: true, ...meta }, ...options];
}

export function getPollOptionLabel(option: PollOption | null | undefined, fallback = '') {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') return option.text || fallback;
  return fallback;
}

export function getPollOptionImageUrl(option: PollOption | null | undefined) {
  return option && typeof option === 'object' ? option.imageUrl : undefined;
}

export function getPollOptionDetail(option: PollOption | null | undefined) {
  return option && typeof option === 'object' ? option.detail : undefined;
}

export function getRankingWeights(rankCount: number, weights?: number[]) {
  return Array.from({ length: rankCount }, (_, rankIndex) => {
    const weight = weights?.[rankIndex];
    return Number.isFinite(weight) ? Math.max(0, Number(weight)) : rankCount - rankIndex;
  });
}

export function getRankingDisplayMode(mode?: string | null): 'number' | 'number_text' {
  return mode === 'number' ? 'number' : 'number_text';
}

export function getRankingOptionLabel(
  option: PollOption | null | undefined,
  optionIndex: number,
  displayMode: 'number' | 'number_text' = 'number_text'
) {
  const number = String(optionIndex + 1);
  if (displayMode === 'number') return number;
  return `${number}: ${getPollOptionLabel(option, `候補 ${number}`)}`;
}

export function getQuizQuestions(meta: PollMeta, options: PollOption[]) {
  if (Array.isArray(meta.quizQuestions) && meta.quizQuestions.length > 0) {
    return meta.quizQuestions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i + 1}`,
      optionStart: clampNumber(q.optionStart, 0, Math.max(options.length - 1, 0), 0),
      optionCount: clampNumber(q.optionCount, 2, Math.max(options.length, 2), 4),
    }));
  }

  return [
    {
      id: 'q-1',
      question: '',
      questionImageUrl: meta.questionImageUrl,
      chapterTitle: meta.chapterTitle,
      chapterNumber: meta.chapterNumber,
      questionNumber: meta.questionNumber,
      timeLimitSeconds: meta.timeLimitSeconds,
      optionStart: 0,
      optionCount: options.length || meta.optionCount || 0,
    },
  ];
}

export function getQuizCorrectOptionOffsets(question: QuizQuestionConfig) {
  const rawOffsets = Array.isArray(question.correctOptionOffsets)
    ? question.correctOptionOffsets
    : typeof question.correctOptionOffset === 'number'
    ? [question.correctOptionOffset]
    : [];
  const max = Math.max(0, Number(question.optionCount) || 0);
  return Array.from(
    new Set(
      rawOffsets
        .map((offset) => Number(offset))
        .filter((offset) => Number.isInteger(offset) && offset >= 0 && offset < max)
    )
  );
}

export function getQuizAnswerLimit(question: QuizQuestionConfig) {
  return Math.max(1, getQuizCorrectOptionOffsets(question).length);
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function circledNumber(i: number) {
  if (i < 20) return String.fromCharCode(0x2460 + i);
  return `(${i + 1})`;
}

export function rankLabel(rankIndex: number) {
  return `${rankIndex + 1}位`;
}

export function optionLetter(i: number) {
  return String.fromCharCode(65 + i);
}

export function getRankingScores(
  votes: Array<{ option_index: number | null; value?: string | null }>,
  optionCount: number,
  rankCount: number,
  weights = getRankingWeights(rankCount)
) {
  return Array.from({ length: optionCount }, (_, optionIndex) => {
    const rankCounts = Array.from({ length: rankCount }, (_, rankIndex) =>
      votes.filter(
        (v) => v.option_index === optionIndex && Number(v.value) === rankIndex + 1
      ).length
    );
    const score = rankCounts.reduce(
      (sum, count, rankIndex) => sum + count * (weights[rankIndex] ?? 0),
      0
    );
    return {
      optionIndex,
      rankCounts,
      score,
      firstChoice: rankCounts[0] ?? 0,
      total: rankCounts.reduce((sum, count) => sum + count, 0),
    };
  });
}

export interface RankingLeaderboardEntry {
  optionIndex: number;
  rankCounts: number[];
  score: number;
  firstChoice: number;
  total: number;
  /** 1-based display rank. Ties share the same rank. */
  rank: number;
}

/**
 * 重み付けスコア降順に並べた順位表。スコア同点は同順位（標準競技順位法）。
 */
export function getRankingLeaderboard(
  votes: Array<{ option_index: number | null; value?: string | null }>,
  optionCount: number,
  rankCount: number,
  weights = getRankingWeights(rankCount)
): RankingLeaderboardEntry[] {
  const scored = getRankingScores(votes, optionCount, rankCount, weights);
  const sorted = [...scored].sort(
    (a, b) => b.score - a.score || b.firstChoice - a.firstChoice || a.optionIndex - b.optionIndex
  );
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((entry, i) => {
    const rank = lastScore !== null && entry.score === lastScore ? lastRank : i + 1;
    lastScore = entry.score;
    lastRank = rank;
    return { ...entry, rank };
  });
}

/**
 * 参加者の選択 index 群から、クイズ形式の採点結果を算出。
 * 正解未設定の問題は採点対象外（gradable に含めない）。
 */
export function getQuizScore(
  quizQuestions: QuizQuestionConfig[],
  answerIndexes: number[]
): {
  correct: number;
  gradable: number;
  perQuestion: Array<{ correct: boolean | null; chosenOffset: number | null; chosenOffsets: number[] }>;
} {
  let correct = 0;
  let gradable = 0;
  const perQuestion = quizQuestions.map((q) => {
    const chosenIndexes = answerIndexes.filter(
      (idx) => idx >= q.optionStart && idx < q.optionStart + q.optionCount
    );
    const chosenOffsets = chosenIndexes.map((idx) => idx - q.optionStart).sort((a, b) => a - b);
    const chosenOffset = chosenOffsets[0] ?? null;
    const correctOffsets = getQuizCorrectOptionOffsets(q);
    if (correctOffsets.length === 0) {
      return { correct: null as boolean | null, chosenOffset, chosenOffsets };
    }
    gradable += 1;
    const isCorrect =
      chosenOffsets.length === correctOffsets.length &&
      correctOffsets.every((offset, index) => chosenOffsets[index] === offset);
    if (isCorrect) correct += 1;
    return { correct: isCorrect, chosenOffset, chosenOffsets };
  });
  return { correct, gradable, perQuestion };
}
