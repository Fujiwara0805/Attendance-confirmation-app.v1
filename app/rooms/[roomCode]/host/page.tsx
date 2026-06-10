'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SessionReportContent from '../report/SessionReportContent';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Hand,
  BarChart3,
  PieChart,
  Plus,
  QrCode,
  Copy,
  Check,
  Download,
  Menu,
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
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  BadgeCheck,
  Play,
  Link2,
  ClipboardCheck,
  Search,
  GripVertical,
  HelpCircle,
  Hammer,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtimeQuestions } from '@/lib/hooks/useRealtimeQuestions';
import { useRealtimePolls, type Poll, type PollVote } from '@/lib/hooks/useRealtimePolls';
import { useRoomPresence } from '@/lib/hooks/useRoomPresence';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  POLL_MODE_LABELS,
  QUIZ_OPTION_COUNTS,
  clampNumber,
  extractPollPayload,
  getPollMode,
  getPollOptionImageUrl,
  getPollOptionLabel,
  getQuizCorrectOptionOffsets,
  getQuizQuestions,
  getRankingDisplayMode,
  getRankingWeights,
  normalizeFreeTextGroups,
  optionLetter,
  rankLabel,
  type PollMode,
  type PollOption,
} from '@/lib/pollModes';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { CustomModal } from '@/components/ui/custom-modal';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';
const HOST_SIDEBAR_COLLAPSED_KEY = 'host-sidebar-collapsed';
const POLL_TIME_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800, 3600];

function formatSecondsOption(seconds: number) {
  if (seconds <= 0) return 'なし';
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return restSeconds > 0 ? `${minutes}分${restSeconds}秒` : `${minutes}分`;
}

function getPollTimeOptions(current: number | '' | null | undefined, minSeconds = 0, allowZero = false) {
  const options = POLL_TIME_SECONDS_OPTIONS.filter((seconds) => seconds >= minSeconds);
  if (allowZero) options.unshift(0);
  const currentNumber = typeof current === 'number' ? current : Number(current);
  if (
    Number.isFinite(currentNumber) &&
    currentNumber >= minSeconds &&
    currentNumber <= 3600 &&
    !options.includes(currentNumber)
  ) {
    options.push(currentNumber);
  }
  return Array.from(new Set(options)).sort((a, b) => a - b);
}

function getPollHostOrder(poll: Poll) {
  const order = extractPollPayload(poll.options).meta.hostOrder;
  return typeof order === 'number' && Number.isFinite(order) && order > 0 ? order : null;
}

function buildPollOrderFromPersistedMeta(polls: Poll[]) {
  return [...polls]
    .sort((a, b) => {
      const aOrder = getPollHostOrder(a);
      const bOrder = getPollHostOrder(b);
      if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .map((poll) => poll.id);
}

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

type HostTab = 'questions' | 'polls' | 'summary' | 'integration' | 'report' | 'faq';
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
  /** 0-based offsets of correct answers. empty = 採点しない（任意） */
  correctOptionOffsets: number[];
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
  free_text: {
    icon: Hand,
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
    badgeRing: 'ring-orange-200',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-700',
    iconRing: 'ring-orange-200',
    cardRing: 'hover:ring-orange-200',
  },
};

const HOST_NAV_ITEMS: Array<{
  key: HostTab;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'questions', label: 'Q&A機能', description: '承認・回答管理', icon: MessageSquare },
  { key: 'polls', label: 'ワーク機能', description: 'カード作成・集計', icon: Hammer },
  { key: 'summary', label: 'サマリー', description: '状況の確認', icon: PieChart },
  { key: 'integration', label: '連携', description: '出席フォーム紐付け', icon: Link2 },
  { key: 'report', label: 'レポート機能', description: '記録・データ出力', icon: FileText },
  { key: 'faq', label: 'FAQ', description: '操作ガイド', icon: HelpCircle },
];

function isHostTab(value: string | null): value is HostTab {
  return HOST_NAV_ITEMS.some((item) => item.key === value);
}

type HostColorTheme = {
  headerBg: string;
  headerBorder: string;
  iconBg: string;
  iconBorder: string;
  accent: string;
  titleText: string;
  descriptionText: string;
  strongText: string;
  infoBg: string;
  infoBorder: string;
  infoText: string;
};

const HOST_COLOR_THEMES: Record<HostTab, HostColorTheme> = {
  questions: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
  polls: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
  summary: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
  integration: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
  report: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
  faq: {
    headerBg: '#eaf8ef',
    headerBorder: '#9dd8b1',
    iconBg: '#ffffff',
    iconBorder: '#00963c',
    accent: '#00963c',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#323232',
    infoBg: '#eaf8ef',
    infoBorder: '#00963c',
    infoText: '#323232',
  },
};

const HOST_FAQ_SECTIONS: Array<{
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  summary: string;
  body: string;
  tips: string[];
}> = [
  {
    id: 'questions',
    title: 'Q&A',
    icon: MessageSquare,
    summary: '参加者から届いた質問を承認、非表示、回答済みに整理できます。',
    body:
      '承認制をONにすると、新規質問はホストが確認してから公開されます。いいね数や投稿日時で並び替えることで、進行中に扱う質問を見つけやすくなります。画面上のリセットは表示整理のための操作で、CSV出力に使う質問データは保持されます。',
    tips: ['承認待ちがある場合は通知エリアから確認できます。', '質問はスクリーン画面にも表示できます。'],
  },
  {
    id: 'polls',
    title: 'ワークツール',
    icon: Hammer,
    summary: '通常投票・クイズ・ランキング・ブレスト形式のカードを作成し、回答を集計できます。',
    body:
      '通常投票は選択肢から回答してもらう基本形式で、複数選択にも対応します。クイズ形式では正解を設定でき、1枚のカードに複数問をまとめて入れられます（スクリーンの「次の問題」で順番に出題でき、順番も崩れません）。ランキング形式は候補を順位で回答してもらい、重み付けして集計します。ブレスト形式は参加者の短い自由回答を付箋カードとして集める形式です。各カードの「表示する」でスクリーンに出し、スクリーン側の「回答開始」で受付を始めます。',
    tips: ['新規作成はヘッダー右側のボタンから行います。', 'カードのドラッグ並び替えは管理画面の整理用です（スクリーンの表示順とは別。表示順の決め方は「スクリーン表示と出題の流れ」を参照）。', 'クイズの設問は「問題番号」で並びます。番号を変えると、その問題が指定位置に移動し、ほかの問題は自動でずれます（番号は常に1から連番）。例：問題1〜10がある状態で新しい問題を「3」にすると、旧3〜10が4〜11に繰り下がって挿入されます。並びはスクリーン画面・資料投影画面・参加者の投票画面すべてに反映されます。'],
  },
  {
    id: 'screen',
    title: 'スクリーン表示と出題の流れ',
    icon: Monitor,
    summary: '「スクリーンに表示」「回答開始」「終了／再開」の違いと、問題を順番に出すコツ。',
    body:
      'ボタンの意味は2段階です。ワーク機能タブの「スクリーンに表示」はカードをスクリーンに出す操作、スクリーン画面（資料投影画面の右サブ画面）の「回答開始」は回答受付タイマーを始める操作です。ヘッダー右上の「終了／再開」はセッション全体の開閉で、個々の問題とは別レイヤーです。問題を順番どおり出したい場合、いちばん確実なのは1枚のクイズカードに複数問を入れて「次の問題」で進める方法です。別カードを並べる場合は「一斉開始」で1→2→3の順を指定するとスクリーンにその順で並びます（指定なしで1枚ずつ開始したときは作成順で並びます）。',
    tips: ['複数カードを順番に出すときは、スクリーン画面・資料投影画面のワークスペースとも先頭の1枚だけが表示されます。各カードの「次に進む」で締切＆次のカードへ進められます（管理画面に戻らずに操作できます）。', '結果をしっかり見せたいときは、タイマー終了で結果が出てから「次に進む」を押してください。', '資料投影画面では、資料とチャットの境界（縦線）をドラッグで横幅を、ワークスペースと質問チャットの境界（横線）をドラッグで高さを、それぞれ調整できます。'],
  },
  {
    id: 'brainstorm',
    title: 'ブレスト形式',
    icon: Hand,
    summary: '参加者の短い自由回答を付箋カードとして集め、スクリーン上で分類できます。',
    body:
      'ブレスト形式では、参加者はスマートフォンから短い回答を何度でも投稿でき、自分の投稿はその場で編集・削除できます。集まった回答はオレンジの付箋カードとしてスクリーン（ワークスペース画面）にリアルタイム表示されます。先生は「分類を追加」でグループを作り、カードをドラッグして仕分けられます。アイデア出しや感想集め、ブレインストーミングに向いた形式です。',
    tips: ['カードの色は参加者が選べます（既定はオレンジ）。', 'スクリーン画面・編集モードのどちらでも分類できます。'],
  },
  {
    id: 'summary',
    title: 'サマリー',
    icon: PieChart,
    summary: 'ルーム全体の質問数、いいね数、参加者数、投票数を確認できます。',
    body:
      '出席フォームを連携している場合は出席数も表示されます。質問のステータス分布や人気の質問TOP5を確認できるため、イベント中の進行判断や終了後の振り返りに使えます。',
    tips: ['数字はルームの現在データをもとに表示されます。', '詳細な出力はエクスポート画面を使います。'],
  },
  {
    id: 'integration',
    title: '連携',
    icon: Link2,
    summary: 'ルームと出席フォームを紐づけ、参加者画面に出席タブを追加できます。',
    body:
      '出席フォームを紐づけると、Q&Aや投票と同じ画面から出席登録できます。位置情報チェックや送信クールダウンなど、既存の出席フォーム設定はそのまま適用されます。',
    tips: ['紐づけ可能なフォームがない場合は、先にフォーム管理で作成してください。', '紐づけはいつでも解除できます。'],
  },
  {
    id: 'report',
    title: 'レポート機能',
    icon: FileText,
    summary: 'セッションの記録を1画面にまとめ、印刷・PDF・CSVで残せます。',
    body:
      'レポート機能では、出席・質問・投票/クイズ/ランキング/ブレストの結果を1枚にまとめて確認できます。ワークカードごと・実施日ごとに絞り込んで表示でき、画面右上から印刷・PDF保存、CSVダウンロードが行えます。質問一覧やワーク結果のCSVもこの画面から出力できます。',
    tips: ['イベント後の振り返りや報告資料の作成に使えます。', 'ワークカード単位のCSV出力は、ワーク機能タブの各カードからも行えます。'],
  },
];

