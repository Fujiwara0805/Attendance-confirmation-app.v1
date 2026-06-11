'use client';

import React, { useEffect, useRef } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { CustomModal } from '@/components/ui/custom-modal';

// ヘッダーの検索ボタンから開く検索モーダル（⌘K パターン）。
// 常時表示の検索バーを置き換え、リスト画面の情報密度を下げる。
// 入力はライブで親のフィルタ状態に反映され、一致件数を即時表示する。
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 絞り込み後の件数 */
  resultCount: number;
  /** 絞り込み前の総件数 */
  totalCount: number;
  /** 対象の名称（例: フォーム、ルーム、カード）。件数表示に使う */
  unitLabel: string;
}

export function SearchModal({
  isOpen,
  onClose,
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
  unitLabel,
}: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // モーダルのオープニングアニメーション後にフォーカス
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const hasQuery = value.trim().length > 0;

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="検索"
      className="sm:max-w-[560px]"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8989]" />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onClose();
            }}
            placeholder={placeholder}
            className="h-11 w-full rounded-md border border-[#cccccc] bg-white pl-9 pr-3 text-base text-[#323232] outline-none focus:border-[#2864f0] focus:ring-2 focus:ring-[#dce8ff]"
            style={{ fontSize: '16px' }}
            aria-label={placeholder}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#595959] tabular-nums" aria-live="polite">
            {hasQuery
              ? `${totalCount}件中 ${resultCount}件が一致`
              : `全${totalCount}件の${unitLabel}から検索できます`}
          </p>
          <div className="flex items-center gap-2">
            {hasQuery && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  inputRef.current?.focus();
                }}
                className="h-9 rounded-md px-3 text-xs font-bold text-[#595959] hover:bg-[#f0eded] transition-colors"
              >
                クリア
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2864f0] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8]"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
              結果を表示
            </button>
          </div>
        </div>
      </div>
    </CustomModal>
  );
}

/** ヘッダー右側に置く検索トリガーボタン（アイコン）。 */
export function SearchTriggerButton({
  onClick,
  active,
  label = '検索',
}: {
  onClick: () => void;
  active?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}（⌘K / Ctrl+K）`}
      aria-label={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-[#2864f0] bg-[#ebf3ff] text-[#2864f0]'
          : 'border-[#e1dcdc] bg-white text-[#595959] hover:border-[#aac8ff] hover:bg-[#ebf3ff] hover:text-[#2864f0]'
      }`}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}

/** 絞り込み中チップ。モーダルを閉じた後も適用中のクエリを可視化する。 */
export function ActiveSearchChip({
  query,
  resultCount,
  onClear,
  onEdit,
}: {
  query: string;
  resultCount: number;
  onClear: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-[#ebf3ff] pl-3 pr-2 text-xs font-bold text-[#23418c] ring-1 ring-[#aac8ff] transition-colors hover:bg-[#dce8ff]"
        title="検索条件を編集"
      >
        <Search className="h-3 w-3 shrink-0" />
        <span className="truncate">「{query}」で絞り込み中</span>
        <span className="shrink-0 tabular-nums text-[#2864f0]">{resultCount}件</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        className="h-8 rounded-full px-2.5 text-xs font-bold text-[#595959] transition-colors hover:bg-[#f0eded]"
      >
        クリア
      </button>
    </div>
  );
}
