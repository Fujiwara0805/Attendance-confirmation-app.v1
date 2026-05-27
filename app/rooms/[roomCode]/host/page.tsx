'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  BarChart3,
  PieChart,
  Plus,
  QrCode,
  Copy,
  Check,
  Download,
  StopCircle,
  Trash2,
  Monitor,
  Loader2,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  Heart,
  Reply,
  EyeOff,
  Eye,
  RotateCcw,
  Users,
  Trophy,
  ArrowLeft,
  BookOpen,
  ListOrdered,
  X,
  Clock,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  BadgeCheck,
  Play,
  Link2,
  ClipboardCheck,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll } from '@/lib/hooks/useRealtimePolls';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  POLL_MODE_LABELS,
  QUIZ_OPTION_COUNTS,
  RANKING_CANDIDATE_PRESETS,
  clampNumber,
  extractPollPayload,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getQuizQuestions,
  getRankingDisplayMode,
  getRankingWeights,
  optionLetter,
  rankLabel,
  type PollMode,
  type PollOption,
} from '@/lib/pollModes';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';
const HOST_SIDEBAR_COLLAPSED_KEY = 'host-sidebar-collapsed';

interface LinkedCourseSummary {
  code: string;
  name: string;
  teacher_name: string | null;
}

interface Room {
  id: string;
  code: string;
  title: string;
  status: string;
  host_id: string;
  moderation_enabled?: boolean;
  linked_course_code?: string | null;
  linked_course?: LinkedCourseSummary | null;
}

interface CourseOption {
  code: string;
  name: string;
  teacher_name: string | null;
  form_type?: string;
}

type HostTab = 'questions' | 'polls' | 'summary' | 'export' | 'integration';
type SortMode = 'popular' | 'newest';
type StatusFilter = 'all' | 'unanswered' | 'pending' | 'approved' | 'answered' | 'rejected';

interface QuizQuestionDraft {
  id: string;
  question: string;
  questionImageUrl: string;
  /** 作成者が設定する問題番号（章の概念は廃止） */
  questionNumber: number;
  options: string[];
  optionImages: string[];
  /** 0-based offset of the correct answer. null = 採点しない（任意） */
  correctOptionOffset: number | null;
}

const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];

// ライブ投票カードのアイコン/カラー（種類が一目で判別できるよう色相で差別化）
const POLL_MODE_VISUAL: Record<
  PollMode,
  {
    icon: React.ComponentType<{ className?: string }>;
    badgeBg: string;
    badgeText: string;
    badgeRing: string;
    iconBg: string;
    iconText: string;
    iconRing: string;
    cardRing: string;
  }
> = {
  standard: {
    icon: BarChart3,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeRing: 'ring-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
    iconRing: 'ring-emerald-200',
    cardRing: 'hover:ring-emerald-200',
  },
  quiz: {
    icon: BookOpen,
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    badgeRing: 'ring-violet-200',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-700',
    iconRing: 'ring-violet-200',
    cardRing: 'hover:ring-violet-200',
  },
  ranking: {
    icon: ListOrdered,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeRing: 'ring-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    iconRing: 'ring-amber-200',
    cardRing: 'hover:ring-amber-200',
  },
};

const HOST_NAV_ITEMS: Array<{
  key: HostTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'questions', label: '質問', description: '承認・回答管理', icon: MessageSquare },
  { key: 'polls', label: 'ライブ投票', description: 'カード作成・集計', icon: BarChart3 },
  { key: 'summary', label: 'サマリー', description: '状況の確認', icon: PieChart },
  { key: 'integration', label: '連携', description: '出席フォーム紐付け', icon: Link2 },
  { key: 'export', label: 'エクスポート', description: 'CSV出力', icon: Download },
];

function HostPageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[#dce8ff] bg-[#edf4ff] px-5 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#aac8ff] bg-[#dce8ff] text-[#2864f0]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight text-[#323232] sm:text-2xl">
              {title}
            </h1>
            <p className="mt-0.5 truncate text-xs text-[#595959] sm:text-sm">{description}</p>
          </div>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>}
      </div>
    </div>
  );
}

function HostInfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[#aac8ff] bg-[#ebf3ff]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[#23418c] sm:text-base">
          <Icon className="h-4 w-4 shrink-0 text-[#2864f0]" />
          <span className="truncate">{title}</span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#2864f0]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#2864f0]" />
        )}
      </button>
      {open && <div className="border-t border-[#aac8ff] px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function makeQuizQuestionDraft(index: number): QuizQuestionDraft {
  return {
    id: `quiz-${Date.now()}-${index}`,
    question: '',
    questionImageUrl: '',
    questionNumber: index + 1,
    options: Array.from({ length: 4 }, () => ''),
    optionImages: Array.from({ length: 4 }, () => ''),
    correctOptionOffset: null,
  };
}

