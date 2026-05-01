'use client';

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ThumbsUp, CheckCircle2, Pin, Edit2, Trash2, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface QuestionCardProps {
  id: string;
  text: string;
  authorName: string;
  upvoteCount: number;
  isAnswered: boolean;
  isPinned: boolean;
  createdAt: string;
  hasVoted: boolean;
  onVote: (id: string) => void;
  // Host controls
  isHost?: boolean;
  onToggleAnswered?: (id: string) => void;
  onTogglePinned?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Moderation (host)
  status?: 'pending' | 'approved' | 'rejected';
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  // Participant controls (own questions)
  isOwn?: boolean;
  onEdit?: (id: string, newText: string) => void;
  onDeleteOwn?: (id: string) => void;
  // Visual override
  likeIcon?: ReactNode;
}

const PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function QuestionCard({
  id,
  text,
  authorName,
  upvoteCount,
  isAnswered,
  isPinned,
  createdAt,
  hasVoted,
  onVote,
  isHost,
  onToggleAnswered,
  onTogglePinned,
  onDelete,
  status,
  onApprove,
  onReject,
  isOwn,
  onEdit,
  onDeleteOwn,
  likeIcon,
}: QuestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ja });
  const authorLabel = authorName === 'Anonymous' ? '匿名' : authorName;
  const initial = authorLabel.slice(0, 1) || '匿';
  const tone = avatarTone(authorLabel);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`group rounded-2xl bg-white ring-1 transition-all overflow-hidden ${
        isPinned ? 'ring-emerald-300 shadow-sm shadow-emerald-100' : 'ring-slate-200 shadow-sm'
      } ${isAnswered ? 'opacity-70' : ''}`}
    >
      <div className="p-4">
        {/* Header row: avatar + name + own actions + (time + like) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${tone}`}
              aria-hidden
            >
              {initial}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
              {authorLabel}
            </span>
            {isPinned && <Pin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {isAnswered && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {isOwn && !isHost && !isEditing && (
              <span className="inline-flex items-center gap-0.5 ml-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setEditText(text);
                  }}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="編集"
                  aria-label="編集"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteOwn?.(id)}
                  className="p-1 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  title="削除"
                  aria-label="削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] sm:text-xs text-slate-400">{timeAgo}</span>
            <button
              type="button"
              onClick={() => onVote(id)}
              aria-pressed={hasVoted}
              aria-label={hasVoted ? 'いいねを取り消す' : 'いいね'}
              className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums transition-colors active:scale-[0.95] ${
                hasVoted ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
              }`}
            >
              {likeIcon ?? <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />}
              {upvoteCount}
            </button>
          </div>
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-slate-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:border-emerald-400 outline-none resize-none"
              rows={2}
              style={{ fontSize: '16px' }}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  onEdit?.(id, editText);
                  setIsEditing(false);
                }}
                disabled={!editText.trim()}
                className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-lg disabled:opacity-40"
              >
                保存
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`text-[15px] sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap break-words ${
              isAnswered ? 'line-through' : ''
            }`}
          >
            {text}
          </p>
        )}

        {/* Footer row: actions */}
        <div className="mt-3 flex items-center justify-end gap-1 empty:hidden">
            {/* Host moderation */}
            {isHost && status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => onApprove?.(id)}
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 h-8 rounded-full transition-colors"
                  title="承認して公開"
                >
                  <Check className="w-3.5 h-3.5" />
                  承認
                </button>
                <button
                  type="button"
                  onClick={() => onReject?.(id)}
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 px-2.5 h-8 rounded-full transition-colors"
                  title="非公開にする"
                >
                  <X className="w-3.5 h-3.5" />
                  却下
                </button>
              </>
            )}

            {/* Host generic controls */}
            {isHost && (
              <>
                <button
                  type="button"
                  onClick={() => onToggleAnswered?.(id)}
                  className={`p-2 rounded-full transition-colors ${
                    isAnswered
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'hover:bg-slate-100 text-slate-400'
                  }`}
                  title={isAnswered ? '未回答に戻す' : '回答済みにする'}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePinned?.(id)}
                  className={`p-2 rounded-full transition-colors ${
                    isPinned
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'hover:bg-slate-100 text-slate-400'
                  }`}
                  title={isPinned ? 'ピン解除' : 'ピン留め'}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(id)}
                  className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

        </div>
      </div>
    </motion.div>
  );
}
