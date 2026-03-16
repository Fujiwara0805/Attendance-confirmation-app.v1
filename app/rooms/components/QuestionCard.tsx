'use client';

import { motion } from 'framer-motion';
import { ThumbsUp, CheckCircle2, Pin } from 'lucide-react';
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
}: QuestionCardProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ja });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`glass-card p-4 transition-all ${
        isPinned ? 'ring-2 ring-indigo-300 bg-indigo-50/40' : ''
      } ${isAnswered ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3">
        {/* Vote button */}
        <button
          onClick={() => onVote(id)}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-2 rounded-xl transition-all active:scale-95 ${
            hasVoted
              ? 'bg-indigo-100 text-indigo-600'
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">{upvoteCount}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {isPinned && <Pin className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />}
            {isAnswered && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />}
            <p className={`text-sm text-slate-800 leading-relaxed ${isAnswered ? 'line-through' : ''}`}>
              {text}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400">{authorName}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{timeAgo}</span>
          </div>
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => onToggleAnswered?.(id)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                isAnswered ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
              title={isAnswered ? '未回答に戻す' : '回答済みにする'}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onTogglePinned?.(id)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                isPinned ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'
              }`}
              title={isPinned ? 'ピン解除' : 'ピン留め'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
