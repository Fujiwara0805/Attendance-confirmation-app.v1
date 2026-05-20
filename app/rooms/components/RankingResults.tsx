'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Medal } from 'lucide-react';
import {
  getPollOptionDetail,
  getRankingLeaderboard,
  getRankingOptionLabel,
  getRankingWeights,
  rankLabel,
  type PollOption,
} from '@/lib/pollModes';

interface RankingResultsProps {
  options: PollOption[];
  votes: Array<{ option_index: number | null; value?: string | null }>;
  rankCount: number;
  weights?: number[];
  displayMode?: 'number' | 'number_text';
  size?: 'compact' | 'large';
}

/** デフォルトで表示する上位件数。残りは折りたたみで開閉。 */
const DEFAULT_VISIBLE = 3;

/** 上位ほど濃い emerald。順位数に依存せず連続的に色を割り当てる。 */
function rankColor(rankIndex: number, rankCount: number) {
  const alpha = 0.9 - (rankIndex / Math.max(rankCount, 1)) * 0.65;
  return `rgba(16, 185, 129, ${alpha.toFixed(3)})`;
}

function rankBadge(rank: number) {
  if (rank === 1) {
    return { label: '金メダル', medal: true, cls: 'bg-amber-50 text-amber-500 ring-amber-300' };
  }
  if (rank === 2) {
    return { label: '銀メダル', medal: true, cls: 'bg-slate-50 text-slate-500 ring-slate-300' };
  }
  if (rank === 3) {
    return { label: '銅メダル', medal: true, cls: 'bg-orange-50 text-orange-500 ring-orange-300' };
  }
  return { label: String(rank), medal: false, cls: 'bg-slate-50 text-slate-500 ring-slate-200' };
}

export default function RankingResults({
  options,
  votes,
  rankCount,
  weights,
  displayMode = 'number_text',
  size = 'compact',
}: RankingResultsProps) {
  const normalizedWeights = getRankingWeights(rankCount, weights);
  const leaderboard = getRankingLeaderboard(votes, options.length, rankCount, normalizedWeights);
  const maxTotal = Math.max(...leaderboard.map((e) => e.total), 1);
  const large = size === 'large';
  const [showAll, setShowAll] = useState(false);
  const hasMore = leaderboard.length > DEFAULT_VISIBLE;
  const visible = showAll || !hasMore ? leaderboard : leaderboard.slice(0, DEFAULT_VISIBLE);

  return (
    <div className={large ? 'space-y-4' : 'space-y-3'}>
      {/* 凡例 */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${large ? 'text-sm' : 'text-[11px]'} text-slate-500`}>
        {Array.from({ length: rankCount }).map((_, rankIndex) => (
          <span key={rankIndex} className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block rounded-sm ${large ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}
              style={{ backgroundColor: rankColor(rankIndex, rankCount) }}
            />
            {rankLabel(rankIndex)}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-slate-400">
          スコアは重み付け集計（{normalizedWeights.join(' / ')}点）
        </span>
      </div>

      {visible.map((entry) => {
        const option = options[entry.optionIndex];
        const label = getRankingOptionLabel(option, entry.optionIndex, displayMode);
        const detail = displayMode === 'number_text' ? getPollOptionDetail(option) : undefined;
        const badge = rankBadge(entry.rank);
        return (
          <div
            key={entry.optionIndex}
            className={`rounded-xl bg-white ring-1 ring-slate-200 ${large ? 'p-4' : 'p-3'}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ring-1 ${badge.cls} ${
                  large ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-xs'
                }`}
                aria-label={badge.label}
              >
                {badge.medal ? (
                  <Medal className={large ? 'h-6 w-6' : 'h-4 w-4'} strokeWidth={2.4} aria-hidden />
                ) : (
                  badge.label
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-bold text-slate-900 ${large ? 'text-lg' : 'text-sm'}`}>
                  {label}
                </p>
                {detail && (
                  <p className={`truncate text-slate-500 ${large ? 'text-sm' : 'text-[11px]'}`}>
                    {detail}
                  </p>
                )}
              </div>
              {/* 得点（順位スコア）。得票数・得票率はあえて表示しない。 */}
              <div className="shrink-0 text-right">
                <p className={`font-extrabold tabular-nums text-emerald-700 ${large ? 'text-xl' : 'text-sm'}`}>
                  {entry.score}
                  <span className={`ml-0.5 font-semibold text-emerald-600 ${large ? 'text-sm' : 'text-[11px]'}`}>点</span>
                </p>
              </div>
            </div>

            {/* 第1〜第N希望の積み上げ内訳バー（数値ラベルは省略） */}
            <div className={`mt-2 flex ${large ? 'h-3.5' : 'h-2.5'} w-full overflow-hidden rounded-full bg-slate-100`}>
              {entry.rankCounts.map((count, rankIndex) => (
                <motion.div
                  key={rankIndex}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / maxTotal) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{ backgroundColor: rankColor(rankIndex, rankCount) }}
                  title={`${rankLabel(rankIndex)}: ${count}人`}
                  aria-hidden
                />
              ))}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className={`mx-auto flex items-center gap-1.5 rounded-full bg-white px-4 ring-1 ring-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors ${
            large ? 'h-10 text-sm' : 'h-8 text-xs'
          }`}
        >
          {showAll
            ? '上位3位のみ表示'
            : `4位以降を表示（残り${leaderboard.length - DEFAULT_VISIBLE}件）`}
          <ChevronDown
            className={`${large ? 'h-4 w-4' : 'h-3.5 w-3.5'} transition-transform ${
              showAll ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
      )}

      {leaderboard.every((e) => e.total === 0) && (
        <p className={`text-center text-slate-400 ${large ? 'text-base py-6' : 'text-xs py-3'}`}>
          まだ回答がありません
        </p>
      )}
    </div>
  );
}
