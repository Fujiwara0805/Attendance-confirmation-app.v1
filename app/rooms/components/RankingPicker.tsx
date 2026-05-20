'use client';

import { useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import {
  getPollOptionDetail,
  getPollOptionLabel,
  rankLabel,
  type PollOption,
} from '@/lib/pollModes';

interface RankingPickerProps {
  options: PollOption[];
  maxSelections: number;
  /** rank 順（index = 希望順位）の選択候補 index 配列 */
  value: number[];
  onChange: (next: number[]) => void;
}

/**
 * 多数候補から第1〜第N希望を選ぶ、検索付きカスタムドロップダウン。
 * ネイティブ select ではなく、番号・候補名・詳細を確認しながら 1 つずつ選択できる。
 */
export default function RankingPicker({
  options,
  maxSelections,
  value,
  onChange,
}: RankingPickerProps) {
  const [openRank, setOpenRank] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const pick = (rankIndex: number, optionIndex: number) => {
    const next = [...value];
    // 同じ候補が別の希望枠にあれば取り除く
    const dup = next.indexOf(optionIndex);
    if (dup >= 0) next[dup] = -1;
    next[rankIndex] = optionIndex;
    onChange(next.map((v) => (Number.isInteger(v) ? v : -1)));
    setOpenRank(null);
    setQuery('');
  };

  const clear = (rankIndex: number) => {
    const next = [...value];
    next[rankIndex] = -1;
    onChange(next);
  };

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <div className="space-y-2.5">
      {Array.from({ length: maxSelections }).map((_, rankIndex) => {
        const selectedIndex = value[rankIndex];
        const hasSelection = Number.isInteger(selectedIndex) && selectedIndex >= 0;
        const selectedOption = hasSelection ? options[selectedIndex] : undefined;
        const isOpen = openRank === rankIndex;

        const filtered = options
          .map((option, optionIndex) => ({ option, optionIndex }))
          .filter(({ option, optionIndex }) => {
            if (!normalizedQuery) return true;
            const label = getPollOptionLabel(option, `候補 ${optionIndex + 1}`).toLowerCase();
            const detail = (getPollOptionDetail(option) || '').toLowerCase();
            return (
              String(optionIndex + 1).includes(normalizedQuery) ||
              label.includes(normalizedQuery) ||
              detail.includes(normalizedQuery)
            );
          });

        return (
          <div key={rankIndex}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{rankLabel(rankIndex)}</span>
              {hasSelection && (
                <button
                  type="button"
                  onClick={() => clear(rankIndex)}
                  className="text-[11px] font-semibold text-slate-400 hover:text-rose-500"
                >
                  クリア
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenRank(isOpen ? null : rankIndex);
                setQuery('');
              }}
              className={`mt-1 flex h-12 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold ring-1 transition-colors ${
                isOpen
                  ? 'bg-white ring-emerald-300'
                  : hasSelection
                  ? 'bg-emerald-50 text-slate-800 ring-emerald-200'
                  : 'bg-slate-50 text-slate-400 ring-slate-200'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                {hasSelection ? (
                  <>
                    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 px-1.5 text-xs font-bold text-white tabular-nums">
                      {selectedIndex + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">
                        {getPollOptionLabel(selectedOption!, `候補 ${selectedIndex + 1}`)}
                      </span>
                      {getPollOptionDetail(selectedOption!) && (
                        <span className="block truncate text-[11px] font-normal text-slate-500">
                          {getPollOptionDetail(selectedOption!)}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  '選択してください'
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isOpen && (
              <div className="mt-1.5 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 shadow-lg">
                <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="番号・候補名で検索"
                    className="h-8 w-full bg-transparent text-sm outline-none"
                    style={{ fontSize: '16px' }}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="検索をクリア"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
                  {filtered.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-slate-400">該当する候補がありません</p>
                  )}
                  {filtered.map(({ option, optionIndex }) => {
                    const takenAt = value.indexOf(optionIndex);
                    const takenByOther = takenAt >= 0 && takenAt !== rankIndex;
                    const isCurrent = selectedIndex === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        disabled={takenByOther}
                        onClick={() => pick(rankIndex, optionIndex)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                          takenByOther
                            ? 'cursor-not-allowed opacity-40'
                            : isCurrent
                            ? 'bg-emerald-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-bold text-slate-600 tabular-nums">
                          {optionIndex + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {getPollOptionLabel(option, `候補 ${optionIndex + 1}`)}
                          </span>
                          {getPollOptionDetail(option) && (
                            <span className="block truncate text-[11px] text-slate-500">
                              {getPollOptionDetail(option)}
                            </span>
                          )}
                        </span>
                        {takenByOther && (
                          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                            {rankLabel(takenAt)}に選択済
                          </span>
                        )}
                        {isCurrent && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