export default function HostPage() {
  const params = useParams();
  const { data: session, status: authStatus } = useSession();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HostTab>('questions');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Question filters
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Poll creation
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showPollTypeModal, setShowPollTypeModal] = useState(false);
  const pollEditorRef = useRef<HTMLDivElement>(null);
  const [pollMode, setPollMode] = useState<PollMode>('standard');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMaxSelections, setPollMaxSelections] = useState(1);
  const [standardTimeLimit, setStandardTimeLimit] = useState(60);
  // 解答時間は全問題共通（1出題につき1つ）
  const [quizTimeLimit, setQuizTimeLimit] = useState(60);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([
    makeQuizQuestionDraft(0),
  ]);
  const [activeQuizQuestionIndex, setActiveQuizQuestionIndex] = useState(0);
  const [pollOptionImages, setPollOptionImages] = useState<string[]>(['', '']);
  const [rankingCandidateCount, setRankingCandidateCount] = useState(50);
  const [rankingRankCount, setRankingRankCount] = useState(3);
  const [rankingWeights, setRankingWeights] = useState([3, 2, 1]);
  const [rankingTimeLimit, setRankingTimeLimit] = useState(60);
  const [rankingDisplayMode, setRankingDisplayMode] = useState<'number' | 'number_text'>('number_text');
  const [rankingCandidateTexts, setRankingCandidateTexts] = useState<string[]>(
    Array.from({ length: 50 }, () => '')
  );
  const [creatingPoll, setCreatingPoll] = useState(false);
  // クイズ形式の編集・更新（null=新規作成 / pollId=編集中）
  const [editingPollId, setEditingPollId] = useState<string | null>(null);

  // Export
  const [exportData, setExportData] = useState<{
    stats?: {
      totalQuestions?: number;
      totalPolls?: number;
      totalUpvotes?: number;
      uniqueParticipants?: number;
      attendanceLinked?: boolean;
      totalAttendance?: number | null;
    };
    topQuestions?: Array<{ text: string; upvote_count: number }>;
  } | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'paid' | 'enterprise'>('free');
  const [pollPage, setPollPage] = useState(1);
  const [pollSearch, setPollSearch] = useState('');
  const POLLS_PER_PAGE = 6;
  const [roomStatusLoading, setRoomStatusLoading] = useState(false);
  const [pollStatusPendingId, setPollStatusPendingId] = useState<string | null>(null);
  const [pollDeletingId, setPollDeletingId] = useState<string | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [questionResetting, setQuestionResetting] = useState(false);
  const [exportLoadingType, setExportLoadingType] = useState<'questions' | 'polls' | null>(null);
  // 出席フォーム紐付け
  const [availableCourses, setAvailableCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [linkingCourse, setLinkingCourse] = useState(false);
  const [linkCourseError, setLinkCourseError] = useState<string | null>(null);
  // CSV エクスポート対象カード選択モーダル
  const [showPollExportPicker, setShowPollExportPicker] = useState(false);
  // 質問カードの操作中状態（id+action 単位でローディング）
  const [questionActionPending, setQuestionActionPending] = useState<Record<string, string | null>>({});

  const setActionFor = useCallback((id: string, action: string | null) => {
    setQuestionActionPending((prev) => {
      const next = { ...prev };
      if (action === null) delete next[id];
      else next[id] = action;
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(HOST_SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HOST_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const resetPollForm = useCallback((nextMode: PollMode = 'standard') => {
    setPollMode(nextMode);
    setPollQuestion('');
    const initialCount = nextMode === 'quiz' ? 4 : 2;
    setPollOptions(Array.from({ length: initialCount }, () => ''));
    setPollOptionImages(Array.from({ length: initialCount }, () => ''));
    setPollMaxSelections(1);
    setStandardTimeLimit(60);
    setQuizTimeLimit(60);
    setQuizQuestions([makeQuizQuestionDraft(0)]);
    setActiveQuizQuestionIndex(0);
    setRankingCandidateCount(50);
    setRankingRankCount(3);
    setRankingWeights([3, 2, 1]);
    setRankingTimeLimit(60);
    setRankingDisplayMode('number_text');
    setRankingCandidateTexts(Array.from({ length: 50 }, () => ''));
    setEditingPollId(null);
  }, []);

  const handleSelectPollMode = useCallback((nextMode: PollMode) => {
    resetPollForm(nextMode);
    setShowPollTypeModal(false);
    setShowCreatePoll(true);
  }, [resetPollForm]);

  const handleRankingRankCountChange = useCallback((value: unknown) => {
    const nextCount = clampNumber(value, 1, 10, 3);
    setRankingRankCount(nextCount);
    setRankingWeights((prev) =>
      Array.from({ length: nextCount }, (_, i) =>
        Number.isFinite(prev[i]) ? prev[i] : Math.max(1, nextCount - i)
      )
    );
  }, []);

  const handleRankingCandidateCountChange = useCallback((value: unknown) => {
    const nextCount = clampNumber(value, 10, 100, 50);
    setRankingCandidateCount(nextCount);
    setRankingCandidateTexts((prev) =>
      Array.from({ length: nextCount }, (_, i) => prev[i] || '')
    );
  }, []);

  // 問題/選択肢画像は Supabase Storage (`poll-images` バケット) にアップロードして URL を保存。
  // 旧 base64 経路（polls.options に埋め込み）は Disk IO 肥大の原因のため廃止。
  const [imageUploading, setImageUploading] = useState<Record<string, boolean>>({});
  const uploadPollImage = useCallback(
    async (file: File, callback: (url: string) => void, key: string) => {
      if (!file.type.startsWith('image/')) return;
      setImageUploading((prev) => ({ ...prev, [key]: true }));
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`/api/rooms/${roomCode}/upload-image`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const text = await res.text();
          console.error('upload failed', res.status, text);
          return;
        }
        const json = (await res.json()) as { url?: string };
        if (json.url) callback(json.url);
      } catch (err) {
        console.error('upload error', err);
      } finally {
        setImageUploading((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [roomCode]
  );

  const activeQuizQuestion = quizQuestions[activeQuizQuestionIndex] || quizQuestions[0];
  const updateQuizQuestion = useCallback(
    (index: number, updater: (question: QuizQuestionDraft) => QuizQuestionDraft) => {
      setQuizQuestions((prev) => prev.map((q, i) => (i === index ? updater(q) : q)));
    },
    []
  );

  // Fetch room
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setRoom(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [roomCode]);

  // Fetch plan info (Free / Pro / Enterprise) でライブ投票上限を判定
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetch('/api/v2/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const plan = data?.subscription?.plan;
        if (plan === 'paid' || plan === 'enterprise' || plan === 'free') {
          setUserPlan(plan);
        }
      })
      .catch(() => {});
  }, [authStatus]);

  // Generate QR
  useEffect(() => {
    const url = `${window.location.origin}/rooms/${roomCode}`;
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 256, margin: 2 }).then(setQrUrl);
    });
  }, [roomCode]);

  // Realtime
  const {
    questions,
    loading: qLoading,
    optimisticDelete,
    optimisticUpdateQuestions,
  } = useRealtimeQuestions(room?.id || null);
  const {
    polls,
    pollVotes,
    loading: pLoading,
    optimisticDeletePoll,
    optimisticUpsertPoll,
  } = useRealtimePolls(room?.id || null);
  const presenceCount = useRoomPresence(room?.id || null, session?.user?.email || null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleQuestion = useCallback(
    async (questionId: string, field: 'is_answered' | 'is_pinned') => {
      const q = questions.find((q) => q.id === questionId);
      if (!q) return;
      const action = field === 'is_answered' ? 'answered' : 'pinned';
      setActionFor(questionId, action);
      try {
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [field === 'is_answered' ? 'isAnswered' : 'isPinned']: !q[field],
          }),
        });
      } finally {
        setActionFor(questionId, null);
      }
    },
    [questions, roomCode, setActionFor]
  );

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      setActionFor(questionId, 'delete');
      try {
        optimisticDelete(questionId);
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, { method: 'DELETE' });
      } finally {
        setActionFor(questionId, null);
      }
    },
    [optimisticDelete, roomCode, setActionFor]
  );

  const handleSetQuestionStatus = useCallback(
    async (questionId: string, status: 'approved' | 'rejected' | 'pending') => {
      setActionFor(questionId, `status:${status}`);
      try {
        await fetch(`/api/rooms/${roomCode}/questions/${questionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      } finally {
        setActionFor(questionId, null);
      }
    },
    [roomCode, setActionFor]
  );

  const handleResetQuestions = useCallback(async () => {
    if (questionResetting) return;
    const resettableCount = questions.length;
    if (resettableCount === 0) return;
    if (
      !window.confirm(
        '現在表示対象になっている質問を画面上からリセットします。質問データは削除されず、CSVエクスポートには引き続き含まれます。よろしいですか？'
      )
    ) {
      return;
    }
    setQuestionResetting(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/questions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetVisible: true }),
      });
      if (!res.ok) throw new Error('Failed to reset questions');
      const json = (await res.json()) as {
        questions?: Parameters<typeof optimisticUpdateQuestions>[0];
      };
      optimisticUpdateQuestions(json.questions || []);
      setStatusFilter('approved');
      setExportData(null);
    } finally {
      setQuestionResetting(false);
    }
  }, [optimisticUpdateQuestions, questionResetting, questions, roomCode]);

  const loadAvailableCourses = useCallback(async () => {
    if (coursesLoaded || coursesLoading) return;
    setCoursesLoading(true);
    try {
      const res = await fetch('/api/v2/courses?teacher_email=self');
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as { courses?: Array<{ code: string; name: string; teacher_name: string | null; form_type?: string }> };
      const attendanceCourses = (data.courses || []).filter(
        (c) => !c.form_type || c.form_type === 'attendance'
      );
      setAvailableCourses(attendanceCourses);
      setCoursesLoaded(true);
    } catch {
      setLinkCourseError('出席フォームの一覧を取得できませんでした');
    } finally {
      setCoursesLoading(false);
    }
  }, [coursesLoaded, coursesLoading]);

  const handleLinkCourse = useCallback(
    async (nextCode: string | null) => {
      if (!room || linkingCourse) return;
      setLinkingCourse(true);
      setLinkCourseError(null);
      try {
        const res = await fetch(`/api/rooms/${roomCode}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkedCourseCode: nextCode }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || '紐付けに失敗しました');
        }
        const linked = nextCode
          ? availableCourses.find((c) => c.code === nextCode) || null
          : null;
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                linked_course_code: nextCode,
                linked_course: linked
                  ? { code: linked.code, name: linked.name, teacher_name: linked.teacher_name }
                  : null,
              }
            : null
        );
      } catch (e) {
        setLinkCourseError(e instanceof Error ? e.message : '紐付けに失敗しました');
      } finally {
        setLinkingCourse(false);
      }
    },
    [room, roomCode, linkingCourse, availableCourses]
  );

  const handleToggleModeration = useCallback(async () => {
    if (!room || moderationLoading) return;
    const next = !room.moderation_enabled;
    setModerationLoading(true);
    setRoom((prev) => (prev ? { ...prev, moderation_enabled: next } : null));
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationEnabled: next }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setRoom((prev) => (prev ? { ...prev, moderation_enabled: !next } : null));
    } finally {
      setModerationLoading(false);
    }
  }, [room, roomCode, moderationLoading]);

  const handleCreatePoll = async () => {
    const rankingOptions: PollOption[] =
      Array.from({ length: rankingCandidateCount }, (_, i) => {
        const text = rankingCandidateTexts[i]?.trim();
        return text || `候補 ${i + 1}`;
      });
    const validQuizQuestions = quizQuestions
      .map((q) => {
        const kept = q.options
          .map((o, i) => ({
            text: o.trim(),
            imageUrl: q.optionImages[i] || undefined,
            origIndex: i,
          }))
          .filter((o) => o.text);
        // 正解 offset を「空欄除外後」の並びに合わせて補正
        const correctOffset =
          q.correctOptionOffset !== null
            ? kept.findIndex((o) => o.origIndex === q.correctOptionOffset)
            : -1;
        return { ...q, kept, correctOffset };
      })
      .filter((q) => q.question.trim() && q.kept.length >= 2);
    const quizFlatOptions = validQuizQuestions.flatMap((q) =>
      q.kept.map((o) => ({ text: o.text, imageUrl: o.imageUrl }))
    );
    const validOptions =
      pollMode === 'ranking'
        ? rankingOptions
        : pollMode === 'quiz'
        ? quizFlatOptions
        : pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2 || (pollMode === 'quiz' && validQuizQuestions.length === 0)) return;
    setCreatingPoll(true);
    try {
      const finalMaxSelections =
        pollMode === 'ranking'
          ? clampNumber(rankingRankCount, 1, validOptions.length, 3)
          : pollMode === 'quiz'
          ? validQuizQuestions.length
          : Math.max(1, Math.min(pollMaxSelections, validOptions.length));
      const optionsPayload: PollOption[] =
        pollMode === 'quiz'
          ? quizFlatOptions
          : validOptions;
      let optionStart = 0;
      const quizQuestionMeta = validQuizQuestions.map((q) => {
        const optionCount = q.kept.length;
        const meta = {
          id: q.id,
          question: q.question.trim(),
          questionImageUrl: q.questionImageUrl || undefined,
          questionNumber: q.questionNumber,
          // 解答時間は全問共通（poll 単位の設定を各問にも反映）
          timeLimitSeconds: quizTimeLimit,
          optionStart,
          optionCount,
          // 出題した問題ごとに正解を保持（編集・更新でも引き継ぐ）
          correctOptionOffset: q.correctOffset >= 0 ? q.correctOffset : undefined,
        };
        optionStart += optionCount;
        return meta;
      });
      const payload = {
        question: pollQuestion.trim(),
        type: 'multiple_choice',
        mode: pollMode,
        meta: {
          mode: pollMode,
          timeLimitSeconds:
            pollMode === 'standard'
              ? standardTimeLimit
              : pollMode === 'quiz'
              ? quizTimeLimit
              : pollMode === 'ranking'
              ? rankingTimeLimit
              : undefined,
          quizQuestions: pollMode === 'quiz' ? quizQuestionMeta : undefined,
          optionCount: pollMode === 'quiz' ? validOptions.length : undefined,
          rankCount: pollMode === 'ranking' ? finalMaxSelections : undefined,
          candidateCount: pollMode === 'ranking' ? validOptions.length : undefined,
          rankingWeights:
            pollMode === 'ranking'
              ? getRankingWeights(finalMaxSelections, rankingWeights)
              : undefined,
          rankingDisplayMode: pollMode === 'ranking' ? rankingDisplayMode : undefined,
        },
        options: optionsPayload,
        maxSelections: finalMaxSelections,
        allowMultiple: pollMode === 'ranking' || finalMaxSelections > 1,
      };

      if (editingPollId) {
        const hadVotes = (pollVotes[editingPollId]?.length || 0) > 0;
        if (
          hadVotes &&
          !window.confirm(
            'このクイズには既に回答があります。更新すると既存の回答はリセットされます。よろしいですか？'
          )
        ) {
          setCreatingPoll(false);
          return;
        }
        const res = await fetch(`/api/rooms/${roomCode}/polls/${editingPollId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, resetVotes: true }),
        });
        if (!res.ok) throw new Error('Failed to update poll');
        const updatedPoll = (await res.json()) as Poll;
        optimisticUpsertPoll(updatedPoll, { clearVotes: true });
      } else {
        const res = await fetch(`/api/rooms/${roomCode}/polls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.error || 'Failed to create poll');
        }
        const createdPoll = (await res.json()) as Poll;
        optimisticUpsertPoll(createdPoll);
      }
      setExportData(null);
      resetPollForm(pollMode);
      setShowCreatePoll(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ライブ投票カードの作成に失敗しました';
      if (typeof window !== 'undefined' && message !== 'Failed to create poll') {
        window.alert(message);
      }
    } finally {
      setCreatingPoll(false);
    }
  };

  const handlePollStatus = async (pollId: string, status: string) => {
    setPollStatusPendingId(pollId);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update poll status');
      const updatedPoll = (await res.json()) as Poll;
      optimisticUpsertPoll(updatedPoll);
      setExportData(null);
    } finally {
      setPollStatusPendingId(null);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    setPollDeletingId(pollId);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete poll');
      optimisticDeletePoll(pollId);
      if (editingPollId === pollId) {
        resetPollForm();
        setShowCreatePoll(false);
      }
      setExportData(null);
    } finally {
      setPollDeletingId(null);
    }
  };

  const scrollToPollEditor = useCallback(() => {
    requestAnimationFrame(() => {
      pollEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // 同じクイズ形式を再利用するためのリセット（票削除＋タイマー初期化＋draft 化）
  const [pollResettingId, setPollResettingId] = useState<string | null>(null);
  const handleResetPoll = useCallback(
    async (pollId: string) => {
      if (
        !window.confirm(
          'このクイズのすべての回答・タイマーをリセットし、下書きに戻します。よろしいですか？'
        )
      )
        return;
      setPollResettingId(pollId);
      try {
        const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true }),
        });
        if (!res.ok) throw new Error('Failed to reset poll');
        const updatedPoll = (await res.json()) as Poll;
        optimisticUpsertPoll(updatedPoll, { clearVotes: true });
        setExportData(null);
      } finally {
        setPollResettingId(null);
      }
    },
    [optimisticUpsertPoll, roomCode]
  );

  // 通常投票・クイズ形式・ランキング形式を編集フォームに読み込む（編集・更新）
  const handleEditPoll = useCallback((poll: Poll) => {
    const { meta, options } = extractPollPayload(poll.options);
    const mode = getPollMode(meta.mode);
    if (mode === 'standard') {
      setPollMode('standard');
      setPollQuestion(poll.question || '');
      setPollOptions(options.map((o) => getPollOptionLabel(o, '')));
      setPollOptionImages(options.map((o) => getPollOptionImageUrl(o) || ''));
      setPollMaxSelections(Math.max(1, Number(poll.max_selections ?? 1)));
      setStandardTimeLimit(meta.timeLimitSeconds || 60);
      setEditingPollId(poll.id);
      setShowPollTypeModal(false);
      setShowCreatePoll(true);
      scrollToPollEditor();
      return;
    }
    if (mode === 'ranking') {
      const rankCount = Math.max(1, Number(poll.max_selections ?? meta.rankCount ?? 3));
      setPollMode('ranking');
      setPollQuestion(poll.question || '');
      setRankingCandidateCount(clampNumber(meta.candidateCount ?? options.length, 10, 100, 50));
      setRankingRankCount(rankCount);
      setRankingWeights(getRankingWeights(rankCount, meta.rankingWeights));
      setRankingTimeLimit(meta.timeLimitSeconds || 60);
      setRankingDisplayMode(getRankingDisplayMode(meta.rankingDisplayMode));
      setRankingCandidateTexts(
        Array.from({ length: clampNumber(meta.candidateCount ?? options.length, 10, 100, 50) }, (_, i) =>
          getPollOptionLabel(options[i], '')
        )
      );
      setEditingPollId(poll.id);
      setShowPollTypeModal(false);
      setShowCreatePoll(true);
      scrollToPollEditor();
      return;
    }
    if (mode !== 'quiz') return;
    const qs = getQuizQuestions(meta, options);
    const drafts: QuizQuestionDraft[] = qs.map((q, i) => {
      const slice = options.slice(q.optionStart, q.optionStart + q.optionCount);
      return {
        id: q.id || `quiz-${Date.now()}-${i}`,
        question: q.question || '',
        questionImageUrl: q.questionImageUrl || '',
        questionNumber: q.questionNumber || i + 1,
        options: slice.map((o) => getPollOptionLabel(o, '')),
        optionImages: slice.map((o) => getPollOptionImageUrl(o) || ''),
        correctOptionOffset:
          typeof q.correctOptionOffset === 'number' ? q.correctOptionOffset : null,
      };
    });
    setPollMode('quiz');
    setPollQuestion(poll.question || '');
    // 解答時間は全問共通: meta 優先、無ければ最初の問題から復元
    setQuizTimeLimit(meta.timeLimitSeconds || qs[0]?.timeLimitSeconds || 60);
    setQuizQuestions(drafts.length > 0 ? drafts : [makeQuizQuestionDraft(0)]);
    setActiveQuizQuestionIndex(0);
    setEditingPollId(poll.id);
    setShowPollTypeModal(false);
    setShowCreatePoll(true);
    scrollToPollEditor();
  }, [scrollToPollEditor]);

  const handleToggleRoomStatus = async () => {
    if (!room || roomStatusLoading) return;
    const newStatus = room.status === 'active' ? 'closed' : 'active';
    setRoomStatusLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setRoom((prev) => (prev ? { ...prev, status: newStatus } : null));
    } finally {
      setRoomStatusLoading(false);
    }
  };

  const downloadExportCSV = useCallback(
    async (type: 'questions' | 'polls', pollId?: string | null) => {
      if (exportLoadingType) return;
      setExportLoadingType(type);
      try {
        const qs = new URLSearchParams({ type, format: 'csv' });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone) qs.set('timeZone', timeZone);
        if (pollId) qs.set('pollId', pollId);
        const res = await fetch(`/api/rooms/${roomCode}/export?${qs.toString()}`);
        if (!res.ok) throw new Error('failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileSuffix = pollId ? `-${pollId.slice(0, 8)}` : '';
        a.download = `${type}-${roomCode}${fileSuffix}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      } finally {
        setExportLoadingType(null);
      }
    },
    [exportLoadingType, roomCode]
  );

  // 質問CSV は対象選択なしで即ダウンロード、投票CSV は対象カードを必ず選んでもらう
  const handleExportCSV = useCallback(
    (type: 'questions' | 'polls') => {
      if (exportLoadingType) return;
      if (type === 'polls') {
        setShowPollExportPicker(true);
        return;
      }
      void downloadExportCSV(type);
    },
    [downloadExportCSV, exportLoadingType]
  );

  // Fetch summary for export tab
  useEffect(() => {
    if ((tab === 'export' || tab === 'summary') && !exportData) {
      fetch(`/api/rooms/${roomCode}/export?type=summary`)
        .then((r) => r.json())
        .then(setExportData)
        .catch(() => {});
    }
  }, [tab, exportData, roomCode]);

  // 出席フォーム選択候補は連携タブを開いたタイミングで遅延ロード
  useEffect(() => {
    if (tab === 'integration') {
      void loadAvailableCourses();
    }
  }, [tab, loadAvailableCourses]);

  useEffect(() => {
    setPollPage(1);
  }, [pollSearch]);

  // ==== カウント計算（pillsバッジ・サマリー両方で利用） ====
  const counts = useMemo(() => {
    const all = questions.length;
    const pending = questions.filter((q) => q.status === 'pending').length;
    const rejected = questions.filter((q) => q.status === 'rejected').length;
    const answered = questions.filter((q) => q.is_answered && q.status !== 'rejected').length;
    const approved = questions.filter(
      (q) => (q.status === undefined || q.status === 'approved') && !q.is_answered
    ).length;
    const unanswered = questions.filter((q) => !q.is_answered && q.status !== 'rejected').length;
    return { all, pending, rejected, answered, approved, unanswered };
  }, [questions]);

  // ==== フィルタ + ソート ====
  const filteredQuestions = useMemo(() => {
    const filterFn = (() => {
      switch (statusFilter) {
        case 'pending':
          return (q: typeof questions[number]) => q.status === 'pending';
        case 'rejected':
          return (q: typeof questions[number]) => q.status === 'rejected';
        case 'answered':
          return (q: typeof questions[number]) => q.is_answered && q.status !== 'rejected';
        case 'approved':
          return (q: typeof questions[number]) =>
            (q.status === undefined || q.status === 'approved') && !q.is_answered;
        case 'unanswered':
          return (q: typeof questions[number]) => !q.is_answered && q.status !== 'rejected';
        case 'all':
        default:
          return () => true;
      }
    })();

    const filtered = questions.filter(filterFn);
    if (sortMode === 'newest') {
      return [...filtered].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return [...filtered].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return (
        b.upvote_count - a.upvote_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [questions, statusFilter, sortMode]);

  const filteredPolls = useMemo(() => {
    const query = pollSearch.trim().toLowerCase();
    const visible = polls.filter((poll) => poll.id !== editingPollId);
    if (!query) return visible;
    return visible.filter((poll) => {
      const { meta, options } = extractPollPayload(poll.options);
      const mode = getPollMode(meta.mode || poll.type);
      const optionText = options.map((option, index) =>
        getPollOptionLabel(option, `選択肢 ${index + 1}`)
      );
      const quizText = getQuizQuestions(meta, options).map((question) => question.question);
      return [
        poll.question,
        poll.status,
        poll.type,
        POLL_MODE_LABELS[mode],
        ...optionText,
        ...quizText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [editingPollId, pollSearch, polls]);

  // Auth check
  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm sm:text-base text-slate-400">
        読み込み中...
      </div>
    );
  }
  if (!session || !room || room.host_id !== session.user?.email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm sm:text-base text-slate-500">このルームへのアクセス権がありません</p>
        <Link href="/rooms" className="text-sm sm:text-base text-emerald-600 hover:underline font-semibold">
          戻る
        </Link>
      </div>
    );
  }

  const totalUpvotes = questions.reduce((sum, q) => sum + (q.upvote_count || 0), 0);
  const totalPolls = polls.length;
  const totalParticipants =
    exportData?.stats?.uniqueParticipants ?? Math.max(presenceCount, 0);
  const selectedEditingPoll = editingPollId ? polls.find((poll) => poll.id === editingPollId) : null;
  const pollLimit = userPlan === 'free' ? 2 : Infinity;
  const atPollLimit = Number.isFinite(pollLimit) && polls.length >= pollLimit;
  const resettableQuestionCount = questions.length;
  const activeHostItem = HOST_NAV_ITEMS.find((item) => item.key === tab) || HOST_NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#f7f5f5] lg:flex">
      <HostSideNav
        room={room}
        roomCode={roomCode}
        activeTab={tab}
        onSelectTab={setTab}
        presenceCount={Math.max(presenceCount, 1)}
        qrUrl={qrUrl}
        copied={copied}
        onCopyCode={handleCopyCode}
        roomStatus={room.status}
        roomStatusLoading={roomStatusLoading}
        onToggleRoomStatus={handleToggleRoomStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#e9e7e7] bg-white">
        <HostPageHeader
          title={activeHostItem.label}
          description={`${room.title} / ${activeHostItem.description}`}
          icon={activeHostItem.icon}
        >
            <a
              href={`/rooms/${roomCode}/present`}
              target={`zasekikun-present-${roomCode}`}
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e1dcdc] bg-white text-[#2864f0] transition-colors hover:border-[#aac8ff] hover:bg-[#ebf3ff]"
              title="スクリーン画面を開く"
            >
              <Monitor className="w-4 h-4" />
            </a>
            <button
              type="button"
              disabled={roomStatusLoading}
              onClick={handleToggleRoomStatus}
              className={`inline-flex h-9 min-w-[5rem] items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                room.status === 'active'
                  ? 'bg-[#dc1e32] text-white hover:bg-[#a51428]'
                  : 'bg-[#2864f0] text-white hover:bg-[#285ac8]'
              }`}
            >
              {roomStatusLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : room.status === 'active' ? (
                <>
                  <StopCircle className="w-3.5 h-3.5" />
                  終了
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  再開
                </>
              )}
            </button>
        </HostPageHeader>

        {/* Mobile tabs */}
        <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-5 -mb-px lg:hidden">
          {(
            [
              { key: 'questions', icon: <MessageSquare className="w-4 h-4" />, label: '質問' },
              { key: 'polls', icon: <BarChart3 className="w-4 h-4" />, label: 'ライブ投票' },
              { key: 'summary', icon: <PieChart className="w-4 h-4" />, label: 'サマリー' },
              { key: 'integration', icon: <Link2 className="w-4 h-4" />, label: '連携' },
              { key: 'export', icon: <Download className="w-4 h-4" />, label: 'エクスポート' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-1 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-[#2864f0] text-[#2864f0]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-6xl px-5 py-5">
        {/* === Questions Tab === */}
        {tab === 'questions' && (
          <div className="space-y-4">
            {/* Moderation toggle (always visible) */}
            <div className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 px-4 py-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {room.moderation_enabled ? (
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                ) : (
                  <ShieldOff className="w-5 h-5 shrink-0 text-slate-400" />
                )}
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    承認制：
                    <span className={room.moderation_enabled ? 'text-emerald-700' : 'text-slate-500'}>
                      {room.moderation_enabled ? 'ON' : 'OFF'}
                    </span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-tight mt-0.5">
                    {room.moderation_enabled
                      ? '新規質問は承認後に公開されます'
                      : '新規質問は即時公開されます'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!room.moderation_enabled}
                disabled={moderationLoading}
                onClick={handleToggleModeration}
                title={room.moderation_enabled ? '承認制をOFFにする' : '承認制をONにする'}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  room.moderation_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    room.moderation_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                >
                  {moderationLoading && (
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  )}
                </span>
              </button>
            </div>
            {room.moderation_enabled && counts.pending > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2.5 text-xs sm:text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <p className="flex-1">
                  <span className="font-bold">{counts.pending}</span> 件が承認待ちです
                </p>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
                >
                  確認する
                </button>
              </div>
            )}

            {/* Sort + Status pills */}
            <div className="flex flex-wrap items-center gap-2">
              <SortPill active={sortMode === 'popular'} onClick={() => setSortMode('popular')}>
                人気順
              </SortPill>
              <SortPill active={sortMode === 'newest'} onClick={() => setSortMode('newest')}>
                新着順
              </SortPill>
              <span className="w-px h-5 bg-slate-200 mx-1" />
              <FilterPill
                active={statusFilter === 'unanswered'}
                onClick={() => setStatusFilter('unanswered')}
              >
                未回答
              </FilterPill>
              <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                全て ({counts.all})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'pending'}
                onClick={() => setStatusFilter('pending')}
              >
                承認待ち ({counts.pending})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'approved'}
                onClick={() => setStatusFilter('approved')}
              >
                公開中 ({counts.approved})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'answered'}
                onClick={() => setStatusFilter('answered')}
              >
                回答済 ({counts.answered})
              </FilterPill>
              <FilterPill
                active={statusFilter === 'rejected'}
                onClick={() => setStatusFilter('rejected')}
              >
                非表示 ({counts.rejected})
              </FilterPill>
              <button
                type="button"
                disabled={questionResetting || resettableQuestionCount === 0}
                onClick={handleResetQuestions}
                title="画面上の質問をリセット"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs sm:text-sm font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40"
              >
                {questionResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                リセット
              </button>
            </div>

            {qLoading ? (
              <p className="text-center text-sm text-slate-400 py-10">読み込み中...</p>
            ) : filteredQuestions.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 py-14 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">該当する質問はありません</p>
                <p className="text-xs text-slate-400 mt-1">フィルタを切り替えて確認してみましょう</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredQuestions.map((q) => (
                    <HostQuestionRow
                      key={q.id}
                      q={q}
                      pendingAction={questionActionPending[q.id] ?? null}
                      onToggleAnswered={() => handleToggleQuestion(q.id, 'is_answered')}
                      onTogglePinned={() => handleToggleQuestion(q.id, 'is_pinned')}
                      onApprove={() => handleSetQuestionStatus(q.id, 'approved')}
                      onReject={() => handleSetQuestionStatus(q.id, 'rejected')}
                      onUnreject={() => handleSetQuestionStatus(q.id, 'approved')}
                      onDelete={() => handleDeleteQuestion(q.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* === Polls Tab === */}
        {tab === 'polls' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8989]" />
                <input
                  value={pollSearch}
                  onChange={(e) => setPollSearch(e.target.value)}
                  placeholder="投票タイトル・選択肢・形式で検索"
                  className="h-9 w-full rounded-md border border-[#cccccc] bg-white pl-9 pr-3 text-sm text-[#323232] outline-none focus:border-[#2864f0] focus:ring-2 focus:ring-[#dce8ff]"
                />
              </div>
              <div className="flex items-center gap-2">
                {pollSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setPollSearch('')}
                    className="text-xs font-bold text-[#2864f0] hover:text-[#285ac8]"
                  >
                    クリア
                  </button>
                )}
              {room.status === 'active' && (
                <button
                  onClick={() => setShowPollTypeModal(true)}
                  disabled={atPollLimit}
                  title={atPollLimit ? `Freeプランではライブ投票カードを${pollLimit}個まで作成できます` : undefined}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2864f0] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                >
                  <Plus className="w-4 h-4" />
                  新規作成
                </button>
              )}
              </div>
            </div>

            {atPollLimit && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Freeプランのライブ投票カードは{pollLimit}個までです</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  Proプランにアップグレードすると、ライブ投票カードを無制限に作成できます（1ページに最大{POLLS_PER_PAGE}件表示、超過分はページ送りで表示されます）。
                </p>
              </div>
            )}

            <AnimatePresence>
              {showPollTypeModal && (
                <PollTypeModal
                  onClose={() => setShowPollTypeModal(false)}
                  onSelect={handleSelectPollMode}
                />
              )}
            </AnimatePresence>

            <HostInfoCard title="ライブ投票について" icon={BookOpen}>
              <ul className="space-y-1.5 text-xs leading-relaxed text-[#23418c] sm:text-sm">
                <li>• <strong>通常投票</strong>：選択肢から回答してもらう基本の投票です。複数選択にも対応します。</li>
                <li>• <strong>クイズ形式</strong>：複数の問題をまとめて出題し、正解を設定して回答結果を確認できます。</li>
                <li>• <strong>ランキング形式</strong>：候補を順位で回答してもらい、順位ごとの重みでランキングを集計します。</li>
                <li>• <strong>リセット</strong>：直近の回答結果をリセットして同じカードを繰り返し利用できます。リセットした回答結果もカードに蓄積され、CSVデータとして出力できます。</li>
                <li>• 投票時間を設定した場合は、スクリーン画面の「開始」ボタンを押すと投票がスタートし、設定した時間でカウントダウンします。</li>
              </ul>
            </HostInfoCard>

            {/* Create poll form */}
            <AnimatePresence>
              {showCreatePoll && (
                <motion.div
                  ref={pollEditorRef}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="scroll-mt-24 rounded-2xl bg-white ring-1 ring-slate-200 p-5 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-1 rounded-full">
                        {POLL_MODE_LABELS[pollMode]}
                      </span>
                      <h3 className="mt-2 text-base font-bold text-slate-900">
                        {editingPollId
                          ? pollMode === 'standard'
                            ? '通常投票を編集'
                            : pollMode === 'quiz'
                            ? 'クイズ形式を編集'
                            : 'ランキング形式を編集'
                          : pollMode === 'standard'
                          ? '通常投票を作成'
                          : pollMode === 'quiz'
                          ? 'クイズ形式を作成'
                          : 'ランキング形式を作成'}
                      </h3>
                      {editingPollId && selectedEditingPoll && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          選択中のカード「{selectedEditingPoll.question}」をこの画面で編集しています
                        </p>
                      )}
                    </div>
                    {!editingPollId && (
                      <button
                        type="button"
                        onClick={() => setShowPollTypeModal(true)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        種類を変更
                      </button>
                    )}
                  </div>
                  <div className={pollMode === 'quiz' ? 'flex flex-wrap items-center gap-2' : ''}>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder={pollMode === 'quiz' ? 'クイズタイトル（例: 確認問題）' : pollMode === 'ranking' ? '投票タイトル（例: ランキングテーマを選んでください）' : '質問文（例: 今日の授業の理解度は？）'}
                      className={`h-11 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 focus:bg-white focus:ring-emerald-300 outline-none transition-colors text-sm ${
                        pollMode === 'quiz' ? 'min-w-[180px] flex-1' : 'w-full'
                      }`}
                      style={{ fontSize: '16px' }}
                    />
                    {pollMode === 'quiz' && (
                      <>
                        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 px-2 py-1 ring-1 ring-slate-200">
                          <button
                            type="button"
                            onClick={() => setActiveQuizQuestionIndex((i) => Math.max(0, i - 1))}
                            disabled={activeQuizQuestionIndex === 0}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="前の問題"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-1 text-xs font-bold tabular-nums text-slate-700">
                            {activeQuizQuestionIndex + 1} / {quizQuestions.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveQuizQuestionIndex((i) => Math.min(quizQuestions.length - 1, i + 1))}
                            disabled={activeQuizQuestionIndex >= quizQuestions.length - 1}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="次の問題"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <div className="ml-1 flex items-center gap-0.5">
                            {quizQuestions.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setActiveQuizQuestionIndex(i)}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === activeQuizQuestionIndex ? 'w-4 bg-emerald-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                                }`}
                                aria-label={`問題 ${i + 1} を表示`}
                              />
                            ))}
                          </div>
                        </div>
                        <label className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1 ring-1 ring-slate-200">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <input
                            type="number"
                            min={5}
                            max={3600}
                            value={quizTimeLimit}
                            onChange={(e) =>
                              setQuizTimeLimit(clampNumber(e.target.value, 5, 3600, 60))
                            }
                            className="h-7 w-16 rounded-md bg-white px-2 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none focus:ring-emerald-300"
                            style={{ fontSize: '16px' }}
                            aria-label="解答時間（全問題共通・秒）"
                          />
                          <span className="text-xs font-semibold text-slate-500">秒</span>
                        </label>
                      </>
                    )}
                  </div>

                  {pollMode === 'quiz' && (
                    <div className="space-y-4">
                      {activeQuizQuestion && (
                        <div className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200">
                          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={activeQuizQuestion.options.length}
                                onChange={(e) => {
                                  const count = Number(e.target.value);
                                  updateQuizQuestion(activeQuizQuestionIndex, (q) => ({
                                    ...q,
                                    options: Array.from({ length: count }, (_, optionIndex) => q.options[optionIndex] || ''),
                                    optionImages: Array.from({ length: count }, (_, optionIndex) => q.optionImages[optionIndex] || ''),
                                    correctOptionOffset:
                                      q.correctOptionOffset !== null && q.correctOptionOffset < count
                                        ? q.correctOptionOffset
                                        : null,
                                  }));
                                }}
                                className="h-9 rounded-lg bg-white px-2 text-xs font-semibold ring-1 ring-slate-200"
                              >
                                {QUIZ_OPTION_COUNTS.map((count) => (
                                  <option key={count} value={count}>{count}択</option>
                                ))}
                              </select>
                              {quizQuestions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuizQuestions((prev) => prev.filter((_, i) => i !== activeQuizQuestionIndex));
                                    setActiveQuizQuestionIndex((i) => Math.max(0, Math.min(i, quizQuestions.length - 2)));
                                  }}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                                  title="問題を削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <textarea
                            value={activeQuizQuestion.question}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateQuizQuestion(activeQuizQuestionIndex, (q) => ({ ...q, question: value }));
                            }}
                            placeholder="問題文を入力してください"
                            className="min-h-[88px] w-full resize-y rounded-xl bg-white px-4 py-3 text-lg leading-relaxed font-medium ring-1 ring-slate-200 outline-none focus:ring-emerald-300"
                            style={{ fontSize: '18px' }}
                          />

                          <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-500">問題画像</p>
                              <p className="text-[11px] text-slate-400">
                                推奨: 1600x900px（16:9）/ 10MB以内
                              </p>
                              <label
                                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-50 px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 ${
                                  imageUploading[`${activeQuizQuestion.id}-question`]
                                    ? 'pointer-events-none opacity-60'
                                    : ''
                                }`}
                                title="問題文に画像をアップロード"
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    const key = `${activeQuizQuestion.id}-question`;
                                    if (file) {
                                      void uploadPollImage(
                                        file,
                                        (url) => {
                                          updateQuizQuestion(activeQuizQuestionIndex, (q) => ({
                                            ...q,
                                            questionImageUrl: url,
                                          }));
                                        },
                                        key
                                      );
                                    }
                                    e.target.value = '';
                                  }}
                                />
                                {imageUploading[`${activeQuizQuestion.id}-question`] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ImageIcon className="h-4 w-4" />
                                )}
                                アップロード
                              </label>
                            </div>
                            {activeQuizQuestion.questionImageUrl && (
                              <div className="relative mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
                                <img
                                  src={activeQuizQuestion.questionImageUrl}
                                  alt={`問題 ${activeQuizQuestion.questionNumber} の画像`}
                                  className="max-h-72 w-full object-contain bg-slate-50"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuizQuestion(activeQuizQuestionIndex, (q) => ({
                                      ...q,
                                      questionImageUrl: '',
                                    }))
                                  }
                                  title="画像を削除"
                                  aria-label="画像を削除"
                                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white ring-2 ring-white hover:bg-rose-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="mt-3">
                            <label className="text-xs sm:text-sm text-slate-600">
                              問題番号
                              <select
                                value={activeQuizQuestion.questionNumber}
                                onChange={(e) => {
                                  const questionNumber = Number(e.target.value);
                                  updateQuizQuestion(activeQuizQuestionIndex, (q) => ({ ...q, questionNumber }));
                                }}
                                className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-slate-200 outline-none focus:ring-emerald-300 sm:w-40"
                              >
                                {Array.from({ length: 50 }, (_, i) => i + 1).map((number) => (
                                  <option key={number} value={number}>
                                    問題 {number}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-slate-500">解答の選択肢（画像添付可）</p>
                            <p className="text-[11px] text-slate-400">
                              推奨画像: 1200x800px（3:2）/ 10MB以内
                            </p>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            任意: ✓で正解を設定（未設定でもクイズにできます）
                          </p>
                          <div className="mt-1.5 space-y-2">
                            {activeQuizQuestion.options.map((opt, optionIndex) => {
                              const isCorrect = activeQuizQuestion.correctOptionOffset === optionIndex;
                              return (
                              <div key={optionIndex} className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuizQuestion(activeQuizQuestionIndex, (q) => ({
                                      ...q,
                                      correctOptionOffset:
                                        q.correctOptionOffset === optionIndex ? null : optionIndex,
                                    }))
                                  }
                                  title={isCorrect ? '正解（クリックで解除）' : '正解に設定'}
                                  aria-label={isCorrect ? '正解（クリックで解除）' : '正解に設定'}
                                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white ring-emerald-600'
                                      : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <BadgeCheck className="h-5 w-5" />
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    updateQuizQuestion(activeQuizQuestionIndex, (q) => {
                                      const options = [...q.options];
                                      options[optionIndex] = value;
                                      return { ...q, options };
                                    });
                                  }}
                                  placeholder={`解答 ${optionLetter(optionIndex)}`}
                                  className={`h-11 flex-1 rounded-xl bg-white px-3 text-sm ring-1 outline-none focus:ring-emerald-300 ${
                                    isCorrect ? 'ring-emerald-300' : 'ring-slate-200'
                                  }`}
                                  style={{ fontSize: '16px' }}
                                />
                                <label
                                  className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 ${
                                    imageUploading[`${activeQuizQuestion.id}-${optionIndex}`]
                                      ? 'pointer-events-none opacity-60'
                                      : ''
                                  }`}
                                  title="選択肢に画像をアップロード"
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      const key = `${activeQuizQuestion.id}-${optionIndex}`;
                                      if (file) {
                                        void uploadPollImage(
                                          file,
                                          (url) => {
                                            updateQuizQuestion(activeQuizQuestionIndex, (q) => {
                                              const optionImages = [...q.optionImages];
                                              optionImages[optionIndex] = url;
                                              return { ...q, optionImages };
                                            });
                                          },
                                          key
                                        );
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                  {imageUploading[`${activeQuizQuestion.id}-${optionIndex}`] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ImageIcon className="w-4 h-4" />
                                  )}
                                </label>
                                {activeQuizQuestion.optionImages[optionIndex] && (
                                  <div className="relative h-11 w-11 shrink-0">
                                    <img
                                      src={activeQuizQuestion.optionImages[optionIndex]}
                                      alt={`解答 ${optionLetter(optionIndex)} の画像`}
                                      className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQuizQuestion(activeQuizQuestionIndex, (q) => {
                                          const optionImages = [...q.optionImages];
                                          optionImages[optionIndex] = '';
                                          return { ...q, optionImages };
                                        })
                                      }
                                      title="画像を削除"
                                      aria-label="画像を削除"
                                      className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white ring-2 ring-white hover:bg-rose-600"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nextQuestion = makeQuizQuestionDraft(quizQuestions.length);
                            setQuizQuestions((prev) => [...prev, nextQuestion]);
                            setActiveQuizQuestionIndex(quizQuestions.length);
                          }}
                          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
                        >
                          <Plus className="w-4 h-4" />
                          問題を追加
                        </button>
                        <div className="ml-auto flex items-center gap-1">
                          {quizQuestions.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setActiveQuizQuestionIndex(i)}
                              className={`h-2.5 rounded-full transition-all ${
                                i === activeQuizQuestionIndex ? 'w-6 bg-emerald-500' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                              }`}
                              aria-label={`問題 ${i + 1} を表示`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {pollMode === 'standard' ? (
                    pollOptions.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...pollOptions];
                            updated[i] = e.target.value;
                            setPollOptions(updated);
                          }}
                          placeholder={`選択肢 ${i + 1}`}
                          className="flex-1 h-11 px-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-emerald-300 focus:bg-white outline-none transition-colors text-sm"
                          style={{ fontSize: '16px' }}
                        />
                        {pollMode === 'standard' && pollOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPollOptions(pollOptions.filter((_, j) => j !== i));
                              setPollOptionImages(pollOptionImages.filter((_, j) => j !== i));
                            }}
                            className="text-rose-400 hover:text-rose-600 px-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : pollMode === 'ranking' ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs sm:text-sm text-slate-600">
                          候補数
                          <select
                            value={rankingCandidateCount}
                            onChange={(e) => handleRankingCandidateCountChange(e.target.value)}
                            className="mt-1 h-11 w-full rounded-xl bg-slate-50 px-3 font-semibold ring-1 ring-slate-200 outline-none"
                          >
                            {RANKING_CANDIDATE_PRESETS.map((count) => (
                              <option key={count} value={count}>{count}件</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs sm:text-sm text-slate-600">
                          1人あたりの回答順位数
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={rankingRankCount}
                            onChange={(e) => handleRankingRankCountChange(e.target.value)}
                            className="mt-1 h-11 w-full rounded-xl bg-slate-50 px-3 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                            style={{ fontSize: '16px' }}
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs sm:text-sm text-slate-600">
                          投票時間
                          <div className="mt-1 flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={3600}
                              value={rankingTimeLimit}
                              onChange={(e) => setRankingTimeLimit(clampNumber(e.target.value, 0, 3600, 60))}
                              className="h-11 w-full rounded-xl bg-slate-50 px-3 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                              style={{ fontSize: '16px' }}
                            />
                            <span className="shrink-0 text-xs font-semibold text-slate-400">秒</span>
                          </div>
                        </label>
                        <label className="text-xs sm:text-sm text-slate-600">
                          候補の表示
                          <select
                            value={rankingDisplayMode}
                            onChange={(e) => setRankingDisplayMode(getRankingDisplayMode(e.target.value))}
                            className="mt-1 h-11 w-full rounded-xl bg-slate-50 px-3 font-semibold ring-1 ring-slate-200 outline-none"
                          >
                            <option value="number_text">番号とテキスト（1: A組）</option>
                            <option value="number">番号のみ（1）</option>
                          </select>
                        </label>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-bold text-slate-600">順位ごとの重み</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                          点数制で集計します。例: 1位=3点、2位=2点、3位=1点の場合、各候補の合計点でランキングを決定します。
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {Array.from({ length: rankingRankCount }).map((_, rankIndex) => (
                            <label key={rankIndex} className="text-[11px] font-semibold text-slate-500">
                              {rankLabel(rankIndex)}
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={rankingWeights[rankIndex] ?? Math.max(1, rankingRankCount - rankIndex)}
                                onChange={(e) => {
                                  const next = [...rankingWeights];
                                  next[rankIndex] = clampNumber(e.target.value, 0, 999, Math.max(1, rankingRankCount - rankIndex));
                                  setRankingWeights(next);
                                }}
                                className="mt-1 h-9 w-full rounded-lg bg-white px-2 text-center font-bold tabular-nums ring-1 ring-slate-200 outline-none"
                                style={{ fontSize: '16px' }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      {rankingDisplayMode === 'number_text' && (
                        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                          <p className="text-xs font-bold text-slate-600">候補テキスト</p>
                          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                            {Array.from({ length: rankingCandidateCount }).map((_, i) => (
                              <label key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white px-2 text-slate-600 ring-1 ring-slate-200 tabular-nums">
                                  {i + 1}
                                </span>
                                <input
                                  type="text"
                                  value={rankingCandidateTexts[i] || ''}
                                  onChange={(e) => {
                                    const next = [...rankingCandidateTexts];
                                    next[i] = e.target.value;
                                    setRankingCandidateTexts(next);
                                  }}
                                  placeholder={`候補 ${i + 1}`}
                                  className="h-9 min-w-0 flex-1 rounded-lg bg-white px-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-emerald-300"
                                  style={{ fontSize: '16px' }}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {pollMode === 'standard' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        投票時間
                        <input
                          type="number"
                          min={0}
                          max={3600}
                          value={standardTimeLimit}
                          onChange={(e) => setStandardTimeLimit(clampNumber(e.target.value, 0, 3600, 60))}
                          className="h-9 w-20 rounded-lg bg-slate-50 px-2 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                          style={{ fontSize: '16px' }}
                        />
                        <span className="text-slate-400">秒</span>
                      </label>
                      {pollOptions.length < 8 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPollOptions([...pollOptions, '']);
                            setPollOptionImages([...pollOptionImages, '']);
                          }}
                          className="text-sm text-emerald-700 hover:text-emerald-800 font-semibold"
                        >
                          + 選択肢を追加
                        </button>
                      )}
                      <label className="ml-auto inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        1人あたりの最大選択数
                        <input
                          type="number"
                          min={1}
                          max={Math.max(2, pollOptions.filter((o) => o.trim()).length || 2)}
                          value={pollMaxSelections}
                          onChange={(e) =>
                            setPollMaxSelections(Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-16 h-9 px-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 focus:ring-emerald-300 focus:bg-white outline-none text-center font-semibold tabular-nums"
                          style={{ fontSize: '16px' }}
                        />
                        <span className="text-slate-400">/ {pollOptions.filter((o) => o.trim()).length || 0}</span>
                      </label>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreatePoll}
                      disabled={
                        creatingPoll ||
                        !pollQuestion.trim() ||
                        (pollMode === 'standard' && pollOptions.filter((o) => o.trim()).length < 2) ||
                        (pollMode === 'quiz' &&
                          !quizQuestions.some((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2))
                      }
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-4 h-10 rounded-lg text-sm transition-colors"
                    >
                      {creatingPoll
                        ? editingPollId
                          ? '更新中...'
                          : '作成中...'
                        : editingPollId
                        ? '更新する'
                        : '作成する'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreatePoll(false);
                        setEditingPollId(null);
                      }}
                      className="text-slate-500 hover:text-slate-800 font-semibold px-4 h-10 rounded-lg text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : polls.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 py-14 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-3">
                  <BarChart3 className="w-7 h-7 text-emerald-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">まだライブ投票はありません</p>
                <p className="text-xs text-slate-400 mt-1">右上の「新規作成」から作成できます</p>
              </div>
            ) : polls.length > 0 ? (
              (() => {
                const totalPages = Math.max(1, Math.ceil(filteredPolls.length / POLLS_PER_PAGE));
                const currentPage = Math.min(pollPage, totalPages);
                const pageStart = (currentPage - 1) * POLLS_PER_PAGE;
                const pagedPolls = filteredPolls.slice(pageStart, pageStart + POLLS_PER_PAGE);
                return (
                  <>
                    {filteredPolls.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-[#e9e7e7] bg-white px-4 py-14 text-center">
                        <Search className="mb-3 h-8 w-8 text-[#aac8ff]" />
                        <p className="text-sm font-bold text-[#323232]">一致するライブ投票はありません</p>
                        <p className="mt-1 text-xs text-[#595959]">検索条件を変更してください。</p>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {pagedPolls.map((poll) => (
                        <PollResultCard
                          key={poll.id}
                          poll={poll}
                          votes={pollVotes[poll.id] || []}
                          pendingId={pollStatusPendingId}
                          deletingId={pollDeletingId}
                          editing={editingPollId === poll.id}
                          onStart={() => handlePollStatus(poll.id, 'active')}
                          onClose={() => handlePollStatus(poll.id, 'closed')}
                          onDelete={() => handleDeletePoll(poll.id)}
                          onEdit={() => handleEditPoll(poll)}
                          onReset={() => handleResetPoll(poll.id)}
                          resetting={pollResettingId === poll.id}
                        />
                      ))}
                    </div>
                    )}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setPollPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="h-9 px-3 rounded-lg text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          前へ
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setPollPage(page)}
                            aria-current={page === currentPage ? 'page' : undefined}
                            className={`h-9 min-w-9 px-3 rounded-lg text-sm font-semibold transition-colors ${
                              page === currentPage
                                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/60'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPollPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="h-9 px-3 rounded-lg text-sm font-semibold text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          次へ
                        </button>
                      </div>
                    )}
                  </>
                );
              })()
            ) : null}
          </div>
        )}

        {/* === Summary Tab === */}
        {tab === 'summary' && (
          <SummaryTab
            counts={counts}
            totalQuestions={questions.length}
            totalUpvotes={totalUpvotes}
            totalPolls={totalPolls}
            totalParticipants={totalParticipants}
            attendanceLinked={!!room.linked_course_code}
            totalAttendance={exportData?.stats?.totalAttendance ?? null}
            topQuestions={[...questions]
              .sort((a, b) => b.upvote_count - a.upvote_count)
              .slice(0, 5)}
          />
        )}

        {/* === Integration Tab === */}
        {tab === 'integration' && (
          <div className="space-y-5">
            {/* 出席フォーム紐付け */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">出席フォームと紐づける</h4>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                      紐づけると、参加者ページに「出席」タブが追加され、ルーム参加と同じ画面から位置情報付きの出席登録ができます。
                    </p>
                  </div>
                </div>
                {room.linked_course && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                    <BadgeCheck className="w-3 h-3" />
                    紐付け済み
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <select
                  value={room.linked_course_code || ''}
                  onChange={(e) => handleLinkCourse(e.target.value || null)}
                  disabled={linkingCourse || coursesLoading}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 focus:outline-none disabled:opacity-60"
                >
                  <option value="">{coursesLoading ? '読み込み中...' : '紐付けなし'}</option>
                  {availableCourses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}（#{c.code}）
                    </option>
                  ))}
                </select>
                {room.linked_course_code && (
                  <button
                    type="button"
                    onClick={() => handleLinkCourse(null)}
                    disabled={linkingCourse}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 h-11 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-60"
                  >
                    {linkingCourse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    解除
                  </button>
                )}
              </div>
              {!coursesLoading && availableCourses.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  紐づけ可能な出席フォームがありません。<Link href="/admin" className="text-emerald-600 hover:underline">管理画面</Link>から作成してください。
                </p>
              )}
              {linkCourseError && (
                <p className="text-xs text-rose-600 mt-2">{linkCourseError}</p>
              )}
              {room.linked_course && (
                <div className="mt-3 rounded-xl bg-emerald-50/60 ring-1 ring-emerald-100 px-4 py-3 text-xs sm:text-sm text-emerald-800">
                  <span className="font-semibold">{room.linked_course.name}</span>
                  {room.linked_course.teacher_name && (
                    <span className="text-emerald-700/70"> ／ {room.linked_course.teacher_name}</span>
                  )}
                  <span className="block mt-1 text-[11px] text-emerald-700/80 font-mono">
                    出席URL: /attendance/{room.linked_course.code}
                  </span>
                </div>
              )}
            </div>

            {/* 使い方ヒント */}
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-5">
              <p className="text-xs sm:text-sm font-bold text-slate-700 mb-2">使い方</p>
              <ul className="text-xs sm:text-sm text-slate-500 space-y-1.5 leading-relaxed list-disc list-inside">
                <li>紐付けると、参加者画面のタブに「出席」が表示されます。</li>
                <li>位置情報チェック・クールダウンなど既存の出席フォーム設定がそのまま適用されます。</li>
                <li>講師は参加者に「出席タブを開いてください」とアナウンスするだけで出席を取れます。</li>
              </ul>
            </div>
          </div>
        )}

        {/* === Export Tab === */}
        {tab === 'export' && (
          <div className="space-y-5">
            {exportData?.stats && (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 mb-4">
                  ルームサマリー
                </h3>
                <div className={`grid grid-cols-2 gap-4 ${exportData.stats.attendanceLinked ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                  {[
                    { label: '質問数', value: exportData.stats.totalQuestions },
                    { label: '投票数', value: exportData.stats.totalPolls },
                    { label: '総いいね', value: exportData.stats.totalUpvotes },
                    { label: '参加者数', value: exportData.stats.uniqueParticipants },
                    ...(exportData.stats.attendanceLinked
                      ? [{ label: '出席数', value: exportData.stats.totalAttendance ?? 0 }]
                      : []),
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-emerald-600">
                        {s.value ?? 0}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exportData?.topQuestions && exportData.topQuestions.length > 0 && (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
                  質問一覧（いいね順）
                </h3>
                <div className="space-y-2">
                  {(showAllQuestions
                    ? exportData.topQuestions
                    : exportData.topQuestions.slice(0, 5)
                  ).map((q, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm sm:text-base">
                      <span className="text-emerald-600 font-bold w-6 tabular-nums">
                        {q.upvote_count}
                      </span>
                      <span className="text-slate-700">{q.text}</span>
                    </div>
                  ))}
                </div>
                {exportData.topQuestions.length > 5 && (
                  <button
                    onClick={() => setShowAllQuestions(!showAllQuestions)}
                    className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    {showAllQuestions
                      ? '閉じる'
                      : `他の質問をみる（残り${exportData.topQuestions.length - 5}件）`}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
                データダウンロード
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={exportLoadingType !== null}
                  onClick={() => handleExportCSV('questions')}
                  className="bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  {exportLoadingType === 'questions' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Q&Aデータ (CSV)
                </button>
                <button
                  type="button"
                  disabled={exportLoadingType !== null}
                  onClick={() => handleExportCSV('polls')}
                  className="bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 font-semibold px-4 h-11 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors disabled:opacity-60 disabled:pointer-events-none"
                >
                  {exportLoadingType === 'polls' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  ライブ投票結果(CSV)
                </button>
              </div>
            </div>

            {/* Moderation toggle (placed under Export for housekeeping) */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6 flex items-center justify-between">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">承認制（モデレーション）</h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {room.moderation_enabled
                    ? 'ON: 新規質問は承認後に公開されます'
                    : 'OFF: 新規質問は即時公開されます'}
                </p>
              </div>
              <button
                type="button"
                disabled={moderationLoading}
                onClick={handleToggleModeration}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 h-9 rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                  room.moderation_enabled
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {moderationLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : room.moderation_enabled ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldOff className="w-3.5 h-3.5" />
                )}
                {room.moderation_enabled ? '承認制 ON' : '承認制 OFF'}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* CSV出力対象カード選択モーダル: タブをまたいで動作させたいので最上位で描画 */}
      <AnimatePresence>
        {showPollExportPicker && (
          <PollExportPickerModal
            polls={polls}
            exporting={exportLoadingType === 'polls'}
            onClose={() => setShowPollExportPicker(false)}
            onConfirm={async (pollId) => {
              setShowPollExportPicker(false);
              await downloadExportCSV('polls', pollId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====== Subcomponents ====== */

function HostSideNav({
  room,
  roomCode,
  activeTab,
  onSelectTab,
  presenceCount,
  qrUrl,
  copied,
  onCopyCode,
  roomStatus,
  roomStatusLoading,
  onToggleRoomStatus,
  collapsed,
  onToggleCollapsed,
}: {
  room: Room;
  roomCode: string;
  activeTab: HostTab;
  onSelectTab: (tab: HostTab) => void;
  presenceCount: number;
  qrUrl: string;
  copied: boolean;
  onCopyCode: () => void;
  roomStatus: string;
  roomStatusLoading: boolean;
  onToggleRoomStatus: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={`hidden h-screen shrink-0 border-r border-[#dce8ff] bg-[#f3f7ff] transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:flex-col ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      <div className={`border-b border-[#dce8ff] ${collapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
          <Link
            href="/admin"
            className={`flex min-w-0 items-center transition-opacity hover:opacity-80 ${
              collapsed ? 'justify-center' : 'gap-2.5'
            }`}
            title="管理画面へ"
          >
            <Image src={LOGO_URL} alt="ざせきくん" width={collapsed ? 28 : 32} height={collapsed ? 28 : 32} className="rounded-lg" />
            {!collapsed && <span className="truncate text-sm font-bold text-[#323232]">ざせきくん</span>}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#2864f0] transition-colors hover:bg-[#dce8ff]"
              aria-label="サイドバーを閉じる"
              title="サイドバーを閉じる"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md text-[#2864f0] transition-colors hover:bg-[#dce8ff]"
            aria-label="サイドバーを開く"
            title="サイドバーを開く"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && (
      <div className="border-b border-[#dce8ff] px-4 py-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#dce8ff]">
            <Image src={LOGO_URL} alt="" width={24} height={24} className="rounded-md" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold leading-snug text-[#323232]">{room.title}</h2>
            <button
              type="button"
              onClick={onCopyCode}
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold tracking-wider text-[#595959] hover:text-[#2864f0]"
              title="コードをコピー"
            >
              #{room.code}
              {copied ? <Check className="h-3 w-3 text-[#00963c]" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[#dce8ff] bg-white p-2">
            <p className="font-bold text-[#8c8989]">参加者</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold tabular-nums text-[#323232]">
              <Users className="h-3.5 w-3.5 text-[#2864f0]" />
              {presenceCount}人
            </p>
          </div>
          <a
            href={qrUrl || '#'}
            download={`qr-${roomCode}.png`}
            className={`rounded-lg border border-[#dce8ff] bg-white p-2 transition-colors hover:border-[#aac8ff] ${
              qrUrl ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            <p className="font-bold text-[#8c8989]">参加QR</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#323232]">
              <QrCode className="h-3.5 w-3.5 text-[#2864f0]" />
              保存
            </p>
          </a>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <a
            href={`/rooms/${roomCode}/present`}
            target={`zasekikun-present-${roomCode}`}
            rel="noopener noreferrer"
            className="rounded-lg border border-[#dce8ff] bg-white p-2 transition-colors hover:border-[#aac8ff] hover:bg-[#ebf3ff]"
            title="スクリーン画面を開く"
          >
            <p className="font-bold text-[#8c8989]">スクリーン</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#323232]">
              <Monitor className="h-3.5 w-3.5 text-[#2864f0]" />
              開く
            </p>
          </a>
          <button
            type="button"
            disabled={roomStatusLoading}
            onClick={onToggleRoomStatus}
            className={`rounded-lg p-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-60 ${
              roomStatus === 'active'
                ? 'border border-[#dc1e32] bg-white hover:bg-red-50'
                : 'border border-[#dce8ff] bg-white hover:border-[#aac8ff] hover:bg-[#ebf3ff]'
            }`}
          >
            {roomStatusLoading ? (
              <span className="flex h-full items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2864f0]" />
              </span>
            ) : roomStatus === 'active' ? (
              <>
                <p className="font-bold text-[#8c8989]">セッション</p>
                <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#dc1e32]">
                  <StopCircle className="h-3.5 w-3.5" />
                  終了
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-[#8c8989]">セッション</p>
                <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#2864f0]">
                  <RotateCcw className="h-3.5 w-3.5" />
                  再開
                </p>
              </>
            )}
          </button>
        </div>
      </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {HOST_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeTab;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={`flex w-full items-center rounded-lg text-left transition-colors ${
                collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5'
              } ${
                active ? 'bg-[#dce8ff] text-[#23418c]' : 'text-[#323232] hover:bg-[#dce8ff]/60'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-white text-[#2864f0]' : 'bg-transparent text-[#2864f0]'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {!collapsed && <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-none">{item.label}</span>
                <span className={`mt-1 block truncate text-[11px] leading-none ${active ? 'text-[#595959]' : 'text-[#8c8989]'}`}>
                  {item.description}
                </span>
              </span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#dce8ff] p-4">
        <Link
          href="/admin"
          className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dce8ff] bg-white text-sm font-bold text-[#595959] transition-colors hover:border-[#aac8ff] hover:text-[#2864f0] ${
            collapsed ? 'px-0' : ''
          }`}
          title="管理画面へ"
          aria-label="管理画面へ"
        >
          <ArrowLeft className="h-4 w-4" />
          {!collapsed && '管理画面へ'}
        </Link>
      </div>
    </aside>
  );
}

function PollTypeModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (mode: PollMode) => void;
}) {
  const items: Array<{
    mode: PollMode;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'standard',
      title: '通常投票',
      desc: '従来のチェック回答・複数選択の投票です。',
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      mode: 'quiz',
      title: 'クイズ形式',
      desc: '1つの投票内に1-1、1-2、1-3のような複数問題を作成します。',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      mode: 'ranking',
      title: 'ランキング形式',
      desc: '多数の候補を順位と重みで集計します。',
      icon: <ListOrdered className="w-5 h-5" />,
    },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">投票の種類を選択</h3>
            <p className="mt-1 text-sm text-slate-500">用途に合わせて作成フォームを切り替えます。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => onSelect(item.mode)}
              className="min-h-[150px] rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition-colors hover:bg-emerald-50 hover:ring-emerald-200"
            >
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                {item.icon}
              </span>
              <span className="block text-sm font-bold text-slate-900">{item.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.desc}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function PollExportPickerModal({
  polls,
  exporting,
  onClose,
  onConfirm,
}: {
  polls: Poll[];
  exporting: boolean;
  onClose: () => void;
  onConfirm: (pollId: string | null) => void;
}) {
  // 'all' = 全カードまとめて出力 / poll.id = 単一カード
  const [selected, setSelected] = useState<string>('all');

  const handleConfirm = () => {
    onConfirm(selected === 'all' ? null : selected);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200"
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">ライブ投票結果(CSV)を出力</h3>
            <p className="mt-1 text-sm text-slate-500">どのカードの結果を出力するか選んでください。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-1 py-2 pr-2">
          <label
            className={`flex items-center gap-3 rounded-xl p-3 ring-1 cursor-pointer transition-colors ${
              selected === 'all'
                ? 'bg-emerald-50 ring-emerald-300'
                : 'bg-white ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="export-target"
              value="all"
              checked={selected === 'all'}
              onChange={() => setSelected('all')}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <Download className="w-4 h-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-900">全てのカード</span>
              <span className="block text-[11px] text-slate-500">全{polls.length}件の結果を1ファイルに出力</span>
            </span>
          </label>

          {polls.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              出力対象のカードがありません
            </p>
          ) : (
            polls.map((poll) => {
              const { meta } = extractPollPayload(poll.options);
              const mode = getPollMode(meta.mode);
              const visual = POLL_MODE_VISUAL[mode];
              const ModeIcon = visual.icon;
              const isSelected = selected === poll.id;
              return (
                <label
                  key={poll.id}
                  className={`flex items-center gap-3 rounded-xl p-3 ring-1 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 ring-emerald-300'
                      : 'bg-white ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-target"
                    value={poll.id}
                    checked={isSelected}
                    onChange={() => setSelected(poll.id)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${visual.iconBg} ${visual.iconText} ${visual.iconRing}`}
                  >
                    <ModeIcon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span
                        className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded-full ring-1 ${visual.badgeBg} ${visual.badgeText} ${visual.badgeRing}`}
                      >
                        {POLL_MODE_LABELS[mode]}
                      </span>
                      <span className="font-semibold text-slate-400">
                        {poll.status === 'active'
                          ? 'Live'
                          : poll.status === 'draft'
                          ? '下書き'
                          : '終了'}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">
                      {poll.question || '（無題）'}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exporting || polls.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm shadow-emerald-200/60 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            CSVを出力
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SortPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center text-xs sm:text-sm font-semibold px-3 h-8 rounded-full transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center text-xs sm:text-sm font-semibold px-3 h-8 rounded-full transition-colors tabular-nums ${
        active
          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/60'
          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function HostQuestionRow({
  q,
  pendingAction,
  onToggleAnswered,
  onTogglePinned,
  onApprove,
  onReject,
  onUnreject,
  onDelete,
}: {
  q: {
    id: string;
    text: string;
    author_name: string;
    upvote_count: number;
    is_answered: boolean;
    is_pinned: boolean;
    created_at: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
  pendingAction: string | null;
  onToggleAnswered: () => void;
  onTogglePinned: () => void;
  onApprove: () => void;
  onReject: () => void;
  onUnreject: () => void;
  onDelete: () => void;
}) {
  const anyPending = pendingAction !== null;
  const isPendingAction = (action: string) => pendingAction === action;
  const authorLabel = q.author_name === 'Anonymous' ? '匿名' : q.author_name;
  const initial = authorLabel.slice(0, 1) || '匿';
  const tone = avatarTone(authorLabel);
  const timeAgo = formatDistanceToNow(new Date(q.created_at), { addSuffix: true, locale: ja });
  const dateLabel = new Date(q.created_at).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const isRejected = q.status === 'rejected';
  const isPending = q.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`rounded-2xl bg-white ring-1 ${
        q.is_pinned ? 'ring-emerald-300 shadow-sm shadow-emerald-100' : 'ring-slate-200'
      } ${isRejected ? 'opacity-70' : ''} px-4 py-3 sm:px-5 sm:py-4`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Like count column */}
        <div className="flex flex-col items-center justify-start pt-1 min-w-[36px]">
          <Heart className="w-4 h-4 text-rose-300" />
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-700 tabular-nums">
            {q.upvote_count}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${tone}`}
                aria-hidden
              >
                {initial}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
                {authorLabel}
              </span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-[11px] sm:text-xs text-slate-400 tabular-nums">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {q.is_answered && (
                <span className="text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                  回答済
                </span>
              )}
              {isPending && (
                <span className="text-[10px] sm:text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 rounded-full">
                  承認待ち
                </span>
              )}
              {isRejected && (
                <span className="text-[10px] sm:text-xs font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-2 py-0.5 rounded-full">
                  非表示
                </span>
              )}
              <span className="text-[11px] text-slate-400 hidden sm:inline">{timeAgo}</span>
            </div>
          </div>

          <p
            className={`text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap break-words ${
              q.is_answered ? 'line-through opacity-70' : ''
            }`}
          >
            {q.text}
          </p>

          {/* Action row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {isPending ? (
              <>
                <ActionButton
                  onClick={onApprove}
                  tone="primary"
                  loading={isPendingAction('status:approved')}
                  disabled={anyPending}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  承認
                </ActionButton>
                <ActionButton
                  onClick={onReject}
                  tone="muted"
                  loading={isPendingAction('status:rejected')}
                  disabled={anyPending}
                  icon={<EyeOff className="w-3.5 h-3.5" />}
                >
                  非表示
                </ActionButton>
              </>
            ) : isRejected ? (
              <ActionButton
                onClick={onUnreject}
                tone="muted"
                loading={isPendingAction('status:approved')}
                disabled={anyPending}
                icon={<Eye className="w-3.5 h-3.5" />}
              >
                公開に戻す
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  onClick={onToggleAnswered}
                  tone="muted"
                  loading={isPendingAction('answered')}
                  disabled={anyPending}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  {q.is_answered ? '未回答に戻す' : '回答済みにする'}
                </ActionButton>
                <ActionButton
                  onClick={onTogglePinned}
                  tone="muted"
                  loading={isPendingAction('pinned')}
                  disabled={anyPending}
                  icon={<Reply className="w-3.5 h-3.5" />}
                >
                  {q.is_pinned ? 'ピン解除' : 'ピン留め'}
                </ActionButton>
                <ActionButton
                  onClick={onReject}
                  tone="muted"
                  loading={isPendingAction('status:rejected')}
                  disabled={anyPending}
                  icon={<EyeOff className="w-3.5 h-3.5" />}
                >
                  非表示
                </ActionButton>
              </>
            )}
            <ActionButton
              onClick={onDelete}
              tone="danger"
              loading={isPendingAction('delete')}
              disabled={anyPending}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              削除
            </ActionButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({
  onClick,
  icon,
  children,
  tone,
  loading,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone: 'primary' | 'muted' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const cls =
    tone === 'primary'
      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
      : tone === 'danger'
      ? 'bg-white text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2.5 h-8 rounded-lg transition-colors disabled:opacity-60 disabled:pointer-events-none ${cls}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function PollResultCard({
  poll,
  votes,
  pendingId,
  deletingId,
  editing,
  onStart,
  onClose,
  onDelete,
  onEdit,
  onReset,
  resetting,
}: {
  poll: Poll;
  votes: Array<{ option_index: number | null; value?: string | null; participant_id?: string }>;
  pendingId: string | null;
  deletingId: string | null;
  editing: boolean;
  onStart: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const { meta, options } = extractPollPayload(poll.options);
  const mode = getPollMode(meta.mode);
  const counts = options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  const totalRespondents =
    mode === 'ranking' || mode === 'quiz'
      ? new Set(votes.map((v) => (v as { participant_id?: string }).participant_id).filter(Boolean)).size || totalVotes
      : totalVotes;
  const maxSelections = Math.max(1, Number(poll.max_selections ?? 1));
  const isMulti = maxSelections > 1 || poll.allow_multiple;
  const quizQuestions = mode === 'quiz' ? getQuizQuestions(meta, options) : [];
  const isPending = pendingId === poll.id;
  const isDeleting = deletingId === poll.id;
  const visual = POLL_MODE_VISUAL[mode];
  const ModeIcon = visual.icon;
  const statusLabel =
    poll.status === 'active' ? 'Live' : poll.status === 'draft' ? '下書き' : '終了';

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white transition-all ${
        editing
          ? 'border-[#2864f0] shadow-sm shadow-blue-100'
          : `border-[#e9e7e7] hover:border-[#aac8ff] hover:shadow-sm`
      }`}
    >
      <div className="border-b border-[#e9e7e7] p-4">
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${visual.iconBg} ${visual.iconText} ${visual.iconRing}`}
            aria-hidden
          >
            <ModeIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`inline-flex items-center font-bold px-2 py-0.5 rounded-full ring-1 ${visual.badgeBg} ${visual.badgeText} ${visual.badgeRing}`}
              >
                {POLL_MODE_LABELS[mode]}
              </span>
              {poll.status === 'active' ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {statusLabel}
                </span>
              ) : poll.status === 'draft' ? (
                <span className="inline-flex items-center font-bold text-amber-700">{statusLabel}</span>
              ) : (
                <span className="inline-flex items-center font-bold text-slate-400">{statusLabel}</span>
              )}
              {editing && (
                <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 font-bold text-white">
                  編集中
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-900 leading-snug break-words line-clamp-2">
              {poll.question || '（無題）'}
            </h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
              <span className="tabular-nums">
                回答 <span className="font-bold text-slate-700">{totalRespondents}</span> 件
              </span>
              {isMulti && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>
                    {mode === 'ranking' ? `${maxSelections}位まで` : `最大${maxSelections}件`}
                  </span>
                </>
              )}
              {mode === 'quiz' && quizQuestions.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>全{quizQuestions.length}問</span>
                </>
              )}
              {meta.timeLimitSeconds ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {meta.timeLimitSeconds}秒
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* アクション行 */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#f7f5f5] px-4 py-3">
        {poll.status !== 'active' ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onStart}
            className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 h-9 rounded-lg disabled:opacity-60 transition-colors"
            title="開始"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                開始
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-bold bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 px-3 h-9 rounded-lg disabled:opacity-60 transition-colors"
            title="締切"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <StopCircle className="w-3.5 h-3.5" />
                締切
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
            editing
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'text-slate-500 ring-1 ring-slate-200 bg-white hover:text-emerald-700 hover:bg-emerald-50 hover:ring-emerald-200'
          }`}
          title="編集"
          aria-label="編集"
        >
          <Pencil className="w-4 h-4" />
          編集
        </button>
        <button
          type="button"
          disabled={resetting}
          onClick={onReset}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-500 ring-1 ring-slate-200 bg-white hover:text-amber-700 hover:bg-amber-50 hover:ring-amber-200 transition-colors disabled:opacity-60"
          title="回答とタイマーをリセット"
          aria-label="リセット"
        >
          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          リセット
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={onDelete}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-rose-400 ring-1 ring-rose-100 bg-white hover:text-rose-600 hover:bg-rose-50 hover:ring-rose-200 transition-colors disabled:opacity-60 disabled:pointer-events-none ml-auto"
          title="削除"
          aria-label="削除"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SummaryTab({
  counts,
  totalQuestions,
  totalUpvotes,
  totalPolls,
  totalParticipants,
  attendanceLinked,
  totalAttendance,
  topQuestions,
}: {
  counts: { all: number; pending: number; approved: number; answered: number; rejected: number };
  totalQuestions: number;
  totalUpvotes: number;
  totalPolls: number;
  totalParticipants: number;
  attendanceLinked?: boolean;
  totalAttendance?: number | null;
  topQuestions: Array<{
    id: string;
    text: string;
    author_name: string;
    upvote_count: number;
    is_answered: boolean;
    created_at: string;
  }>;
}) {
  const total = Math.max(counts.all, 1);
  const segments = [
    { key: 'approved', label: '公開中', value: counts.approved, color: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { key: 'answered', label: '回答済', value: counts.answered, color: 'bg-sky-500', dot: 'bg-sky-500' },
    { key: 'pending', label: '承認待ち', value: counts.pending, color: 'bg-amber-400', dot: 'bg-amber-400' },
    { key: 'rejected', label: '非表示', value: counts.rejected, color: 'bg-slate-300', dot: 'bg-slate-400' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${attendanceLinked ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <KpiCard
          label="質問"
          value={totalQuestions}
          icon={<MessageSquare className="w-4 h-4 text-emerald-700" />}
          accent="bg-emerald-50 ring-emerald-100"
        />
        <KpiCard
          label="いいね合計"
          value={totalUpvotes}
          icon={<Heart className="w-4 h-4 text-rose-500" />}
          accent="bg-rose-50 ring-rose-100"
        />
        <KpiCard
          label="参加者"
          value={totalParticipants}
          icon={<Users className="w-4 h-4 text-sky-600" />}
          accent="bg-sky-50 ring-sky-100"
        />
        {attendanceLinked && (
          <KpiCard
            label="出席"
            value={totalAttendance ?? 0}
            icon={<ClipboardCheck className="w-4 h-4 text-emerald-600" />}
            accent="bg-emerald-50 ring-emerald-100"
          />
        )}
        <KpiCard
          label="ライブ投票"
          value={totalPolls}
          icon={<BarChart3 className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-50 ring-amber-100"
        />
      </div>

      {/* Status distribution */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">質問のステータス分布</h3>
        <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.key}
                className={s.color}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ) : null
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
          {segments.map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden />
                <span className="font-semibold text-slate-700">{s.label}</span>
                <span className="ml-auto sm:ml-2 text-slate-500 tabular-nums">
                  {s.value} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 5 questions */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900">人気の質問 TOP 5</h3>
        </div>
        {topQuestions.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">まだ質問がありません</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topQuestions.map((q, i) => {
              const author = q.author_name === 'Anonymous' ? '匿名' : q.author_name;
              const dateLabel = new Date(q.created_at).toLocaleString('ja-JP', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={q.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center tabular-nums shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-xs text-slate-500 mb-0.5">
                      {author} · {dateLabel}
                    </p>
                    <p className="text-sm sm:text-base text-slate-800 leading-relaxed line-clamp-3">
                      {q.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q.is_answered && (
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 rounded-full">
                        回答済
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-rose-500">
                      <Heart className="w-4 h-4 fill-current" />
                      <span className="text-xs font-bold tabular-nums">{q.upvote_count}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-7 h-7 rounded-lg ring-1 flex items-center justify-center ${accent}`}>
          {icon}
        </span>
        <span className="text-xs sm:text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