function HostPageHeader({
  title,
  description,
  icon: Icon,
  theme = HOST_COLOR_THEMES.questions,
  leading,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  theme?: HostColorTheme;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="border-b px-4 py-3 sm:px-5"
      style={{ backgroundColor: theme.headerBg, borderColor: theme.headerBorder }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
            style={{ backgroundColor: theme.iconBg, borderColor: theme.iconBorder, color: theme.accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1
              className="truncate text-lg font-bold leading-tight sm:text-xl"
              style={{ color: theme.titleText }}
            >
              {title}
            </h1>
            <p
              className="mt-0.5 truncate text-xs sm:text-sm"
              style={{ color: theme.descriptionText }}
            >
              {description}
            </p>
          </div>
        </div>
        {children && (
          <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
            {children}
          </div>
        )}
      </div>
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
    correctOptionOffsets: [],
  };
}

export default function HostPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();
  const roomCode = (params.roomCode as string).toUpperCase();
  const requestedTab = searchParams.get('tab');

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HostTab>(isHostTab(requestedTab) ? requestedTab : 'questions');
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isHostTab(requestedTab)) {
      setTab(requestedTab);
    }
  }, [requestedTab]);

  // Question filters
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Poll creation
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showPollTypeModal, setShowPollTypeModal] = useState(false);
  const [pollOrder, setPollOrder] = useState<string[]>([]);
  const pollOrderInitializedRef = useRef(false);
  const [draggingPollId, setDraggingPollId] = useState<string | null>(null);
  const [dragOverPollId, setDragOverPollId] = useState<string | null>(null);
  const [dragOverPollPage, setDragOverPollPage] = useState<number | null>(null);
  const [focusedPollId, setFocusedPollId] = useState<string | null>(null);
  const pollEditorRef = useRef<HTMLDivElement>(null);
  const [pollMode, setPollMode] = useState<PollMode>('standard');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMaxSelections, setPollMaxSelections] = useState(1);
  const [standardTimeLimit, setStandardTimeLimit] = useState<number | ''>('');
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
  const [freeTextTimeLimit, setFreeTextTimeLimit] = useState<number | ''>('');
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
  const [userPlan, setUserPlan] = useState<'free' | 'paid' | 'enterprise'>('free');
  const [pollPage, setPollPage] = useState(1);
  const [pollSearch, setPollSearch] = useState('');
  const POLLS_PER_PAGE = 9;
  const [roomStatusLoading, setRoomStatusLoading] = useState(false);
  const [pollStatusPendingId, setPollStatusPendingId] = useState<string | null>(null);
  const [pollDeletingId, setPollDeletingId] = useState<string | null>(null);
  const [pollDeleteConfirm, setPollDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedPollIds, setSelectedPollIds] = useState<string[]>([]);
  const [bulkStartPending, setBulkStartPending] = useState(false);
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
    setStandardTimeLimit('');
    setQuizTimeLimit(60);
    setQuizQuestions([makeQuizQuestionDraft(0)]);
    setActiveQuizQuestionIndex(0);
    setRankingCandidateCount(50);
    setRankingRankCount(3);
    setRankingWeights([3, 2, 1]);
    setRankingTimeLimit(60);
    setRankingDisplayMode('number_text');
    setRankingCandidateTexts(Array.from({ length: 50 }, () => ''));
    setFreeTextTimeLimit('');
    setEditingPollId(null);
  }, []);

  const handleSelectPollMode = useCallback((nextMode: PollMode) => {
    resetPollForm(nextMode);
    setShowPollTypeModal(false);
    setShowCreatePoll(true);
  }, [resetPollForm]);

  const handleRankingRankCountChange = useCallback((value: unknown) => {
    const nextCount = clampNumber(value, 1, Math.min(10, rankingCandidateCount), 3);
    setRankingRankCount(nextCount);
    setRankingWeights((prev) =>
      Array.from({ length: nextCount }, (_, i) =>
        Number.isFinite(prev[i]) ? prev[i] : Math.max(1, nextCount - i)
      )
    );
  }, [rankingCandidateCount]);

  const handleRankingCandidateCountChange = useCallback((value: unknown) => {
    const nextCount = clampNumber(value, 3, 100, 50);
    const nextRankCount = Math.min(rankingRankCount, nextCount, 10);
    setRankingCandidateCount(nextCount);
    setRankingCandidateTexts((prev) =>
      Array.from({ length: nextCount }, (_, i) => prev[i] || '')
    );
    setRankingRankCount(nextRankCount);
    setRankingWeights((prevWeights) =>
      Array.from({ length: nextRankCount }, (_, i) =>
        Number.isFinite(prevWeights[i]) ? prevWeights[i] : Math.max(1, nextRankCount - i)
      )
    );
  }, [rankingRankCount]);

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
  // 問題番号を変更＝その設問を指定位置へ移動し、他の設問を自動で繰り下げて 1〜N の連番に保つ。
  const moveQuizQuestionToNumber = useCallback((fromIndex: number, toNumber: number) => {
    setQuizQuestions((prev) => {
      const target = clampNumber(toNumber, 1, prev.length, prev.length);
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(target - 1, 0, moved);
      return arr.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
    setActiveQuizQuestionIndex(() => {
      // 移動後の位置（target-1）にアクティブを合わせる。length は state 更新前後で不変。
      const target = clampNumber(toNumber, 1, quizQuestions.length, quizQuestions.length);
      return target - 1;
    });
  }, [quizQuestions.length]);

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
  const pollOrderStorageKey = `host-poll-order:${roomCode}`;

  useEffect(() => {
    pollOrderInitializedRef.current = false;
    setPollOrder([]);
  }, [pollOrderStorageKey]);

  useEffect(() => {
    if (polls.length === 0) {
      pollOrderInitializedRef.current = false;
      setPollOrder([]);
      return;
    }

    setPollOrder((prev) => {
      const currentIds = polls.map((poll) => poll.id);
      const currentIdSet = new Set(currentIds);
      let base = prev;

      if (!pollOrderInitializedRef.current) {
        const persistedOrder = buildPollOrderFromPersistedMeta(polls);
        const hasPersistedOrder = polls.some((poll) => getPollHostOrder(poll) !== null);
        let legacyOrder: string[] = [];
        if (!hasPersistedOrder) {
          try {
            const saved = window.localStorage.getItem(pollOrderStorageKey);
            const parsed = saved ? JSON.parse(saved) : [];
            legacyOrder = Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
          } catch {
            legacyOrder = [];
          }
        }
        base = hasPersistedOrder ? persistedOrder : legacyOrder;
        pollOrderInitializedRef.current = true;
      }

      const next = [
        ...base.filter((id) => currentIdSet.has(id)),
        ...currentIds.filter((id) => !base.includes(id)),
      ];
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      try {
        window.localStorage.setItem(pollOrderStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [pollOrderStorageKey, polls]);

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
      // 設問番号順で保存する（保存データの並び順＝表示順になり、各画面が番号順に揃う）。
      .map((q, index) => ({ q, index }))
      .sort((a, b) => (a.q.questionNumber - b.q.questionNumber) || (a.index - b.index))
      .map(({ q }) => q)
      .map((q) => {
        const kept = q.options
          .map((o, i) => ({
            text: o.trim(),
            imageUrl: q.optionImages[i] || undefined,
            origIndex: i,
          }))
          .filter((o) => o.text);
        // 正解 offsets を「空欄除外後」の並びに合わせて補正
        const correctOffsets = q.correctOptionOffsets
          .map((offset) => kept.findIndex((o) => o.origIndex === offset))
          .filter((offset, index, offsets) => offset >= 0 && offsets.indexOf(offset) === index);
        return { ...q, kept, correctOffsets };
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
        : pollMode === 'free_text'
        ? []
        : pollOptions.filter((o) => o.trim());
    if (
      !pollQuestion.trim() ||
      (pollMode === 'standard' && validOptions.length < 2) ||
      (pollMode === 'ranking' && validOptions.length < 2) ||
      (pollMode === 'quiz' && validQuizQuestions.length === 0)
    ) return;
    setCreatingPoll(true);
    try {
      const finalMaxSelections =
        pollMode === 'ranking'
          ? clampNumber(rankingRankCount, 1, validOptions.length, 3)
          : pollMode === 'quiz'
          ? validQuizQuestions.reduce(
              (sum, q) => sum + Math.max(1, q.correctOffsets.length),
              0
            )
          : pollMode === 'free_text'
          ? 1
          : Math.max(1, Math.min(pollMaxSelections, validOptions.length));
      const optionsPayload: PollOption[] =
        pollMode === 'quiz'
          ? quizFlatOptions
          : validOptions;
      const editingPoll = editingPollId ? polls.find((poll) => poll.id === editingPollId) : null;
      const editingPollMeta = editingPoll ? extractPollPayload(editingPoll.options).meta : null;
      const editingPollPosition = editingPollId ? pollOrder.indexOf(editingPollId) + 1 : 0;
      const editingHostOrder = editingPoll ? getPollHostOrder(editingPoll) : null;
      const nextHostOrder = editingPollId
        ? editingHostOrder ?? (editingPollPosition > 0 ? editingPollPosition : undefined)
        : 1;
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
          correctOptionOffsets: q.correctOffsets.length > 0 ? q.correctOffsets : undefined,
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
              ? standardTimeLimit === '' || standardTimeLimit <= 0
                ? undefined
                : standardTimeLimit
              : pollMode === 'quiz'
              ? quizTimeLimit
              : pollMode === 'ranking'
              ? rankingTimeLimit
              : pollMode === 'free_text'
              ? freeTextTimeLimit === '' || freeTextTimeLimit <= 0
                ? undefined
                : freeTextTimeLimit
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
          freeTextGroups:
            pollMode === 'free_text'
              ? []
              : undefined,
          bulkOrder: editingPollMeta?.bulkOrder,
          hostOrder: nextHostOrder,
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
        const currentPollIds = polls.map((poll) => poll.id);
        const currentPollIdSet = new Set(currentPollIds);
        const nextOrder = [
          createdPoll.id,
          ...pollOrder.filter((id) => currentPollIdSet.has(id)),
          ...currentPollIds.filter((id) => !pollOrder.includes(id)),
        ];
        setPollOrder(nextOrder);
        await persistPollOrder(nextOrder);
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
      if (status === 'active') {
        const currentPoll = polls.find((p) => p.id === pollId);
        if (currentPoll) {
          const { meta, options } = extractPollPayload(currentPoll.options);
          if (typeof meta.bulkOrder === 'number') {
            const metaRes = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question: currentPoll.question,
                options,
                meta: { ...meta, bulkOrder: null },
                mode: meta.mode,
              }),
            });
            if (metaRes.ok) {
              const updatedPoll = (await metaRes.json()) as Poll;
              optimisticUpsertPoll(updatedPoll);
            }
          }
        }
      }
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

  const handleTogglePollSelect = useCallback((pollId: string) => {
    setSelectedPollIds((prev) => {
      if (prev.includes(pollId)) {
        return prev.filter((id) => id !== pollId);
      }
      // 選択枚数の上限なし（選択順に bulkOrder を付与して一括表示する）。
      return [...prev, pollId];
    });
  }, []);

  const clearPollSelection = useCallback(() => {
    setSelectedPollIds([]);
  }, []);

  const handleBulkStartPolls = useCallback(async () => {
    if (selectedPollIds.length === 0) return;
    setBulkStartPending(true);
    try {
      // 選択順序を保持するために逐次実行（直列）
      for (let i = 0; i < selectedPollIds.length; i++) {
        const pollId = selectedPollIds[i];
        const currentPoll = polls.find((p) => p.id === pollId);
        if (!currentPoll) continue;
        const { meta, options } = extractPollPayload(currentPoll.options);
        const nextMeta = { ...meta, bulkOrder: i + 1 };
        // まず meta(bulkOrder) を反映するために content update
        const metaRes = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: currentPoll.question,
            options,
            meta: nextMeta,
            mode: nextMeta.mode,
          }),
        });
        if (metaRes.ok) {
          const updatedPoll = (await metaRes.json()) as Poll;
          optimisticUpsertPoll(updatedPoll);
        }
        // つづいて status を active に
        const statusRes = await fetch(`/api/rooms/${roomCode}/polls/${pollId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
        if (statusRes.ok) {
          const updatedPoll = (await statusRes.json()) as Poll;
          // bulkOrder は options 内に保持されるため、API レスポンスにそのまま含まれる
          optimisticUpsertPoll(updatedPoll);
        }
      }
      setExportData(null);
      setSelectedPollIds([]);
    } finally {
      setBulkStartPending(false);
    }
  }, [selectedPollIds, polls, roomCode, optimisticUpsertPoll]);

  const selectedPollsInfo = useMemo(() => {
    if (selectedPollIds.length === 0) return null;
    return { count: selectedPollIds.length };
  }, [selectedPollIds]);

  const activeBulkPolls = useMemo(() => {
    return polls
      .map((poll) => {
        const order = extractPollPayload(poll.options).meta.bulkOrder;
        return { poll, order: typeof order === 'number' ? order : null };
      })
      .filter((item): item is { poll: Poll; order: number } => item.poll.status === 'active' && item.order !== null)
      .sort((a, b) => a.order - b.order);
  }, [polls]);

  const screenVisiblePolls = useMemo(() => {
    return polls
      .filter((poll) => poll.status === 'active')
      .map((poll) => {
        const order = extractPollPayload(poll.options).meta.bulkOrder;
        return { poll, order: typeof order === 'number' ? order : null };
      })
      .sort((a, b) => {
        if (a.order !== null && b.order !== null) return a.order - b.order;
        if (a.order !== null) return -1;
        if (b.order !== null) return 1;
        return new Date(a.poll.created_at).getTime() - new Date(b.poll.created_at).getTime();
      });
  }, [polls]);

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

  const executeDeletePoll = async () => {
    if (!pollDeleteConfirm) return;
    await handleDeletePoll(pollDeleteConfirm.id);
    setPollDeleteConfirm(null);
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
      setStandardTimeLimit(meta.timeLimitSeconds || '');
      setEditingPollId(poll.id);
      setShowPollTypeModal(false);
      setShowCreatePoll(true);
      scrollToPollEditor();
      return;
    }
    if (mode === 'ranking') {
      const candidateCount = clampNumber(
        meta.candidateCount ?? options.length,
        3,
        100,
        Math.max(3, Math.min(options.length || 3, 100))
      );
      const rankCount = clampNumber(
        poll.max_selections ?? meta.rankCount ?? 3,
        1,
        Math.min(10, candidateCount),
        Math.min(3, candidateCount)
      );
      setPollMode('ranking');
      setPollQuestion(poll.question || '');
      setRankingCandidateCount(candidateCount);
      setRankingRankCount(rankCount);
      setRankingWeights(getRankingWeights(rankCount, meta.rankingWeights));
      setRankingTimeLimit(meta.timeLimitSeconds || 60);
      setRankingDisplayMode(getRankingDisplayMode(meta.rankingDisplayMode));
      setRankingCandidateTexts(
        Array.from({ length: candidateCount }, (_, i) => getPollOptionLabel(options[i], ''))
      );
      setEditingPollId(poll.id);
      setShowPollTypeModal(false);
      setShowCreatePoll(true);
      scrollToPollEditor();
      return;
    }
    if (mode === 'free_text') {
      setPollMode('free_text');
      setPollQuestion(poll.question || '');
      setFreeTextTimeLimit(meta.timeLimitSeconds || '');
      setEditingPollId(poll.id);
      setShowCreatePoll(true);
      setShowPollTypeModal(false);
      setTimeout(() => pollEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
        correctOptionOffsets: getQuizCorrectOptionOffsets(q),
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

  const handleUpdateFreeTextGroups = useCallback(
    async (poll: Poll, groups: string[]) => {
      const normalized = normalizeFreeTextGroups(groups);
      const { meta, options } = extractPollPayload(poll.options);
      const res = await fetch(`/api/rooms/${roomCode}/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: poll.question,
          options,
          maxSelections: poll.max_selections ?? 1,
          allowMultiple: poll.allow_multiple,
          mode: 'free_text',
          meta: { ...meta, mode: 'free_text', freeTextGroups: normalized },
        }),
      });
      if (!res.ok) throw new Error('Failed to update groups');
      const updated = (await res.json()) as Poll;
      optimisticUpsertPoll(updated);
    },
    [roomCode, optimisticUpsertPoll]
  );

  const handleArrangeFreeTextResponse = useCallback(
    async (
      pollId: string,
      voteId: string,
      patch: { groupLabel?: string | null; displayX?: number | null; displayY?: number | null }
    ) => {
      const res = await fetch(`/api/rooms/${roomCode}/polls/${pollId}/responses/${voteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update response');
    },
    [roomCode]
  );

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

  // Fetch summary for export tab
  useEffect(() => {
    if (tab === 'summary' && !exportData) {
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

  const persistPollOrder = useCallback(
    async (nextOrder: string[]) => {
      try {
        window.localStorage.setItem(pollOrderStorageKey, JSON.stringify(nextOrder));
      } catch {}

      const nextOrderIndex = new Map(nextOrder.map((id, index) => [id, index + 1]));
      const changedPolls = polls.filter((poll) => {
        const nextPosition = nextOrderIndex.get(poll.id);
        return nextPosition !== undefined && getPollHostOrder(poll) !== nextPosition;
      });

      if (changedPolls.length === 0) return;

      await Promise.all(
        changedPolls.map(async (poll) => {
          const nextPosition = nextOrderIndex.get(poll.id);
          if (nextPosition === undefined) return;
          const { meta, options } = extractPollPayload(poll.options);
          const res = await fetch(`/api/rooms/${roomCode}/polls/${poll.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: poll.question,
              options,
              maxSelections: poll.max_selections ?? 1,
              allowMultiple: poll.allow_multiple,
              mode: meta.mode,
              meta: { ...meta, hostOrder: nextPosition },
            }),
          });
          if (!res.ok) throw new Error('Failed to persist poll order');
          const updatedPoll = (await res.json()) as Poll;
          optimisticUpsertPoll(updatedPoll);
        })
      );
    },
    [optimisticUpsertPoll, pollOrderStorageKey, polls, roomCode]
  );

  const orderedPolls = useMemo(() => {
    const orderIndex = new Map(pollOrder.map((id, index) => [id, index]));
    return [...polls].sort((a, b) => {
      const aIndex = orderIndex.get(a.id);
      const bIndex = orderIndex.get(b.id);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [pollOrder, polls]);

  const movePollCard = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setPollOrder((prev) => {
        const pollIds = polls.map((poll) => poll.id);
        const currentIdSet = new Set(pollIds);
        const base = [
          ...prev.filter((id) => currentIdSet.has(id)),
          ...pollIds.filter((id) => !prev.includes(id)),
        ];
        const from = base.indexOf(sourceId);
        const to = base.indexOf(targetId);
        if (from < 0 || to < 0) return prev;
        const next = [...base];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        void persistPollOrder(next).catch((error) => {
          console.error('Failed to persist poll order:', error);
          window.alert('カードの並び順を保存できませんでした。時間をおいてもう一度お試しください。');
        });
        return next;
      });
    },
    [persistPollOrder, polls]
  );

  const movePollCardToPosition = useCallback(
    (sourceId: string, position: number) => {
      const targetPosition = clampNumber(position, 1, Math.max(1, polls.length), 1);
      setPollOrder((prev) => {
        const pollIds = polls.map((poll) => poll.id);
        const currentIdSet = new Set(pollIds);
        const base = [
          ...prev.filter((id) => currentIdSet.has(id)),
          ...pollIds.filter((id) => !prev.includes(id)),
        ];
        const from = base.indexOf(sourceId);
        if (from < 0) return prev;
        const next = [...base];
        const [moved] = next.splice(from, 1);
        next.splice(targetPosition - 1, 0, moved);
        void persistPollOrder(next).catch((error) => {
          console.error('Failed to persist poll order:', error);
          window.alert('カードの並び順を保存できませんでした。時間をおいてもう一度お試しください。');
        });
        return next;
      });
      setPollPage(Math.max(1, Math.ceil(targetPosition / POLLS_PER_PAGE)));
    },
    [persistPollOrder, polls]
  );

  const findPollCardFromPoint = useCallback((clientX: number, clientY: number) => {
    if (typeof document === 'undefined') return null;
    const elements =
      typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(clientX, clientY)
        : [document.elementFromPoint(clientX, clientY)].filter(Boolean);
    for (const element of elements) {
      if (!(element instanceof HTMLElement)) continue;
      const card = element.closest<HTMLElement>('[data-poll-card-id]');
      const id = card?.dataset.pollCardId;
      if (id) return id;
    }
    return null;
  }, []);

  const handlePollPointerReorderStart = useCallback(
    (sourceId: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' || event.button !== 0) return;
      event.preventDefault();
      const sourceElement = event.currentTarget;
      sourceElement.setPointerCapture?.(event.pointerId);
      setDraggingPollId(sourceId);
      setDragOverPollId(sourceId);

      const previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const updateTarget = (clientX: number, clientY: number) => {
        const targetId = findPollCardFromPoint(clientX, clientY);
        setDragOverPollId(targetId || null);
        return targetId;
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const edgeSize = 72;
        if (moveEvent.clientY < edgeSize) {
          window.scrollBy({ top: -14, behavior: 'auto' });
        } else if (moveEvent.clientY > window.innerHeight - edgeSize) {
          window.scrollBy({ top: 14, behavior: 'auto' });
        }
        updateTarget(moveEvent.clientX, moveEvent.clientY);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        const targetId = updateTarget(upEvent.clientX, upEvent.clientY);
        if (targetId && targetId !== sourceId) {
          movePollCard(sourceId, targetId);
        }
        sourceElement.releasePointerCapture?.(event.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
        document.body.style.overflow = previousBodyOverflow;
        setDraggingPollId(null);
        setDragOverPollId(null);
        setDragOverPollPage(null);
      };

      const handlePointerCancel = () => {
        sourceElement.releasePointerCapture?.(event.pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerCancel);
        document.body.style.overflow = previousBodyOverflow;
        setDraggingPollId(null);
        setDragOverPollId(null);
        setDragOverPollPage(null);
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp, { passive: false });
      window.addEventListener('pointercancel', handlePointerCancel);
    },
    [findPollCardFromPoint, movePollCard]
  );

  const filteredPolls = useMemo(() => {
    const query = pollSearch.trim().toLowerCase();
    const visible = orderedPolls.filter((poll) => poll.id !== editingPollId);
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
  }, [editingPollId, orderedPolls, pollSearch]);

  const handleFocusPollCard = useCallback(
    (pollId: string) => {
      const filteredIndex = filteredPolls.findIndex((poll) => poll.id === pollId);
      const targetIndex =
        filteredIndex >= 0 ? filteredIndex : orderedPolls.findIndex((poll) => poll.id === pollId);
      if (targetIndex < 0) return;

      if (filteredIndex < 0 && pollSearch.trim()) {
        setPollSearch('');
      }
      setFocusedPollId(pollId);
      setPollPage(Math.max(1, Math.ceil((targetIndex + 1) / POLLS_PER_PAGE)));

      window.setTimeout(() => {
        const card = document.getElementById(`poll-card-${pollId}`);
        card?.focus({ preventScroll: true });
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
      window.setTimeout(() => setFocusedPollId((current) => (current === pollId ? null : current)), 1800);
    },
    [filteredPolls, orderedPolls, pollSearch]
  );

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
  const activeHostTheme = HOST_COLOR_THEMES[activeHostItem.key];
  const ActiveHostIcon = activeHostItem.icon;

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
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-80 p-0 sm:max-w-sm">
          <SheetTitle className="sr-only">ホスト管理メニュー</SheetTitle>
          <SheetDescription className="sr-only">
            ホスト管理画面の各タブ、参加QR、スクリーン表示、セッション操作を切り替えます。
          </SheetDescription>
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
            collapsed={false}
            onToggleCollapsed={() => {}}
            mobile
            onAfterSelect={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#e9e7e7] bg-white">
        <div className="border-b border-slate-200/60 bg-white/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
              <Image src={LOGO_URL} alt="ざせきくん" width={28} height={28} className="shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight text-[#323232]">ざせきくん</p>
                <p className="truncate text-[11px] font-semibold leading-tight text-[#8c8989]">{room.title}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#323232] transition-colors hover:bg-slate-100"
              aria-label="メニューを開く"
              title="メニューを開く"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="hidden lg:block">
          <HostPageHeader
            title={activeHostItem.label}
            description={`${room.title} / ${activeHostItem.description}`}
            icon={activeHostItem.icon}
            theme={activeHostTheme}
          >
            {tab === 'polls' && (
              <button
                type="button"
                onClick={() => setShowPollTypeModal(true)}
                disabled={atPollLimit}
                title={atPollLimit ? `Freeプランではライブ投票カードを${pollLimit}個まで作成できます` : 'ライブ投票を新規作成'}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#2864f0] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
              >
                <Plus className="h-3.5 w-3.5" />
                新規作成
              </button>
            )}
            {tab !== 'faq' && (
              <button
                type="button"
                onClick={() => setTab('faq')}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#9dd8b1] bg-white text-[#00963c] transition-colors hover:bg-[#eaf8ef]"
                aria-label="ホスト管理のFAQを開く"
                title="ホスト管理のFAQ"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            )}
            <a
              href={`/rooms/${roomCode}/present`}
              target={`zasekikun-present-${roomCode}`}
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e1dcdc] bg-white text-[#2864f0] transition-colors hover:border-[#aac8ff] hover:bg-[#ebf3ff]"
              title="スクリーン画面を開く"
            >
              <Monitor className="w-4 h-4" />
            </a>
          </HostPageHeader>
        </div>

        <div
          className="border-b px-4 py-3 lg:hidden"
          style={{ backgroundColor: activeHostTheme.headerBg, borderColor: activeHostTheme.headerBorder }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                style={{
                  backgroundColor: activeHostTheme.iconBg,
                  borderColor: activeHostTheme.iconBorder,
                  color: activeHostTheme.accent,
                }}
              >
                <ActiveHostIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-tight" style={{ color: activeHostTheme.titleText }}>
                  {activeHostItem.label}
                </h1>
                <p className="truncate text-xs" style={{ color: activeHostTheme.descriptionText }}>
                  {activeHostItem.description}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {tab === 'polls' && (
                <button
                  type="button"
                  onClick={() => setShowPollTypeModal(true)}
                  disabled={atPollLimit}
                  title={atPollLimit ? `Freeプランではライブ投票カードを${pollLimit}個まで作成できます` : 'ライブ投票を新規作成'}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#2864f0] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新規作成
                </button>
              )}
              {tab !== 'faq' && (
                <button
                  type="button"
                  onClick={() => setTab('faq')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#9dd8b1] bg-white text-[#00963c] transition-colors hover:bg-[#eaf8ef]"
                  aria-label="ホスト管理のFAQを開く"
                  title="ホスト管理のFAQ"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              )}
              <a
                href={`/rooms/${roomCode}/present`}
                target={`zasekikun-present-${roomCode}`}
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#e1dcdc] bg-white text-[#2864f0] transition-colors hover:border-[#aac8ff] hover:bg-[#ebf3ff]"
                title="スクリーン画面を開く"
              >
                <Monitor className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        {/* モバイルの参加コード行は削除済み（ハンバーガーメニュー内で確認できるため） */}
      </header>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-6xl px-3 py-3 sm:px-5 sm:py-5">
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
                />
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
              <div className="relative w-full max-w-2xl">
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

            {selectedPollsInfo && (
              <div className="flex flex-col gap-2 rounded-lg border border-[#9dd8b1] bg-[#eaf8ef] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-bold text-[#00963c]">
                  <span className="tabular-nums">{selectedPollsInfo.count}</span> 件選択中
                  <span className="ml-2 text-xs font-semibold text-[#1e7a35]">
                    （選択順に表示します）
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearPollSelection}
                    disabled={bulkStartPending}
                    className="inline-flex h-9 items-center rounded-md border border-[#9dd8b1] bg-white px-3 text-xs font-bold text-[#00963c] hover:bg-white/80 disabled:opacity-60"
                  >
                    選択をクリア
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkStartPolls}
                    disabled={bulkStartPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {bulkStartPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    一斉開始
                  </button>
                </div>
              </div>
            )}

            {!selectedPollsInfo && screenVisiblePolls.length > 0 && (
              <div className="rounded-lg border border-[#9dd8b1] bg-[#eaf8ef] px-4 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#00963c]">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00963c] text-xs text-white">
                      <Monitor className="h-3.5 w-3.5" />
                    </span>
                    スクリーン画面に表示中
                    {activeBulkPolls.length > 1 && (
                      <span className="text-xs font-semibold text-[#1e7a35]">
                        （表示順 {activeBulkPolls.map(({ order }) => order).join('→')}）
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {screenVisiblePolls.map(({ poll, order }) => (
                      <button
                        key={poll.id}
                        type="button"
                        onClick={() => handleFocusPollCard(poll.id)}
                        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-[#9dd8b1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#323232] transition-colors hover:bg-white/80"
                        title={order !== null ? `${order}番目: ${poll.question || '（無題）'}` : poll.question || '（無題）'}
                      >
                        {activeBulkPolls.length > 1 && order !== null ? (
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#00963c] text-[11px] text-white tabular-nums">
                            {order}
                          </span>
                        ) : (
                          <Monitor className="h-4 w-4 shrink-0 text-[#00963c]" />
                        )}
                        <span className="max-w-[13rem] truncate">{poll.question || '（無題）'}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
                            : pollMode === 'ranking'
                            ? 'ランキング形式を編集'
                            : 'ブレスト形式を編集'
                          : pollMode === 'standard'
                          ? '通常投票を作成'
                          : pollMode === 'quiz'
                          ? 'クイズ形式を作成'
                          : pollMode === 'ranking'
                          ? 'ランキング形式を作成'
                          : 'ブレスト形式を作成'}
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
                      placeholder={pollMode === 'quiz' ? 'クイズタイトル（例: 確認問題）' : pollMode === 'ranking' ? '投票タイトル（例: ランキングテーマを選んでください）' : pollMode === 'free_text' ? '発問（例: 〇〇は、なにかな？）' : '質問文（例: 今日の授業の理解度は？）'}
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
                          <select
                            value={quizTimeLimit}
                            onChange={(e) =>
                              setQuizTimeLimit(clampNumber(e.target.value, 5, 3600, 60))
                            }
                            className="h-8 w-28 rounded-md bg-white px-2 text-center text-sm font-semibold tabular-nums ring-1 ring-slate-200 outline-none focus:ring-emerald-300"
                            aria-label="解答時間（全問題共通）"
                          >
                            {getPollTimeOptions(quizTimeLimit, 5).map((seconds) => (
                              <option key={seconds} value={seconds}>
                                {formatSecondsOption(seconds)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>

                  {pollMode === 'quiz' && (
                    <div className="space-y-4">
                      {activeQuizQuestion && (
                        <div className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <textarea
                              value={activeQuizQuestion.question}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateQuizQuestion(activeQuizQuestionIndex, (q) => ({ ...q, question: value }));
                              }}
                              placeholder="問題文を入力してください"
                              className="min-h-[88px] w-full resize-y rounded-xl bg-white px-4 py-3 text-lg leading-relaxed font-medium ring-1 ring-slate-200 outline-none focus:ring-emerald-300 sm:flex-1"
                              style={{ fontSize: '18px' }}
                            />
                            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                              {/* 1行目: 選択肢の数 + 削除 / 2行目: アップロード */}
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  value={activeQuizQuestion.options.length}
                                  onChange={(e) => {
                                    const count = Number(e.target.value);
                                    updateQuizQuestion(activeQuizQuestionIndex, (q) => ({
                                      ...q,
                                      options: Array.from({ length: count }, (_, optionIndex) => q.options[optionIndex] || ''),
                                      optionImages: Array.from({ length: count }, (_, optionIndex) => q.optionImages[optionIndex] || ''),
                                      correctOptionOffsets: q.correctOptionOffsets.filter((offset) => offset < count),
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
                                      setQuizQuestions((prev) =>
                                        prev
                                          .filter((_, i) => i !== activeQuizQuestionIndex)
                                          .map((q, i) => ({ ...q, questionNumber: i + 1 }))
                                      );
                                      setActiveQuizQuestionIndex((i) => Math.max(0, Math.min(i, quizQuestions.length - 2)));
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                                    title="問題を削除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <label
                                className={`inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 ${
                                  imageUploading[`${activeQuizQuestion.id}-question`]
                                    ? 'pointer-events-none opacity-60'
                                    : ''
                                }`}
                                title="問題文に画像をアップロード（推奨: 1600x900px / 10MB以内）"
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

                          <div className="mt-3">
                            <label className="flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                              <span className="shrink-0">問題番号</span>
                              <select
                                value={activeQuizQuestionIndex + 1}
                                onChange={(e) => {
                                  moveQuizQuestionToNumber(activeQuizQuestionIndex, Number(e.target.value));
                                }}
                                className="h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-slate-200 outline-none focus:ring-emerald-300 sm:w-40"
                              >
                                {Array.from({ length: quizQuestions.length }, (_, i) => i + 1).map((number) => (
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
                            任意: ✓で正解を設定（複数選択可・未設定でもクイズにできます）
                          </p>
                          <div className="mt-1.5 space-y-2">
                            {activeQuizQuestion.options.map((opt, optionIndex) => {
                              const isCorrect = activeQuizQuestion.correctOptionOffsets.includes(optionIndex);
                              return (
                              <div key={optionIndex} className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuizQuestion(activeQuizQuestionIndex, (q) => {
                                      const correctOptionOffsets = q.correctOptionOffsets.includes(optionIndex)
                                        ? q.correctOptionOffsets.filter((offset) => offset !== optionIndex)
                                        : [...q.correctOptionOffsets, optionIndex].sort((a, b) => a - b);
                                      return { ...q, correctOptionOffsets };
                                    })
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
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCreatePoll}
                            disabled={
                              creatingPoll ||
                              !pollQuestion.trim() ||
                              !quizQuestions.some((q) => q.question.trim() && q.options.filter((o) => o.trim()).length >= 2)
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
                            type="button"
                            onClick={() => {
                              setShowCreatePoll(false);
                              setEditingPollId(null);
                            }}
                            className="font-semibold px-4 h-10 rounded-lg text-sm text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 transition-colors"
                          >
                            キャンセル
                          </button>
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
                          <div className="mt-1 flex items-center gap-2">
                            <select
                              value={rankingCandidateCount}
                              onChange={(e) => handleRankingCandidateCountChange(e.target.value)}
                              className="h-11 w-full rounded-xl bg-slate-50 px-3 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                              style={{ fontSize: '16px' }}
                            >
                              {Array.from({ length: 98 }, (_, i) => i + 3).map((count) => (
                                <option key={count} value={count}>
                                  {count}
                                </option>
                              ))}
                            </select>
                            <span className="shrink-0 text-xs font-semibold text-slate-400">件</span>
                          </div>
                          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
                            3〜100件から選択できます
                          </span>
                        </label>
                        <label className="text-xs sm:text-sm text-slate-600">
                          1人あたりの回答順位数
                          <input
                            type="number"
                            min={1}
                            max={Math.min(10, rankingCandidateCount)}
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
                            <select
                              value={rankingTimeLimit}
                              onChange={(e) => setRankingTimeLimit(clampNumber(e.target.value, 0, 3600, 60))}
                              className="h-11 w-full rounded-xl bg-slate-50 px-3 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                            >
                              {getPollTimeOptions(rankingTimeLimit, 0, true).map((seconds) => (
                                <option key={seconds} value={seconds}>
                                  {formatSecondsOption(seconds)}
                                </option>
                              ))}
                            </select>
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

                  {pollMode === 'free_text' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        回答時間
                        <select
                          value={freeTextTimeLimit === '' ? '' : freeTextTimeLimit}
                          onChange={(e) =>
                            setFreeTextTimeLimit(
                              e.target.value === ''
                                ? ''
                                : clampNumber(e.target.value, 1, 3600, 60)
                            )
                          }
                          className="h-9 w-32 rounded-lg bg-slate-50 px-2 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                        >
                          <option value="">なし</option>
                          {getPollTimeOptions(freeTextTimeLimit, 1).map((seconds) => (
                            <option key={seconds} value={seconds}>
                              {formatSecondsOption(seconds)}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] font-semibold text-slate-400">
                          空欄で常時受付
                        </span>
                      </label>
                    </div>
                  )}

                  {pollMode === 'standard' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                        投票時間
                        <select
                          value={standardTimeLimit === '' ? '' : standardTimeLimit}
                          onChange={(e) =>
                            setStandardTimeLimit(
                              e.target.value === ''
                                ? ''
                                : clampNumber(e.target.value, 1, 3600, 60)
                            )
                          }
                          className="h-9 w-32 rounded-lg bg-slate-50 px-2 text-center font-semibold tabular-nums ring-1 ring-slate-200 outline-none"
                        >
                          <option value="">なし</option>
                          {getPollTimeOptions(standardTimeLimit, 1).map((seconds) => (
                            <option key={seconds} value={seconds}>
                              {formatSecondsOption(seconds)}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] font-semibold text-slate-400">
                          空欄で常時受付
                        </span>
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
                  {/* クイズ形式は「問題を追加」と同じ行に作成/キャンセルを配置するため、共通フッターは非表示 */}
                  {pollMode !== 'quiz' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreatePoll}
                      disabled={
                        creatingPoll ||
	                        !pollQuestion.trim() ||
	                        (pollMode === 'standard' && pollOptions.filter((o) => o.trim()).length < 2) ||
	                        (pollMode === 'ranking' && rankingCandidateCount < 3)
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
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {pLoading ? (
              <p className="text-center text-sm text-slate-400 py-8">読み込み中...</p>
            ) : polls.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-slate-200 px-4 py-12 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mb-3">
                  <BarChart3 className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-800">ワークスペース内で使用するアクションカードを作成する</p>
                <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: Hammer,
                      title: '活動をカード化',
                      description: '投票・クイズ・ランキング・ブレストを、1枚ずつ作成できます。',
                    },
                    {
                      icon: ListOrdered,
                      title: 'ワークスペースで使用するカードを選択',
                      description: '投票機能、クイズ形式、ランキング形式、プレスト形式から1つを選択して、ユーザーの理解度や声を確認できます。',
                    },
                  ].map(({ icon: Icon, title, description }) => (
                    <div key={title} className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-left">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-white text-emerald-600 ring-1 ring-emerald-100">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPollTypeModal(true)}
                  disabled={atPollLimit}
                  className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2864f0] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#285ac8] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  最初のカードを作成する
                </button>
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
                        <p className="text-sm font-bold text-[#323232]">一致するワークカードはありません</p>
                        <p className="mt-1 text-xs text-[#595959]">検索条件を変更してください。</p>
                      </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {pagedPolls.map((poll) => (
                        <div
                          key={poll.id}
                          tabIndex={-1}
                          data-poll-card-id={poll.id}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverPollId !== poll.id) setDragOverPollId(poll.id);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const sourceId = e.dataTransfer.getData('text/plain') || draggingPollId;
                            if (sourceId) movePollCard(sourceId, poll.id);
                            setDraggingPollId(null);
                            setDragOverPollId(null);
                            setDragOverPollPage(null);
                          }}
                          className={`rounded-lg transition-all outline-none ${
                            draggingPollId === poll.id ? 'opacity-50' : 'opacity-100'
                          } ${
                            focusedPollId === poll.id
                              ? 'ring-4 ring-[#2864f0] ring-offset-4 ring-offset-white'
                              : ''
                          } ${
                            dragOverPollId === poll.id && draggingPollId !== poll.id
                              ? 'ring-2 ring-[#00963c] ring-offset-2'
                              : ''
                          }`}
                        >
                          <PollResultCard
                            poll={poll}
                            votes={pollVotes[poll.id] || []}
                            pendingId={pollStatusPendingId}
                            deletingId={pollDeletingId}
                            editing={editingPollId === poll.id}
                            onStart={() => handlePollStatus(poll.id, 'active')}
                            onClose={() => handlePollStatus(poll.id, 'closed')}
                            onDelete={() => setPollDeleteConfirm({ id: poll.id, name: poll.question || 'このカード' })}
                            onEdit={() => handleEditPoll(poll)}
                            onReset={() => handleResetPoll(poll.id)}
                            resetting={pollResettingId === poll.id}
                            onDragStart={(e) => {
                              setDraggingPollId(poll.id);
                              setDragOverPollId(poll.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', poll.id);
                            }}
                            onDragEnd={() => {
                              setDraggingPollId(null);
                              setDragOverPollId(null);
                              setDragOverPollPage(null);
                            }}
                            onPointerReorderStart={(e) => handlePollPointerReorderStart(poll.id, e)}
                            orderPosition={orderedPolls.findIndex((item) => item.id === poll.id) + 1}
                            totalPollCount={orderedPolls.length}
                            onMoveToPosition={(position) => movePollCardToPosition(poll.id, position)}
                            selectionIndex={selectedPollIds.indexOf(poll.id)}
	                            hideSelection={polls.some((item) => item.status === 'active')}
	                            onToggleSelect={() => handleTogglePollSelect(poll.id)}
	                            onArrangeFreeTextResponse={(voteId, patch) =>
	                              handleArrangeFreeTextResponse(poll.id, voteId, patch)
	                            }
	                            onUpdateFreeTextGroups={(groups) => handleUpdateFreeTextGroups(poll, groups)}
	                          />
                        </div>
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
                            onDragOver={(e) => {
                              if (!draggingPollId) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDragOverPollPage(page);
                            }}
                            onDragLeave={() => setDragOverPollPage((current) => (current === page ? null : current))}
                            onDrop={(e) => {
                              e.preventDefault();
                              const sourceId = e.dataTransfer.getData('text/plain') || draggingPollId;
                              if (sourceId) {
                                movePollCardToPosition(sourceId, (page - 1) * POLLS_PER_PAGE + 1);
                              }
                              setDraggingPollId(null);
                              setDragOverPollId(null);
                              setDragOverPollPage(null);
                            }}
                            aria-current={page === currentPage ? 'page' : undefined}
                            className={`h-9 min-w-9 px-3 rounded-lg text-sm font-semibold transition-colors ${
                              dragOverPollPage === page
                                ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400 ring-offset-2'
                                : page === currentPage
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
          <div className="space-y-5">
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
          </div>
        )}

        {/* === Integration Tab === */}
        {tab === 'integration' && (
          <div className="space-y-5">
            {/* 出席フォーム紐付け */}
            <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-4 sm:p-6">
              <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4 sm:p-5">
              <p className="text-xs sm:text-sm font-bold text-slate-700 mb-2">使い方</p>
              <ul className="text-xs sm:text-sm text-slate-500 space-y-1.5 leading-relaxed list-disc list-inside">
                <li>紐付けると、参加者画面のタブに「出席」が表示されます。</li>
                <li>位置情報チェック・クールダウンなど既存の出席フォーム設定がそのまま適用されます。</li>
                <li>講師は参加者に「出席タブを開いてください」とアナウンスするだけで出席を取れます。</li>
              </ul>
            </div>
          </div>
        )}

        {/* === Report Tab === */}
        {tab === 'report' && <SessionReportContent roomCode={roomCode} embedded />}

        {/* === FAQ Tab === */}
        {tab === 'faq' && (
          <div className="space-y-5">
            {/* 当日チェックリスト（本番前の事前確認で当日事故を減らす） */}
            <section className="rounded-lg border border-[#aac8ff] bg-[#ebf3ff] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[#2864f0]">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#323232]">当日チェックリスト</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[#595959]">
                    本番開始前に、次の5つを確認しておくと当日のトラブルを大きく減らせます。
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {[
                  'QRコードを投影またはプリントし、自分のスマホで読み取って参加者画面が開くか確認した',
                  '会場の電波状況を確認した（Wi-Fiが不安定な場合は参加者にモバイル回線の利用を案内）',
                  'スクリーン画面（投影）を開き、プロジェクターでの見え方を確認した',
                  '出席フォームを使う場合: 位置情報の対象エリア設定と、自分の端末での出席登録テストを済ませた',
                  'ワーク（投票・クイズ）のカードを事前に作成し、開始・締切の操作を一度試した',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#323232]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2864f0]" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HOST_FAQ_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <a
                    key={section.id}
                    href={`#host-faq-${section.id}`}
                    className="rounded-lg border border-[#9dd8b1] bg-white p-4 transition-colors hover:bg-[#eaf8ef]"
                  >
                    <Icon className="h-5 w-5 text-[#00963c]" />
                    <p className="mt-2 text-sm font-bold text-[#323232]">{section.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#595959]">{section.summary}</p>
                  </a>
                );
              })}
            </div>

            <div className="space-y-4">
              {HOST_FAQ_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <section
                    key={section.id}
                    id={`host-faq-${section.id}`}
                    className="scroll-mt-48 rounded-lg border border-[#e9e7e7] bg-white p-4 sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eaf8ef] text-[#00963c]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-bold text-[#323232]">{section.title}</h2>
                        <p className="mt-1 text-sm font-bold text-[#1e7a35]">{section.summary}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-[#595959]">{section.body}</p>
                    <div className="mt-4 rounded-lg border border-[#9dd8b1] bg-[#eaf8ef] p-3">
                      {section.tips.map((tip) => (
                        <p key={tip} className="text-xs leading-6 text-[#1e7a35]">
                          {tip}
                        </p>
                      ))}
                    </div>
                  </section>
                );
              })}
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

      {/* ライブ投票カード削除の確認モーダル */}
      <CustomModal
        isOpen={!!pollDeleteConfirm}
        onClose={() => { if (!pollDeletingId) setPollDeleteConfirm(null); }}
        title="削除の確認"
        description={`「${pollDeleteConfirm?.name ?? ''}」を削除してもよろしいですか？\n回答データもすべて削除されます。`}
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              このカードと回答データがすべて削除されます。この操作は取り消せません。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPollDeleteConfirm(null)}
              disabled={!!pollDeletingId}
              className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={executeDeletePoll}
              disabled={!!pollDeletingId}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              {pollDeletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  削除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  削除する
                </>
              )}
            </button>
          </div>
        </div>
      </CustomModal>
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
  mobile = false,
  onAfterSelect,
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
  mobile?: boolean;
  onAfterSelect?: () => void;
}) {
  const isCollapsed = mobile ? false : collapsed;

  return (
    <aside
      className={`shrink-0 border-r border-[#9dd8b1] bg-[#eaf8ef] transition-[width] duration-200 ease-out ${
        mobile
          ? 'flex h-full w-full flex-col'
          : `hidden h-screen lg:sticky lg:top-0 lg:flex lg:flex-col ${isCollapsed ? 'w-16' : 'w-72'}`
      }`}
    >
      <div className={`border-b border-[#9dd8b1] ${isCollapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
          <Link
            href="/admin"
            className={`flex min-w-0 items-center transition-opacity hover:opacity-80 ${
              isCollapsed ? 'justify-center' : 'gap-2.5'
            }`}
            title="管理画面へ"
          >
            <Image src={LOGO_URL} alt="ざせきくん" width={isCollapsed ? 28 : 32} height={isCollapsed ? 28 : 32} className="rounded-lg" />
            {!isCollapsed && <span className="truncate text-sm font-bold text-[#323232]">ざせきくん</span>}
          </Link>
          {!mobile && !isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#00963c] transition-colors hover:bg-white"
              aria-label="サイドバーを閉じる"
              title="サイドバーを閉じる"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {!mobile && isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md text-[#00963c] transition-colors hover:bg-white"
            aria-label="サイドバーを開く"
            title="サイドバーを開く"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isCollapsed && (
      <div className="border-b border-[#9dd8b1] px-4 py-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-[#00963c]">
            <Image src={LOGO_URL} alt="" width={24} height={24} className="rounded-md" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold leading-snug text-[#323232]">{room.title}</h2>
            <button
              type="button"
              onClick={onCopyCode}
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold tracking-wider text-[#595959] hover:text-[#00963c]"
              title="コードをコピー"
            >
              #{room.code}
              {copied ? <Check className="h-3 w-3 text-[#00963c]" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[#9dd8b1] bg-white p-2">
            <p className="font-bold text-[#8c8989]">参加者</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold tabular-nums text-[#323232]">
              <Users className="h-3.5 w-3.5 text-[#00963c]" />
              {presenceCount}人
            </p>
          </div>
          <a
            href={qrUrl || '#'}
            download={`qr-${roomCode}.png`}
            className={`rounded-lg border border-[#9dd8b1] bg-white p-2 transition-colors hover:bg-[#eaf8ef] ${
              qrUrl ? '' : 'pointer-events-none opacity-50'
            }`}
          >
            <p className="font-bold text-[#8c8989]">参加QR</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#323232]">
              <QrCode className="h-3.5 w-3.5 text-[#00963c]" />
              保存
            </p>
          </a>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <a
            href={`/rooms/${roomCode}/present`}
            target={`zasekikun-present-${roomCode}`}
            rel="noopener noreferrer"
            className="rounded-lg border border-[#aac8ff] bg-white p-2 transition-colors hover:bg-[#ebf3ff]"
            title="スクリーン画面を開く"
          >
            <p className="font-bold text-[#8c8989]">スクリーン</p>
            <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#2864f0]">
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
                : 'border border-[#9dd8b1] bg-white hover:bg-[#eaf8ef]'
            }`}
          >
            {roomStatusLoading ? (
              <span className="flex h-full items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00963c]" />
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
                <p className="mt-1 inline-flex items-center gap-1 font-extrabold text-[#00963c]">
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
              onClick={() => {
                onSelectTab(item.key);
                onAfterSelect?.();
              }}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              className={`flex w-full items-center rounded-lg text-left transition-colors ${
                isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2.5'
              } ${
                active ? 'bg-white text-[#323232]' : 'text-[#323232] hover:bg-white/70'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-[#eaf8ef] text-[#00963c]' : 'bg-transparent text-[#00963c]'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              {!isCollapsed && <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-none">{item.label}</span>
                <span className={`mt-1 block truncate text-[11px] leading-none ${active ? 'text-[#595959]' : 'text-[#8c8989]'}`}>
                  {item.description}
                </span>
              </span>}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#9dd8b1] p-4">
        <Link
          href="/admin"
          className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#aac8ff] bg-white text-sm font-bold text-[#2864f0] transition-colors hover:bg-[#ebf3ff] hover:text-[#285ac8] ${
            isCollapsed ? 'px-0' : ''
          }`}
          title="管理画面へ"
          aria-label="管理画面へ"
        >
          <ArrowLeft className="h-4 w-4" />
          {!isCollapsed && '管理画面へ'}
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
    {
      mode: 'free_text',
      title: 'ブレスト形式',
      desc: '短文回答を付箋のように集め、スクリーンで分類します。',
      icon: <Hand className="w-5 h-5" />,
    },
  ];

  // 種類ごとに振り分けた色でカードを差別化（ブレスト形式＝オレンジ）
  const cardStyles: Record<PollMode, { card: string; badge: string }> = {
    standard: { card: 'hover:bg-emerald-50 hover:ring-emerald-200', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    quiz: { card: 'hover:bg-blue-50 hover:ring-blue-200', badge: 'bg-blue-50 text-blue-700 ring-blue-100' },
    ranking: { card: 'hover:bg-amber-50 hover:ring-amber-200', badge: 'bg-amber-50 text-amber-700 ring-amber-100' },
    free_text: { card: 'hover:bg-orange-50 hover:ring-orange-200', badge: 'bg-orange-50 text-orange-700 ring-orange-100' },
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
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => onSelect(item.mode)}
              className={`min-h-[150px] rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition-colors ${cardStyles[item.mode].card}`}
            >
              <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${cardStyles[item.mode].badge}`}>
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
  onDragStart,
  onDragEnd,
  onPointerReorderStart,
  orderPosition,
  totalPollCount,
  onMoveToPosition,
  selectionIndex = -1,
  hideSelection = false,
  onToggleSelect,
  onArrangeFreeTextResponse,
  onUpdateFreeTextGroups,
}: {
  poll: Poll;
  votes: PollVote[];
  pendingId: string | null;
  deletingId: string | null;
  editing: boolean;
  onStart: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onPointerReorderStart?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  orderPosition: number;
  totalPollCount: number;
  onMoveToPosition: (position: number) => void;
  selectionIndex?: number;
  hideSelection?: boolean;
  onToggleSelect?: () => void;
  onArrangeFreeTextResponse?: (
    voteId: string,
    patch: { groupLabel?: string | null; displayX?: number | null; displayY?: number | null }
  ) => void | Promise<void>;
  onUpdateFreeTextGroups?: (groups: string[]) => void | Promise<void>;
}) {
  const selected = selectionIndex >= 0;
  const selectionNumber = selected ? `${selectionIndex + 1}` : null;
  const { meta, options } = extractPollPayload(poll.options);
  const mode = getPollMode(meta.mode);
  const counts = options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const totalVotes = counts.reduce((sum, c) => sum + c, 0);
  const totalRespondents =
    mode === 'free_text'
      ? votes.filter((v) => !!v.value).length
      : mode === 'ranking' || mode === 'quiz'
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
  const isScreenVisible = poll.status === 'active';
  const freeTextGroups = useMemo(() => normalizeFreeTextGroups(meta.freeTextGroups), [meta.freeTextGroups]);
  const freeTextVotes = mode === 'free_text' ? votes.filter((vote) => !!vote.value) : [];
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const rawGroups = meta.freeTextGroups || [];
    if (
      mode !== 'free_text' ||
      !onUpdateFreeTextGroups ||
      (rawGroups.length === freeTextGroups.length && rawGroups.every((group, index) => group === freeTextGroups[index]))
    ) {
      return;
    }
    void onUpdateFreeTextGroups(freeTextGroups);
  }, [freeTextGroups, meta.freeTextGroups, mode, onUpdateFreeTextGroups]);

  const addFreeTextGroup = async () => {
    const trimmed = newGroupLabel.trim().slice(0, 40);
    if (!trimmed || freeTextGroups.includes(trimmed) || !onUpdateFreeTextGroups) return;
    await onUpdateFreeTextGroups([...freeTextGroups, trimmed]);
    setNewGroupLabel('');
  };
  const renameFreeTextGroup = async (index: number, label: string) => {
    const current = freeTextGroups[index];
    const trimmed = label.trim().slice(0, 40);
    if (!trimmed || trimmed === current || !onUpdateFreeTextGroups) return;
    const next = freeTextGroups.map((group, i) => (i === index ? trimmed : group));
    await onUpdateFreeTextGroups(next);
    await Promise.all(
      freeTextVotes
        .filter((vote) => vote.group_label === current)
        .map((vote) => onArrangeFreeTextResponse?.(vote.id, { groupLabel: trimmed, displayX: null, displayY: null }))
    );
  };

  return (
    <div
      id={`poll-card-${poll.id}`}
      className={`overflow-hidden rounded-lg border bg-white transition-all ${
        editing
          ? mode === 'free_text'
            ? 'border-orange-500 shadow-sm shadow-orange-100'
            : 'border-[#2864f0] shadow-sm shadow-blue-100'
          : selected || isScreenVisible
            ? mode === 'free_text'
              ? 'border-orange-400 shadow-sm shadow-orange-100'
              : 'border-[#00963c] shadow-sm shadow-emerald-100'
            : mode === 'free_text'
              ? 'border-[#e9e7e7] hover:border-orange-200 hover:shadow-sm'
              : 'border-[#e9e7e7] hover:border-[#aac8ff] hover:shadow-sm'
      }`}
    >
      <div className="border-b border-[#e9e7e7] p-4">
        <div className="flex items-start gap-3">
          {onToggleSelect && !hideSelection && (
            <button
              type="button"
              onClick={onToggleSelect}
              disabled={isScreenVisible}
              className={`shrink-0 mt-1 inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] font-extrabold transition-colors ${
                isScreenVisible
                  ? 'cursor-not-allowed border-[#9dd8b1] bg-[#eaf8ef] text-[#00963c]'
                  : selected
                  ? 'border-[#00963c] bg-[#00963c] text-white'
                  : 'border-slate-300 bg-white text-transparent hover:border-[#00963c]'
              }`}
              title={
                isScreenVisible
                  ? 'スクリーン画面に表示中のカードは選択できません'
                  : selected
                  ? `選択 ${selectionNumber}（クリックで解除）`
                  : 'カードを選択'
              }
              aria-label={
                isScreenVisible
                  ? 'スクリーン画面に表示中'
                  : selected
                  ? `選択 ${selectionNumber}`
                  : 'カードを選択'
              }
              aria-pressed={selected}
            >
              {isScreenVisible ? (
                <Monitor className="h-3.5 w-3.5" />
              ) : selected ? (
                <span className="leading-none">{selectionNumber}</span>
              ) : (
                <Check className="h-3 w-3" />
              )}
            </button>
          )}
          <div className="flex shrink-0 flex-col items-center gap-4">
            <span
              className={`inline-flex h-11 w-11 items-center justify-center rounded-lg ring-1 ${visual.iconBg} ${visual.iconText} ${visual.iconRing}`}
              aria-hidden
            >
              <ModeIcon className="w-5 h-5" />
            </span>
            <select
              value={orderPosition}
              onChange={(e) => onMoveToPosition(Number(e.target.value))}
              className="h-7 w-11 rounded-md border border-[#e9e7e7] bg-white px-1 text-center text-xs font-extrabold tabular-nums text-[#323232] outline-none focus:border-[#9dd8b1]"
              title={`表示順を1〜${totalPollCount}から選択`}
              aria-label="カード番号"
            >
              {Array.from({ length: totalPollCount }, (_, i) => i + 1).map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`inline-flex items-center font-bold px-2 py-0.5 rounded-full ring-1 ${visual.badgeBg} ${visual.badgeText} ${visual.badgeRing}`}
              >
                {POLL_MODE_LABELS[mode]}
              </span>
              {poll.status === 'active' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  表示中
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
              {onDragStart && (
                <button
                  type="button"
                  draggable
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onPointerDown={onPointerReorderStart}
                  className="ml-auto inline-flex touch-none flex-col items-center justify-center rounded-md border border-[#e9e7e7] bg-white px-2 py-1 text-[#595959] cursor-grab select-none transition-colors hover:border-[#9dd8b1] hover:text-[#00963c] active:cursor-grabbing"
                  title="ドラッグして並び替え"
                  aria-label="ドラッグして並び替え"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold leading-none mt-0.5">並び替え</span>
                </button>
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

      {mode === 'free_text' && editing && (
        <div className="space-y-3 border-b border-[#e9e7e7] bg-orange-50/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold text-orange-800">ブレスト形式の分類</p>
            <span className="text-[11px] font-bold text-slate-500">
              回答 {freeTextVotes.length}件
            </span>
          </div>
          <div className="flex gap-2">
            <input
              value={newGroupLabel}
              onChange={(event) => setNewGroupLabel(event.target.value)}
              placeholder="分類を追加"
              className="h-9 min-w-0 flex-1 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-orange-300"
            />
            <button
              type="button"
              onClick={() => void addFreeTextGroup()}
              className="h-9 rounded-lg bg-orange-600 px-3 text-xs font-bold text-white hover:bg-orange-700 disabled:bg-slate-200"
              disabled={!newGroupLabel.trim() || !onUpdateFreeTextGroups}
            >
              追加
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {freeTextGroups.map((group, index) => (
              <input
                key={`${group}-${index}`}
                value={groupDrafts[index] ?? group}
                onChange={(event) => {
                  setGroupDrafts((prev) => ({ ...prev, [index]: event.target.value }));
                }}
                onBlur={(event) => void renameFreeTextGroup(index, event.target.value)}
                className="h-8 w-28 rounded-lg bg-white px-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 outline-none focus:ring-orange-300"
              />
            ))}
            {freeTextGroups.length === 0 && (
              <p className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-slate-400 ring-1 ring-slate-200">
                分類は未設定です。
              </p>
            )}
          </div>
        </div>
      )}

      {/* アクション行 */}
      <div className="flex flex-wrap items-center gap-1.5 bg-[#f7f5f5] px-4 py-3">
        {poll.status !== 'active' ? (
          <button
            type="button"
            disabled={isPending}
            onClick={onStart}
            className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 h-9 rounded-lg disabled:opacity-60 transition-colors"
            title="表示する"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5" />
                表示する
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
          label="ワーク機能"
          value={totalPolls}
          icon={<Hammer className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-50 ring-amber-100"
        />
      </div>

      {/* Status distribution */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-5">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3">Q&Aのステータス分布</h3>
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
