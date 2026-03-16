'use client';

import { motion } from 'framer-motion';

interface PollResultsChartProps {
  options: string[];
  votes: Array<{ option_index: number | null; value: string | null }>;
  totalVotes: number;
  showPercentage?: boolean;
  large?: boolean;
}

const COLORS = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-orange-500',
];

export default function PollResultsChart({
  options,
  votes,
  totalVotes,
  showPercentage = true,
  large = false,
}: PollResultsChartProps) {
  const counts = options.map((_, i) =>
    votes.filter((v) => v.option_index === i).length
  );

  const maxCount = Math.max(...counts, 1);

  return (
    <div className={`space-y-${large ? '4' : '3'}`}>
      {options.map((option, i) => {
        const count = counts[i];
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const width = totalVotes > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className={`${large ? 'text-base' : 'text-sm'} font-medium text-slate-700`}>
                {option}
              </span>
              <span className={`${large ? 'text-base' : 'text-xs'} text-slate-500`}>
                {showPercentage ? `${pct}%` : ''} ({count})
              </span>
            </div>
            <div className={`w-full ${large ? 'h-8' : 'h-6'} bg-slate-100 rounded-lg overflow-hidden`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`h-full ${COLORS[i % COLORS.length]} rounded-lg flex items-center ${
                  width > 10 ? 'justify-end pr-2' : 'justify-start pl-2'
                }`}
              >
                {width > 10 && (
                  <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-white`}>
                    {pct}%
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        );
      })}
      <p className={`${large ? 'text-sm' : 'text-xs'} text-slate-400 text-center`}>
        投票数: {totalVotes}
      </p>
    </div>
  );
}
