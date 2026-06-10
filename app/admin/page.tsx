'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  CopyPlus,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  Save,
  Loader2,
  Sparkles,
  BarChart3,
  Inbox,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Search,
  CheckCircle,
  Settings,
  Airplay,
  FileText,
  Globe,
  Users,
  ArrowRight,
  QrCode,
  Download,
  Play,
  StopCircle,
  Clock,
  ClipboardEdit,
  HelpCircle,
} from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CustomModal } from '@/components/ui/custom-modal';
import { motion } from 'framer-motion';
import Link from 'next/link';
import CustomFormManager from './components/CustomFormManager';
import InvitationFormManager from './components/InvitationFormManager';
import InvitationResponseList from './components/InvitationResponseList';
import AttendanceExport from './components/AttendanceExport';
import AdminShell, { type AdminSection } from './components/AdminShell';
import ManualAttendanceModal from './components/ManualAttendanceModal';

interface Course {
  id: string;
  code: string;
  courseName: string;
  teacherName: string;
  status?: string;
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
  isCustomForm?: boolean;
  customFields?: any[];
  enabledDefaultFields?: string[];
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
  formType?: string;
  invitationSettings?: any;
  cooldownMinutes?: number;
}

const COOLDOWN_MINUTE_OPTIONS = [0, 1, 3, 5, 10, 15, 30, 45, 60, 90, 120, 180, 360, 720, 1440];

function formatCooldownOption(minutes: number) {
  if (minutes <= 0) return 'なし';
  if (minutes < 60) return `${minutes}分`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}時間` : `${minutes}分`;
}

function getCooldownOptions(current: number | undefined) {
  const options = [...COOLDOWN_MINUTE_OPTIONS];
  if (
    typeof current === 'number' &&
    Number.isFinite(current) &&
    current >= 0 &&
    current <= 1440 &&
    !options.includes(current)
  ) {
    options.push(current);
  }
  return Array.from(new Set(options)).sort((a, b) => a - b);
}

type AdminColorTheme = {
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

const ADMIN_COLOR_THEMES: Record<'courses' | 'rooms' | 'export', AdminColorTheme> = {
  courses: {
    headerBg: '#ebf3ff',
    headerBorder: '#aac8ff',
    iconBg: '#dce8ff',
    iconBorder: '#aac8ff',
    accent: '#2864f0',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#23418c',
    infoBg: '#ebf3ff',
    infoBorder: '#aac8ff',
    infoText: '#23418c',
  },
  rooms: {
    headerBg: '#ebf3ff',
    headerBorder: '#aac8ff',
    iconBg: '#dce8ff',
    iconBorder: '#aac8ff',
    accent: '#2864f0',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#23418c',
    infoBg: '#ebf3ff',
    infoBorder: '#aac8ff',
    infoText: '#23418c',
  },
  export: {
    headerBg: '#ebf3ff',
    headerBorder: '#aac8ff',
    iconBg: '#dce8ff',
    iconBorder: '#aac8ff',
    accent: '#2864f0',
    titleText: '#323232',
    descriptionText: '#595959',
    strongText: '#23418c',
    infoBg: '#ebf3ff',
    infoBorder: '#aac8ff',
    infoText: '#23418c',
  },
};

function AdminPageHeader({
  title,
  description,
  icon: Icon,
  theme = ADMIN_COLOR_THEMES.courses,
  helpHref,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  theme?: AdminColorTheme;
  helpHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="border-b"
      style={{ backgroundColor: theme.headerBg, borderColor: theme.headerBorder }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
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
        {(children || helpHref) && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {children}
            {helpHref && (
              <Link
                href={helpHref}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#aac8ff] bg-white text-[#2864f0] transition-colors hover:bg-[#ebf3ff]"
                aria-label={`${title}のヘルプを開く`}
                title={`${title}のヘルプ`}
              >
                <HelpCircle className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminInfoCard({
  title,
  icon: Icon,
  theme = ADMIN_COLOR_THEMES.courses,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  theme?: AdminColorTheme;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="mb-5 w-full max-w-2xl rounded-lg border"
      style={{ backgroundColor: theme.infoBg, borderColor: theme.infoBorder }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span
          className="flex min-w-0 items-center gap-2 text-sm font-bold sm:text-base"
          style={{ color: theme.strongText }}
        >
          <span className="shrink-0" style={{ color: theme.accent }}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
        )}
      </button>
      {open && (
        <div
          className="border-t px-4 pb-4 pt-3"
          style={{ borderColor: theme.infoBorder, color: theme.infoText }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function AdminPageInner() {
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSection = (() => {
    const param = searchParams.get('section');
    if (param === 'export' || param === 'rooms' || param === 'courses') return param;
    return 'courses';
  })();
  const [activeTab, setActiveTab] = useState<'courses' | 'export' | 'rooms'>(initialSection);
  const CARDS_PER_PAGE = 6;
  const [coursePage, setCoursePage] = useState(1);
  const [roomPage, setRoomPage] = useState(1);
  const [courseSearch, setCourseSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const renderPagination = useCallback(
    (currentPage: number, totalPages: number, onChange: (page: number) => void) => {
      if (totalPages <= 1) return null;
      const pages: number[] = [];
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return (
        <div className="mt-5 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="前のページ"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === currentPage
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={`${p}ページ目`}
              aria-current={p === currentPage ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="次のページ"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      );
    },
    []
  );
  
  // フォーム管理用の状態
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  
  // 新規講義追加用の状態
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [newCourse, setNewCourse] = useState({
    courseName: '',
    teacherName: '',
    enableLocation: false,
    locationName: '',
    latitude: 33.1751332,
    longitude: 131.6138803,
    radius: 0.5,
    cooldownMinutes: 15,
  });
  const [savingNewCourse, setSavingNewCourse] = useState<boolean>(false);
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState<boolean>(false);
  const [locationResolved, setLocationResolved] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<'search' | 'gps'>('search');
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Google Places Autocomplete でサジェスト取得
  const fetchPlaceSuggestions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      );
      if (!response.ok) return;
      const data = await response.json();
      if (data.predictions && data.predictions.length > 0) {
        setPlaceSuggestions(data.predictions.map((p: { description: string; place_id: string }) => ({
          description: p.description,
          place_id: p.place_id,
        })));
        setShowSuggestions(true);
      } else {
        setPlaceSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setPlaceSuggestions([]);
    }
  }, []);

  // 場所を選択して緯度経度を取得
  const selectPlace = useCallback(async (placeId: string, description: string, target: 'new' | 'edit') => {
    setShowSuggestions(false);
    setEditShowSuggestions(false);
    setLocationError(null);
    setEditLocationError(null);
    try {
      const response = await fetch(
        `/api/places/details?place_id=${encodeURIComponent(placeId)}`
      );
      if (!response.ok) throw new Error('詳細取得に失敗');
      const data = await response.json();
      if (data.result?.geometry?.location) {
        const loc = data.result.geometry.location;
        if (target === 'new') {
          setNewCourse(prev => ({ ...prev, locationName: description, latitude: loc.lat, longitude: loc.lng }));
          setLocationResolved(true);
        } else {
          setEditCourse(prev => ({ ...prev, locationName: description, latitude: loc.lat, longitude: loc.lng }));
          setEditLocationResolved(true);
        }
      }
    } catch {
      if (target === 'new') setLocationError('場所の詳細取得に失敗しました。');
      else setEditLocationError('場所の詳細取得に失敗しました。');
    }
  }, []);

  // 現在地から緯度経度を自動取得
  const getCurrentLocationForCourse = (target: 'new' | 'edit') => {
    if (!navigator.geolocation) {
      const msg = 'このブラウザは位置情報をサポートしていません。';
      if (target === 'new') setLocationError(msg);
      else setEditLocationError(msg);
      return;
    }
    if (target === 'new') {
      setIsGettingCurrentLocation(true);
      setLocationError(null);
      setLocationResolved(false);
    } else {
      setIsEditGettingLocation(true);
      setEditLocationError(null);
      setEditLocationResolved(false);
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (target === 'new') {
          setNewCourse(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setLocationResolved(true);
          setIsGettingCurrentLocation(false);
        } else {
          setEditCourse(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setEditLocationResolved(true);
          setIsEditGettingLocation(false);
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: '位置情報の使用が拒否されました。ブラウザの設定を確認してください。',
          2: '位置情報が利用できません。',
          3: '位置情報の取得がタイムアウトしました。',
        };
        const msg = messages[error.code] || '位置情報の取得に失敗しました。';
        if (target === 'new') { setIsGettingCurrentLocation(false); setLocationError(msg); }
        else { setIsEditGettingLocation(false); setEditLocationError(msg); }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // カスタムフォーム設定用の状態を追加
  const [isCustomFormDialogOpen, setIsCustomFormDialogOpen] = useState<boolean>(false);
  const [editingCustomFormCourse, setEditingCustomFormCourse] = useState<Course | null>(null);

  // 編集用の状態
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  // 手動入力モーダル
  const [manualEntryCourse, setManualEntryCourse] = useState<Course | null>(null);
  const [editCourse, setEditCourse] = useState({
    courseName: '',
    teacherName: '',
    enableLocation: false,
    locationName: '',
    latitude: 0,
    longitude: 0,
    radius: 0.5,
    cooldownMinutes: 15,
  });
  const [savingEditCourse, setSavingEditCourse] = useState<boolean>(false);
  const [editLocationResolved, setEditLocationResolved] = useState<boolean>(false);
  const [editLocationError, setEditLocationError] = useState<string | null>(null);
  const [isEditGettingLocation, setIsEditGettingLocation] = useState<boolean>(false);
  const [editLocationMode, setEditLocationMode] = useState<'search' | 'gps'>('search');
  const [editPlaceSuggestions, setEditPlaceSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [editShowSuggestions, setEditShowSuggestions] = useState(false);
  const editSearchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // QRコードモーダル用の状態
  const [isQrDialogOpen, setIsQrDialogOpen] = useState<boolean>(false);
  const [qrCourse, setQrCourse] = useState<Course | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // 作成タイプ選択モーダル
  const [isCreateTypeDialogOpen, setIsCreateTypeDialogOpen] = useState<boolean>(false);

  // 招待フォーム用の状態
  const [isInvitationFormDialogOpen, setIsInvitationFormDialogOpen] = useState<boolean>(false);
  const [editingInvitationFormCourse, setEditingInvitationFormCourse] = useState<Course | null>(null);
  const [isResponseListDialogOpen, setIsResponseListDialogOpen] = useState<boolean>(false);
  const [responseListCourse, setResponseListCourse] = useState<Course | null>(null);

  // ルーム管理用の状態
  interface Room { id: string; code: string; title: string; status: string; host_id: string; created_at: string; }
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [isCreateRoomDialogOpen, setIsCreateRoomDialogOpen] = useState<boolean>(false);
  const [newRoomTitle, setNewRoomTitle] = useState<string>('');
  const [creatingRoom, setCreatingRoom] = useState<boolean>(false);
  const [isEditRoomDialogOpen, setIsEditRoomDialogOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomTitle, setEditRoomTitle] = useState<string>('');
  const [savingEditRoom, setSavingEditRoom] = useState<boolean>(false);
  const [roomStatusPendingCode, setRoomStatusPendingCode] = useState<string | null>(null);
  const [courseStatusPendingCode, setCourseStatusPendingCode] = useState<string | null>(null);
  const [copyPendingCode, setCopyPendingCode] = useState<string | null>(null);
  const [viewPendingCode, setViewPendingCode] = useState<string | null>(null);
  const [hostPendingCode, setHostPendingCode] = useState<string | null>(null);
  const [duplicatePendingCode, setDuplicatePendingCode] = useState<string | null>(null);

  // 削除確認モーダル用の状態
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'course' | 'room';
    code: string;
    name: string;
    room?: Room;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);


  // トースト表示を1秒間に設定
  const showToast = useCallback((title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant,
      duration: 1000,
    });
  }, [toast]);

  // サブスクリプション情報の状態
  const [planInfo, setPlanInfo] = useState<{
    subscription: {
      plan: 'free' | 'paid' | 'enterprise';
      status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
      currentPeriodEnd?: string;
    };
    usage: { formCount: number; roomCount: number };
    limits: { maxForms: number; maxRooms: number };
    canCreateForm: boolean;
    canCreateRoom: boolean;
  } | null>(null);

  // サブスクリプション情報を取得
  const fetchPlanInfo = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/subscription');
      if (response.ok) {
        const data = await response.json();
        setPlanInfo(data);
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch plan info:', error);
    }
    return null;
  }, []);

  const currentPeriodEndLabel = planInfo?.subscription.currentPeriodEnd
    ? new Date(planInfo.subscription.currentPeriodEnd).toLocaleDateString('ja-JP')
    : null;

  // カスタムフォームダイアログを開く（上限チェック付き）
  const handleCustomFormDialog = () => {
    if (planInfo && !planInfo.canCreateForm) {
      showToast('上限に達しています', `無料プランではフォーム${planInfo.limits.maxForms}個まで作成できます。Proプランにアップグレードしてください。`, 'destructive');
      return;
    }
    setIsCustomFormDialogOpen(true);
  };

  // 招待フォームダイアログを開く（上限チェック付き）
  const handleInvitationFormDialog = () => {
    if (planInfo && !planInfo.canCreateForm) {
      showToast('上限に達しています', `無料プランではフォーム${planInfo.limits.maxForms}個まで作成できます。Proプランにアップグレードしてください。`, 'destructive');
      return;
    }
    setEditingInvitationFormCourse(null);
    setIsInvitationFormDialogOpen(true);
  };

  // 回答一覧を表示
  const handleShowResponses = (course: Course) => {
    setResponseListCourse(course);
    setIsResponseListDialogOpen(true);
  };

  // ルーム一覧取得
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const response = await fetch('/api/rooms');
      if (response.ok) {
        const data = await response.json();
        setRooms(Array.isArray(data) ? data : data.rooms || []);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  // 講義一覧の取得（Supabase v2 API）
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const response = await fetch('/api/v2/courses?teacher_email=self');
      if (response.ok) {
        const data = await response.json();
        // Supabase v2 APIのレスポンスをフロントエンドの形式にマッピング
        const mappedCourses: Course[] = (data.courses || []).map((c: any) => ({
          id: c.id,
          code: c.code,
          courseName: c.name,
          teacherName: c.teacher_name,
          status: c.status || 'active',
          createdBy: '',
          createdAt: c.created_at || '',
          lastUpdated: c.created_at || '',
          isCustomForm: (c.custom_fields && c.custom_fields.length > 0) ||
            (c.enabled_default_fields && Array.isArray(c.enabled_default_fields) &&
              c.enabled_default_fields.length > 0 &&
              c.enabled_default_fields.length !== 7) || false,
          customFields: c.custom_fields || [],
          enabledDefaultFields: c.enabled_default_fields || [],
          locationSettings: c.location_settings || undefined,
          formType: c.form_type || 'attendance',
          invitationSettings: c.invitation_settings || undefined,
          cooldownMinutes: typeof c.cooldown_minutes === 'number' ? c.cooldown_minutes : 15,
        }));
        setCourses(mappedCourses);
        if (mappedCourses.length > 0) {
          showToast("データ更新", `${mappedCourses.length}件のフォームを読み込みました。`);
        }
      } else {
        const errorData = await response.json();
        showToast("読み込みエラー", errorData.message || "フォーム情報の読み込みに失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setLoadingCourses(false);
    }
  }, [showToast]);


  // 認証チェック
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // 初期データ取得
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCourses();
      fetchRooms();
      fetchPlanInfo();
    }
  }, [status, fetchCourses, fetchRooms, fetchPlanInfo]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => {
      const typeLabel =
        course.formType === 'invitation'
          ? '招待フォーム 招待状 invitation'
          : course.isCustomForm
          ? 'カスタムフォーム custom'
          : '出席フォーム attendance';
      return [
        course.courseName,
        course.teacherName,
        course.code,
        typeLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [courseSearch, courses]);

  const filteredRooms = useMemo(() => {
    const query = roomSearch.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) =>
      [room.title, room.code, room.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [roomSearch, rooms]);

  // ページネーション：データ件数変化時に範囲外なら調整
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredCourses.length / CARDS_PER_PAGE));
    if (coursePage > totalPages) setCoursePage(totalPages);
  }, [filteredCourses.length, coursePage]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRooms.length / CARDS_PER_PAGE));
    if (roomPage > totalPages) setRoomPage(totalPages);
  }, [filteredRooms.length, roomPage]);

  useEffect(() => {
    setCoursePage(1);
  }, [courseSearch]);

  useEffect(() => {
    setRoomPage(1);
  }, [roomSearch]);

  // 決済結果の処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
      showToast('決済完了', 'Proプランへのアップグレードが完了しました！', 'default');
      const refreshPlanInfo = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const latestPlanInfo = await fetchPlanInfo();
          if (latestPlanInfo?.subscription?.plan !== 'free') {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      };

      refreshPlanInfo();
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      showToast('決済キャンセル', '決済がキャンセルされました', 'destructive');
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchPlanInfo, showToast]);

  // ローディング表示
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // 認証されていない場合
  if (!session) {
    return null;
  }

  // 新規講義の追加（Supabase v2 API）
  const handleAddCourse = async () => {
    if (!newCourse.courseName.trim() || !newCourse.teacherName.trim()) {
      showToast("入力エラー", "すべての必須項目を入力してください。", "destructive");
      return;
    }

    setSavingNewCourse(true);
    try {
      const response = await fetch('/api/v2/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCourse.courseName.trim(),
          teacherName: newCourse.teacherName.trim(),
          cooldownMinutes: Math.max(0, Math.min(1440, Math.floor(Number(newCourse.cooldownMinutes) || 0))),
          ...(newCourse.enableLocation ? {
            locationSettings: {
              latitude: newCourse.latitude,
              longitude: newCourse.longitude,
              radius: newCourse.radius,
              locationName: newCourse.locationName.trim() || undefined,
            }
          } : {}),
        }),
      });

      if (response.ok) {
        showToast("作成完了", "新しい出席フォームを作成しました。");
        setIsAddDialogOpen(false);
        setNewCourse({ courseName: '', teacherName: '', enableLocation: false, locationName: '', latitude: 33.1751332, longitude: 131.6138803, radius: 0.5, cooldownMinutes: 15 });
        setLocationResolved(false);
        setLocationError(null);
        await fetchCourses(); fetchPlanInfo();
      } else {
        const errorData = await response.json();
        showToast("追加失敗", errorData.message || "フォームの作成に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to add course:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setSavingNewCourse(false);
    }
  };

  // 編集ダイアログを開く
  const handleEditCourse = (course: Course) => {
    if (course.formType === 'invitation') {
      // 招待フォームの場合はInvitationFormManagerを編集モードで開く
      setEditingInvitationFormCourse(course);
      setIsInvitationFormDialogOpen(true);
      return;
    }
    if (course.isCustomForm) {
      // カスタムフォームの場合はCustomFormManagerを編集モードで開く
      setEditingCustomFormCourse(course);
      setIsCustomFormDialogOpen(true);
      return;
    }
    // 出席フォームの場合は従来の編集ダイアログ
    setEditingCourse(course);
    const hasLocation = !!course.locationSettings;
    setEditCourse({
      courseName: course.courseName,
      teacherName: course.teacherName,
      enableLocation: hasLocation,
      locationName: course.locationSettings?.locationName || '',
      latitude: course.locationSettings?.latitude || 0,
      longitude: course.locationSettings?.longitude || 0,
      radius: course.locationSettings?.radius || 0.5,
      cooldownMinutes: typeof course.cooldownMinutes === 'number' ? course.cooldownMinutes : 15,
    });
    setEditLocationResolved(hasLocation);
    setEditLocationError(null);
    setIsEditDialogOpen(true);
  };

  // 講義の編集（Supabase v2 API）
  const handleUpdateCourse = async () => {
    if (!editingCourse || !editCourse.courseName.trim() || !editCourse.teacherName.trim()) {
      showToast("入力エラー", "すべての必須項目を入力してください。", "destructive");
      return;
    }

    setSavingEditCourse(true);
    try {
      const response = await fetch(`/api/v2/courses/${editingCourse.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCourse.courseName.trim(),
          teacher_name: editCourse.teacherName.trim(),
          cooldown_minutes: Math.max(0, Math.min(1440, Math.floor(Number(editCourse.cooldownMinutes) || 0))),
          location_settings: editCourse.enableLocation ? {
            latitude: editCourse.latitude,
            longitude: editCourse.longitude,
            radius: editCourse.radius,
            locationName: editCourse.locationName.trim() || undefined,
          } : null,
        }),
      });

      if (response.ok) {
        showToast("更新完了", "フォーム情報を更新しました。");
        setIsEditDialogOpen(false);
        setEditingCourse(null);
        setEditCourse({ courseName: '', teacherName: '', enableLocation: false, locationName: '', latitude: 0, longitude: 0, radius: 0.5, cooldownMinutes: 15 });
        setEditLocationResolved(false);
        setEditLocationError(null);
        await fetchCourses(); fetchPlanInfo();
      } else {
        const errorData = await response.json();
        showToast("更新失敗", errorData.message || "フォームの更新に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to update course:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setSavingEditCourse(false);
    }
  };

  const handleToggleCourseStatus = async (course: Course) => {
    if (courseStatusPendingCode) return;
    const nextStatus = course.status === 'active' ? 'archived' : 'active';
    setCourseStatusPendingCode(course.code);
    try {
      const response = await fetch(`/api/v2/courses/${course.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        showToast(
          '更新完了',
          nextStatus === 'active' ? 'フォーム受付を開始しました。' : 'フォーム受付を終了しました。'
        );
        await fetchCourses();
      } else {
        const errorData = await response.json().catch(() => null);
        showToast(
          '更新失敗',
          errorData?.error || errorData?.message || 'フォーム受付状態の変更に失敗しました。',
          'destructive'
        );
      }
    } catch {
      showToast('通信エラー', 'フォーム受付状態の変更中にエラーが発生しました。', 'destructive');
    } finally {
      setCourseStatusPendingCode(null);
    }
  };

  // 講義の削除（Supabase v2 API - 物理削除）
  const handleDeleteCourse = (courseCode: string, courseName: string) => {
    setDeleteConfirm({ type: 'course', code: courseCode, name: courseName });
  };

  // 削除確認モーダルから実行
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'course') {
        const response = await fetch(`/api/v2/courses/${deleteConfirm.code}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showToast("削除完了", "フォームを削除しました。");
          await fetchCourses(); fetchPlanInfo();
        } else {
          const errorData = await response.json();
          showToast("削除失敗", errorData.message || "フォームの削除に失敗しました。", "destructive");
        }
      } else if (deleteConfirm.type === 'room') {
        const response = await fetch(`/api/rooms/${deleteConfirm.code}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showToast("削除完了", "ルームを削除しました。");
          await fetchRooms(); fetchPlanInfo();
        } else {
          showToast("削除失敗", "ルームの削除に失敗しました。", "destructive");
        }
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // ルーム作成
  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;
    setCreatingRoom(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newRoomTitle.trim() }),
      });
      if (response.ok) {
        showToast("作成完了", "ルームを作成しました。");
        setNewRoomTitle('');
        setIsCreateRoomDialogOpen(false);
        await fetchRooms(); fetchPlanInfo();
      } else {
        const err = await response.json();
        if (err.code === 'PLAN_LIMIT_EXCEEDED') {
          showToast("上限に達しています", err.error, "destructive");
        } else {
          showToast("作成失敗", err.error || "ルームの作成に失敗しました。", "destructive");
        }
      }
    } catch {
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setCreatingRoom(false);
    }
  };

  // ルームURLをコピー
  const copyRoomUrl = async (code: string, title: string) => {
    if (copyPendingCode) return;
    setCopyPendingCode(code);
    try {
      const url = `${window.location.origin}/rooms/${code}`;
      await navigator.clipboard.writeText(url);
      showToast("コピー完了", `${title}のルームURLをコピーしました。`);
    } catch {
      showToast("コピー失敗", "URLのコピーに失敗しました。", "destructive");
    } finally {
      setCopyPendingCode(null);
    }
  };

  // 参加者ビューへ遷移
  const handleOpenParticipantView = (code: string) => {
    if (viewPendingCode) return;
    setViewPendingCode(code);
    router.push(`/rooms/${code}`);
  };

  // ホスト管理画面へ遷移
  const handleOpenHostView = (code: string, withExportTab = false) => {
    if (hostPendingCode) return;
    setHostPendingCode(code);
    router.push(withExportTab ? `/rooms/${code}/host?tab=export` : `/rooms/${code}/host`);
  };

  // ルーム編集ダイアログを開く
  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setEditRoomTitle(room.title);
    setIsEditRoomDialogOpen(true);
  };

  // ルーム更新
  const handleUpdateRoom = async () => {
    if (!editingRoom || !editRoomTitle.trim()) return;
    setSavingEditRoom(true);
    try {
      const response = await fetch(`/api/rooms/${editingRoom.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editRoomTitle.trim() }),
      });
      if (response.ok) {
        showToast("更新完了", "ルーム情報を更新しました。");
        setIsEditRoomDialogOpen(false);
        setEditingRoom(null);
        await fetchRooms();
      } else {
        showToast("更新失敗", "ルームの更新に失敗しました。", "destructive");
      }
    } catch {
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setSavingEditRoom(false);
    }
  };

  // ルーム削除
  const handleDeleteRoom = (room: Room) => {
    setDeleteConfirm({ type: 'room', code: room.code, name: room.title, room });
  };

  // ルーム複製（ワーク構成を引き継ぎ、票・質問・実施履歴は引き継がない）
  const handleDuplicateRoom = async (room: Room) => {
    setDuplicatePendingCode(room.code);
    try {
      const res = await fetch(`/api/rooms/${room.code}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('複製完了', `「${data.room?.title || room.title}」を作成しました。`);
        await fetchRooms();
        fetchPlanInfo();
      } else {
        showToast('複製失敗', data.error || 'ルームの複製に失敗しました。', 'destructive');
      }
    } catch {
      showToast('通信エラー', 'サーバーとの通信中にエラーが発生しました。', 'destructive');
    } finally {
      setDuplicatePendingCode(null);
    }
  };

  // フォーム複製（カスタム項目・位置情報・クールダウン設定を引き継ぐ）
  const handleDuplicateCourse = async (course: Course) => {
    setDuplicatePendingCode(course.code);
    try {
      const res = await fetch(`/api/v2/courses/${course.code}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('複製完了', `「${data.course?.name || course.courseName}」を作成しました。`);
        await fetchCourses();
        fetchPlanInfo();
      } else {
        showToast('複製失敗', data.message || 'フォームの複製に失敗しました。', 'destructive');
      }
    } catch {
      showToast('通信エラー', 'サーバーとの通信中にエラーが発生しました。', 'destructive');
    } finally {
      setDuplicatePendingCode(null);
    }
  };

  // Copy URL helper
  const copyFormUrl = async (url: string, courseName: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("コピー完了", `${courseName}のフォームURLをコピーしました。`);
    } catch (error) {
      showToast("コピー失敗", "URLのコピーに失敗しました。", "destructive");
    }
  };

  // QRコード表示
  const handleShowQr = async (course: Course) => {
    setQrCourse(course);
    setIsQrDialogOpen(true);
    const basePath = course.formType === 'invitation' ? '/invitation/' : '/attendance/';
    const url = `${window.location.origin}${basePath}${course.code}`;
    try {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      setQrDataUrl(dataUrl);
    } catch {
      showToast("エラー", "QRコードの生成に失敗しました。", "destructive");
    }
  };

  // QRコードダウンロード
  const handleDownloadQr = () => {
    if (!qrDataUrl || !qrCourse) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qr-${qrCourse.code}.png`;
    link.click();
  };

  const activeSection: AdminSection = activeTab;

  return (
    <AdminShell
      activeSection={activeSection}
      planInfo={planInfo}
      formCount={courses.length}
      roomCount={rooms.length}
      onSelectInPageSection={(section) => setActiveTab(section)}
    >
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'courses' | 'export' | 'rooms')} className="w-full">
          {/* ===== COURSES TAB ===== */}
          <TabsContent value="courses" className="mt-0">
            <AdminPageHeader
              title="フォーム管理"
              description={
                courses.length > 0
                  ? `${courses.length} 件のフォームを管理中`
                  : 'フォーム（出席管理、招待状）を作成して始めましょう'
              }
              icon={BookOpen}
              theme={ADMIN_COLOR_THEMES.courses}
              helpHref="/admin/faq#forms"
            >
                {/* プランバッジ */}
                {planInfo && (
                  <div className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold ${
                    planInfo.subscription.plan === 'enterprise'
                      ? 'bg-slate-800 text-white'
                      : planInfo.subscription.plan === 'paid'
                        ? 'bg-[#dce8ff] text-[#23418c]'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {planInfo.subscription.plan === 'enterprise' ? '✦ Enterprise' : planInfo.subscription.plan === 'paid' ? '✦ Pro' : 'Free'}
                    <span className="text-[10px] opacity-70">
                      {planInfo.usage.formCount}/{planInfo.limits.maxForms === Infinity ? '∞' : planInfo.limits.maxForms}
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchCourses}
                  disabled={loadingCourses}
                  className="h-9 rounded-md border-[#e1dcdc] bg-white px-3 text-[#595959]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingCourses ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Button
                  onClick={() => setIsCreateTypeDialogOpen(true)}
                  className="h-9 rounded-md bg-[#2864f0] px-4 text-white shadow-sm hover:bg-[#285ac8]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  新規作成
                </Button>
                {planInfo && planInfo.subscription.plan === 'free' && !planInfo.canCreateForm && (
                  <Button
                    asChild
                    className="h-9 rounded-md bg-[#2864f0] px-4 text-white shadow-sm hover:bg-[#285ac8]"
                  >
                    <Link href="/admin/account">
                      Proにアップグレード
                    </Link>
                  </Button>
                )}
            </AdminPageHeader>

            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-2xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8989]" />
                <Input
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="フォーム名・担当者・コードで検索"
                  className="h-9 rounded-md border-[#cccccc] bg-white pl-9 text-sm"
                />
              </div>
              {courseSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setCourseSearch('')}
                  className="self-start text-xs font-bold text-[#2864f0] hover:text-[#285ac8] sm:self-auto"
                >
                  クリア
                </button>
              )}
            </div>

            {/* Add Course Modal */}
            <CustomModal
              isOpen={isAddDialogOpen}
              onClose={() => setIsAddDialogOpen(false)}
              title="出席フォーム作成"
              description="標準の項目が含まれたフォームを作成します。位置情報制限も設定できます。"
              className="sm:max-w-[520px]"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="course-name" className="text-sm font-medium text-slate-700">フォーム名 <span className="text-red-500">*</span></Label>
                  <Input
                    id="course-name"
                    placeholder="例: 経済学1"
                    value={newCourse.courseName}
                    onChange={(e) => setNewCourse({...newCourse, courseName: e.target.value})}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="teacher-name" className="text-sm font-medium text-slate-700">担当教員名 <span className="text-red-500">*</span></Label>
                  <Input
                    id="teacher-name"
                    placeholder="例: 田中太郎"
                    value={newCourse.teacherName}
                    onChange={(e) => setNewCourse({...newCourse, teacherName: e.target.value})}
                    className="h-10"
                  />
                </div>

                {/* 位置情報設定トグル */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !newCourse.enableLocation;
                      setNewCourse({...newCourse, enableLocation: next});
                      if (!next) {
                        setLocationResolved(false);
                        setLocationError(null);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">位置情報制限を設定</span>
                      <span className="text-xs text-slate-400">（任意）</span>
                    </div>
                    {newCourse.enableLocation ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {newCourse.enableLocation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 py-3 space-y-3 border-t border-slate-200"
                    >
                      {/* モード切替タブ */}
                      <div className="flex rounded-lg bg-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => { setLocationMode('search'); setLocationResolved(false); setLocationError(null); setNewCourse(prev => ({...prev, locationName: '', latitude: 0, longitude: 0})); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${locationMode === 'search' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Search className="h-3.5 w-3.5" />
                          場所を検索
                        </button>
                        <button
                          type="button"
                          onClick={() => { setLocationMode('gps'); setLocationResolved(false); setLocationError(null); setPlaceSuggestions([]); setShowSuggestions(false); setNewCourse(prev => ({...prev, locationName: '', latitude: 0, longitude: 0})); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${locationMode === 'gps' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          端末の現在地
                        </button>
                      </div>

                      {/* 場所検索モード */}
                      {locationMode === 'search' && (
                        <div className="space-y-1.5 relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                              placeholder="場所を検索（例: 大分大学）"
                              value={newCourse.locationName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewCourse({...newCourse, locationName: val});
                                setLocationResolved(false);
                                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                                searchDebounceRef.current = setTimeout(() => fetchPlaceSuggestions(val), 300);
                              }}
                              onFocus={() => { if (placeSuggestions.length > 0) setShowSuggestions(true); }}
                              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                              className="h-9 text-sm pl-9"
                            />
                          </div>
                          {showSuggestions && placeSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                              {placeSuggestions.map((s) => (
                                <button
                                  key={s.place_id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex items-start gap-2 border-b border-slate-100 last:border-0 transition-colors"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectPlace(s.place_id, s.description, 'new')}
                                >
                                  <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                                  <span className="text-slate-700">{s.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 現在地モード */}
                      {locationMode === 'gps' && (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => getCurrentLocationForCourse('new')}
                            disabled={isGettingCurrentLocation || locationResolved}
                            className="w-full h-10 text-sm border-dashed"
                          >
                            {isGettingCurrentLocation ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : locationResolved ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                            ) : (
                              <Navigation className="h-4 w-4 mr-2" />
                            )}
                            {isGettingCurrentLocation ? '位置情報を取得中...' : locationResolved ? '現在地を取得しました' : '現在地を取得する'}
                          </Button>
                          {!locationResolved && !isGettingCurrentLocation && (
                            <p className="text-xs text-slate-400 text-center">ブラウザの位置情報許可が必要です</p>
                          )}
                        </div>
                      )}

                      {/* ステータス表示 */}
                      {locationResolved && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>位置情報を設定しました{locationMode === 'search' && newCourse.locationName ? `（${newCourse.locationName}）` : ''}</span>
                        </div>
                      )}
                      {locationError && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{locationError}</p>
                      )}

                      {/* 許可範囲 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">許可範囲（km）</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          value={newCourse.radius}
                          onChange={(e) => setNewCourse({...newCourse, radius: parseFloat(e.target.value) || 0.5})}
                          className="h-9 text-sm"
                        />
                        <p className="text-xs text-slate-400">指定場所から半径{newCourse.radius}km以内で出席可能</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 送信クールダウン */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">送信クールダウン</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={newCourse.cooldownMinutes}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setNewCourse({ ...newCourse, cooldownMinutes: Number.isFinite(n) ? n : 15 });
                        }}
                        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {getCooldownOptions(newCourse.cooldownMinutes).map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatCooldownOption(minutes)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    {newCourse.cooldownMinutes > 0
                      ? `同一端末からの連続送信を ${newCourse.cooldownMinutes} 分間ブロックします（デフォルト: 15分）。`
                      : 'クールダウンなし。同一端末からの連続送信を許可します。'}
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="h-9 w-full sm:w-auto">
                    キャンセル
                  </Button>
                  <Button onClick={handleAddCourse} disabled={savingNewCourse} className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                    {savingNewCourse ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        追加中...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        追加する
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CustomModal>

            {/* Edit Course Modal */}
            <CustomModal
              isOpen={isEditDialogOpen}
              onClose={() => setIsEditDialogOpen(false)}
              title="フォームを編集"
              description="フォーム情報と位置情報制限を更新します。"
              className="sm:max-w-[520px]"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-course-name" className="text-sm font-medium text-slate-700">フォーム名 <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-course-name"
                    placeholder="例: 経済学1"
                    value={editCourse.courseName}
                    onChange={(e) => setEditCourse({...editCourse, courseName: e.target.value})}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-teacher-name" className="text-sm font-medium text-slate-700">担当教員名 <span className="text-red-500">*</span></Label>
                  <Input
                    id="edit-teacher-name"
                    placeholder="例: 田中太郎"
                    value={editCourse.teacherName}
                    onChange={(e) => setEditCourse({...editCourse, teacherName: e.target.value})}
                    className="h-10"
                  />
                </div>

                {/* 位置情報設定トグル（編集用） */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !editCourse.enableLocation;
                      setEditCourse({...editCourse, enableLocation: next});
                      if (!next) {
                        setEditLocationResolved(false);
                        setEditLocationError(null);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">位置情報制限を設定</span>
                      {editCourse.enableLocation && editLocationResolved && (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">設定済み</span>
                      )}
                    </div>
                    {editCourse.enableLocation ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {editCourse.enableLocation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 py-3 space-y-3 border-t border-slate-200"
                    >
                      {/* モード切替タブ */}
                      <div className="flex rounded-lg bg-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => { setEditLocationMode('search'); setEditLocationResolved(false); setEditLocationError(null); setEditCourse(prev => ({...prev, locationName: '', latitude: 0, longitude: 0})); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${editLocationMode === 'search' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Search className="h-3.5 w-3.5" />
                          場所を検索
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditLocationMode('gps'); setEditLocationResolved(false); setEditLocationError(null); setEditPlaceSuggestions([]); setEditShowSuggestions(false); setEditCourse(prev => ({...prev, locationName: '', latitude: 0, longitude: 0})); }}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${editLocationMode === 'gps' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          端末の現在地
                        </button>
                      </div>

                      {/* 場所検索モード */}
                      {editLocationMode === 'search' && (
                        <div className="space-y-1.5 relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                              placeholder="場所を検索（例: 大分大学）"
                              value={editCourse.locationName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCourse({...editCourse, locationName: val});
                                setEditLocationResolved(false);
                                if (editSearchDebounceRef.current) clearTimeout(editSearchDebounceRef.current);
                                editSearchDebounceRef.current = setTimeout(() => {
                                  if (!val.trim() || val.length < 2) { setEditPlaceSuggestions([]); setEditShowSuggestions(false); return; }
                                  fetch(`/api/places/autocomplete?input=${encodeURIComponent(val)}`)
                                    .then(r => r.json())
                                    .then(data => {
                                      if (data.predictions?.length > 0) {
                                        setEditPlaceSuggestions(data.predictions.map((p: { description: string; place_id: string }) => ({ description: p.description, place_id: p.place_id })));
                                        setEditShowSuggestions(true);
                                      } else { setEditPlaceSuggestions([]); setEditShowSuggestions(false); }
                                    })
                                    .catch(() => setEditPlaceSuggestions([]));
                                }, 300);
                              }}
                              onFocus={() => { if (editPlaceSuggestions.length > 0) setEditShowSuggestions(true); }}
                              onBlur={() => setTimeout(() => setEditShowSuggestions(false), 200)}
                              className="h-9 text-sm pl-9"
                            />
                          </div>
                          {editShowSuggestions && editPlaceSuggestions.length > 0 && (
                            <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                              {editPlaceSuggestions.map((s) => (
                                <button
                                  key={s.place_id}
                                  type="button"
                                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex items-start gap-2 border-b border-slate-100 last:border-0 transition-colors"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectPlace(s.place_id, s.description, 'edit')}
                                >
                                  <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                                  <span className="text-slate-700">{s.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 現在地モード */}
                      {editLocationMode === 'gps' && (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => getCurrentLocationForCourse('edit')}
                            disabled={isEditGettingLocation || editLocationResolved}
                            className="w-full h-10 text-sm border-dashed"
                          >
                            {isEditGettingLocation ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : editLocationResolved ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                            ) : (
                              <Navigation className="h-4 w-4 mr-2" />
                            )}
                            {isEditGettingLocation ? '位置情報を取得中...' : editLocationResolved ? '現在地を取得しました' : '現在地を取得する'}
                          </Button>
                          {!editLocationResolved && !isEditGettingLocation && (
                            <p className="text-xs text-slate-400 text-center">ブラウザの位置情報許可が必要です</p>
                          )}
                        </div>
                      )}

                      {/* ステータス表示 */}
                      {editLocationResolved && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>位置情報を設定しました{editLocationMode === 'search' && editCourse.locationName ? `（${editCourse.locationName}）` : ''}</span>
                        </div>
                      )}
                      {editLocationError && (
                        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{editLocationError}</p>
                      )}

                      {/* 許可範囲 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-600">許可範囲（km）</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          value={editCourse.radius}
                          onChange={(e) => setEditCourse({...editCourse, radius: parseFloat(e.target.value) || 0.5})}
                          className="h-9 text-sm"
                        />
                        <p className="text-xs text-slate-400">指定場所から半径{editCourse.radius}km以内で出席可能</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 送信クールダウン */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">送信クールダウン</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={editCourse.cooldownMinutes}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setEditCourse({ ...editCourse, cooldownMinutes: Number.isFinite(n) ? n : 15 });
                        }}
                        className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {getCooldownOptions(editCourse.cooldownMinutes).map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {formatCooldownOption(minutes)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    {editCourse.cooldownMinutes > 0
                      ? `同一端末からの連続送信を ${editCourse.cooldownMinutes} 分間ブロックします（デフォルト: 15分）。`
                      : 'クールダウンなし。同一端末からの連続送信を許可します。'}
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="h-9 w-full sm:w-auto">
                    キャンセル
                  </Button>
                  <Button onClick={handleUpdateCourse} disabled={savingEditCourse} className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                    {savingEditCourse ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        更新中...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        更新する
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CustomModal>

            {/* Custom Form Modal */}
            <CustomModal
              isOpen={isCustomFormDialogOpen}
              onClose={() => { setIsCustomFormDialogOpen(false); setEditingCustomFormCourse(null); }}
              title={editingCustomFormCourse ? "カスタムフォーム編集" : "カスタムフォーム設定"}
              description={editingCustomFormCourse ? "フォームの項目・設定を編集できます。" : "出席フォームの項目をカスタマイズできます。デフォルト項目の有効/無効化や、独自の項目を追加できます。"}
              className="sm:max-w-[800px] max-h-[90vh]"
            >
              <CustomFormManager
                onCourseAdded={() => { fetchCourses(); fetchPlanInfo(); }}
                onClose={() => { setIsCustomFormDialogOpen(false); setEditingCustomFormCourse(null); }}
                editingCourse={editingCustomFormCourse || undefined}
              />
            </CustomModal>

            {/* Create Type Choice Modal */}
            <CustomModal
              isOpen={isCreateTypeDialogOpen}
              onClose={() => setIsCreateTypeDialogOpen(false)}
              title="フォームのタイプを選択"
              description="作成するフォームのタイプを選んでください。"
              className="sm:max-w-[640px]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 出席フォーム */}
                <button
                  onClick={() => {
                    setIsCreateTypeDialogOpen(false);
                    if (planInfo && !planInfo.canCreateForm) {
                      showToast('上限に達しています', `無料プランではフォーム${planInfo.limits.maxForms}個まで作成できます。Proプランにアップグレードしてください。`, 'destructive');
                      return;
                    }
                    setIsAddDialogOpen(true);
                  }}
                  className="group relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">出席フォーム</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      標準の出席項目が含まれたフォーム。すぐに使い始められます。
                    </p>
                  </div>
                  <ArrowRight className="absolute top-5 right-4 h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </button>

                {/* カスタムフォーム */}
                <button
                  onClick={() => {
                    setIsCreateTypeDialogOpen(false);
                    handleCustomFormDialog();
                  }}
                  className="group relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-purple-400 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">カスタムフォーム</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      項目を自由にカスタマイズ。独自のフォームを作成できます。
                    </p>
                  </div>
                  <ArrowRight className="absolute top-5 right-4 h-4 w-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
                </button>

                {/* 招待フォーム */}
                <button
                  onClick={() => {
                    setIsCreateTypeDialogOpen(false);
                    handleInvitationFormDialog();
                  }}
                  className="group relative flex flex-col items-start gap-3 p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <Users className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">招待フォーム</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      イベント参加申込用。日時選択＋個人QRコードを発行します。
                    </p>
                  </div>
                  <ArrowRight className="absolute top-5 right-4 h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </button>
              </div>
            </CustomModal>

            {/* QR Code Modal */}
            <CustomModal
              isOpen={isQrDialogOpen}
              onClose={() => { setIsQrDialogOpen(false); setQrCourse(null); setQrDataUrl(''); }}
              title="QRコード"
              description={qrCourse ? `「${qrCourse.courseName}」の出席フォームQRコード` : ''}
              className="sm:max-w-[400px]"
            >
              <div className="flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <img src={qrDataUrl} alt="QRコード" className="w-64 h-64" />
                    </div>
                    <p className="text-xs text-slate-500 text-center break-all px-4">
                      {typeof window !== 'undefined' && qrCourse ? `${window.location.origin}${qrCourse.formType === 'invitation' ? '/invitation/' : '/attendance/'}${qrCourse.code}` : ''}
                    </p>
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (qrCourse) {
                            const basePath = qrCourse.formType === 'invitation' ? '/invitation/' : '/attendance/';
                            const url = `${window.location.origin}${basePath}${qrCourse.code}`;
                            navigator.clipboard.writeText(url);
                            showToast("コピー完了", "URLをコピーしました。");
                          }
                        }}
                        className="flex-1 h-9 text-sm"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        URLコピー
                      </Button>
                      <Button
                        onClick={handleDownloadQr}
                        className="flex-1 h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        ダウンロード
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  </div>
                )}
              </div>
            </CustomModal>

            {/* Invitation Form Manager Modal */}
            <CustomModal
              isOpen={isInvitationFormDialogOpen}
              onClose={() => { setIsInvitationFormDialogOpen(false); setEditingInvitationFormCourse(null); }}
              title={editingInvitationFormCourse ? '招待フォームを編集' : '招待フォーム作成'}
              description={editingInvitationFormCourse ? '招待フォームの設定を更新します。' : 'イベント参加申込用のフォームを作成します。'}
              className="sm:max-w-[600px]"
            >
              <InvitationFormManager
                onCourseAdded={() => { fetchCourses(); fetchPlanInfo(); }}
                onClose={() => { setIsInvitationFormDialogOpen(false); setEditingInvitationFormCourse(null); }}
                editingInvitation={editingInvitationFormCourse ? {
                  code: editingInvitationFormCourse.code,
                  eventName: editingInvitationFormCourse.courseName,
                  teacherName: editingInvitationFormCourse.teacherName,
                  invitationSettings: editingInvitationFormCourse.invitationSettings,
                  customFields: editingInvitationFormCourse.customFields,
                } : undefined}
              />
            </CustomModal>

            {/* Invitation Response List Modal */}
            <CustomModal
              isOpen={isResponseListDialogOpen}
              onClose={() => { setIsResponseListDialogOpen(false); setResponseListCourse(null); }}
              title="参加申込一覧"
              description={responseListCourse ? `「${responseListCourse.courseName}」の参加申込状況` : ''}
              className="sm:max-w-[640px]"
            >
              {responseListCourse && (
                <InvitationResponseList
                  courseCode={responseListCourse.code}
                  courseName={responseListCourse.courseName}
                />
              )}
            </CustomModal>

            {/* Manual attendance entry modal */}
            <ManualAttendanceModal
              isOpen={!!manualEntryCourse}
              onClose={() => setManualEntryCourse(null)}
              course={manualEntryCourse}
            />

            {/* Course list */}
            {loadingCourses ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <p className="text-sm text-slate-500">フォーム情報を読み込み中...</p>
                </div>
              </div>
            ) : courses.length === 0 ? (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 px-4"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 flex items-center justify-center mb-5 shadow-sm">
                  <Inbox className="h-9 w-9 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">最初のフォームを作成しましょう</h3>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
                  {[
                    {
                      icon: ClipboardEdit,
                      title: '受付をフォーム化',
                      description: '出席管理や招待受付を、参加者がスマホから回答できる形にします。',
                    },
                    {
                      icon: QrCode,
                      title: '作成してすぐ共有',
                      description: '種類を選び、名前と項目を設定すると専用URLとQRコードを発行します。',
                    },
                    {
                      icon: Download,
                      title: '回答をあとで活用',
                      description: '集まった出席・申込データは管理画面で確認し、CSV出力できます。',
                    },
                  ].map(({ icon: Icon, title, description }) => (
                    <div key={title} className="rounded-lg border border-indigo-100 bg-white px-4 py-3 text-left shadow-sm">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setIsCreateTypeDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  最初のフォームを作成する
                </Button>
              </motion.div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[#e9e7e7] bg-white px-4 py-16 text-center">
                <Search className="mb-3 h-8 w-8 text-[#aac8ff]" />
                <h3 className="text-sm font-bold text-[#323232]">一致するフォームはありません</h3>
                <p className="mt-1 text-xs text-[#595959]">検索条件を変更してください。</p>
              </div>
            ) : (
              /* Course cards grid */
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredCourses.slice((coursePage - 1) * CARDS_PER_PAGE, coursePage * CARDS_PER_PAGE).map((course, index) => {
                  const basePath = course.formType === 'invitation' ? '/invitation/' : '/attendance/';
                  const formUrl = typeof window !== 'undefined'
                    ? `${window.location.origin}${basePath}${course.code}`
                    : `${basePath}${course.code}`;

                  return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className={`
                        group relative bg-white rounded-2xl ring-1 transition-all duration-300
                        hover:shadow-lg hover:-translate-y-0.5
                        ${course.formType === 'invitation'
                          ? 'ring-emerald-200/80 shadow-sm shadow-emerald-100/50'
                          : course.isCustomForm
                            ? 'ring-purple-200/80 shadow-sm shadow-purple-100/50'
                            : 'ring-black/5 shadow-sm'
                        }
                      `}
                    >
                      <div className="p-4 sm:p-5">
                        {/* Top row: name + actions */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`
                              flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                              ${course.formType === 'invitation'
                                ? 'bg-emerald-100 text-emerald-600'
                                : course.isCustomForm
                                  ? 'bg-purple-100 text-purple-600'
                                  : 'bg-indigo-50 text-indigo-600'
                              }
                            `}>
                              {course.formType === 'invitation'
                                ? <Users className="h-4 w-4" />
                                : course.isCustomForm
                                  ? <Sparkles className="h-4 w-4" />
                                  : <FileText className="h-4 w-4" />
                              }
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                                  {course.courseName}
                                </h3>
                                {course.formType === 'invitation' ? (
                                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                    <Users className="h-2.5 w-2.5" />
                                    招待状
                                  </span>
                                ) : course.isCustomForm ? (
                                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    カスタム
                                  </span>
                                ) : null}
                                <span className={`flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  course.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {course.status === 'active' ? '受付中' : '停止中'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                {course.teacherName}
                              </p>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {course.formType !== 'invitation' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setManualEntryCourse(course); }}
                                className="h-auto min-w-[2.25rem] sm:min-w-[1.75rem] px-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                                title="手動入力（紙の出席票などを管理者が入力）"
                                aria-label="手動入力"
                              >
                                <ClipboardEdit className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                <span className="text-[10px] font-medium leading-none">手動入力</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={courseStatusPendingCode === course.code}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleToggleCourseStatus(course);
                              }}
                              className={`h-auto min-w-[2.25rem] sm:min-w-[1.75rem] px-1 py-1 flex flex-col items-center justify-center gap-0.5 rounded-md transition-colors disabled:pointer-events-none disabled:opacity-60 ${
                                course.status === 'active'
                                  ? 'text-red-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100'
                              }`}
                              title={course.status === 'active' ? 'フォーム受付を終了' : 'フォーム受付を開始'}
                              aria-label={course.status === 'active' ? 'フォーム受付を終了' : 'フォーム受付を開始'}
                            >
                              {courseStatusPendingCode === course.code ? (
                                <>
                                  <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
                                  <span className="text-[10px] font-medium leading-none">
                                    {course.status === 'active' ? '終了中' : '開始中'}
                                  </span>
                                </>
                              ) : course.status === 'active' ? (
                                <>
                                  <StopCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                  <span className="text-[10px] font-medium leading-none">終了</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 sm:h-3.5 sm:w-3.5 fill-current" />
                                  <span className="text-[10px] font-medium leading-none">開始</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEditCourse(course); }}
                              className="h-11 w-11 sm:h-10 sm:w-10 flex flex-col items-center justify-center gap-0.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
                              title="フォームを編集"
                              aria-label="フォームを編集"
                            >
                              <Edit className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              <span className="text-[10px] leading-none">編集</span>
                            </button>
                            <button
                              type="button"
                              disabled={duplicatePendingCode === course.code}
                              onClick={(e) => { e.stopPropagation(); handleDuplicateCourse(course); }}
                              className="h-11 w-11 sm:h-10 sm:w-10 flex flex-col items-center justify-center gap-0.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                              title="フォームを複製（設定を引き継いで新規作成。URLのコピーではありません）"
                              aria-label="フォームを複製"
                            >
                              {duplicatePendingCode === course.code ? (
                                <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
                              ) : (
                                <CopyPlus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              )}
                              <span className="text-[10px] leading-none">複製</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.code, course.courseName); }}
                              className="h-9 w-9 sm:h-7 sm:w-7 flex items-center justify-center rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                              title="フォームを削除"
                              aria-label="フォームを削除"
                            >
                              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Form URL section */}
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200/60">
                              <code className="text-xs text-slate-600 block truncate">
                                {formUrl}
                              </code>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyFormUrl(formUrl, course.courseName)}
                              className="h-8 w-8 p-0 flex-shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowQr(course)}
                              className="h-8 w-8 p-0 flex-shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                              title="QRコードを表示"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(formUrl, '_blank')}
                              className="h-8 w-8 p-0 flex-shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* 招待フォーム: 回答一覧ボタン + QRスキャン受付 */}
                        {course.formType === 'invitation' && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShowResponses(course)}
                              className="w-full h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              <Users className="h-3 w-3 mr-1.5" />
                              参加申込一覧を表示
                            </Button>
                            <Link href={`/admin/scanner?course=${course.code}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 mt-1"
                              >
                                <QrCode className="h-3 w-3 mr-1.5" />
                                QRスキャン受付
                              </Button>
                            </Link>
                          </div>
                        )}

                        {/* Date */}
                        <div className="mt-2.5 flex items-center justify-end">
                          <span className="text-xs text-slate-400">
                            更新: {new Date(course.lastUpdated).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {renderPagination(
                coursePage,
                Math.max(1, Math.ceil(filteredCourses.length / CARDS_PER_PAGE)),
                setCoursePage
              )}
              </>
            )}
            </div>
          </TabsContent>

          {/* ===== ROOMS TAB ===== */}
          <TabsContent value="rooms" className="mt-0">
            <AdminPageHeader
              title="ルーム管理"
              description={
                rooms.length > 0
                  ? `${rooms.length} 件のルームを管理中`
                  : 'ルームを作成してインタラクティブなQ&Aや投票を始めましょう'
              }
              icon={Airplay}
              theme={ADMIN_COLOR_THEMES.rooms}
              helpHref="/admin/faq#rooms"
            >
                {/* ルーム数バッジ */}
                {planInfo && (
                  <div className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold ${
                    planInfo.subscription.plan === 'enterprise'
                      ? 'bg-slate-800 text-white'
                      : planInfo.subscription.plan === 'paid'
                        ? 'bg-[#dce8ff] text-[#23418c]'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {planInfo.subscription.plan === 'enterprise' ? '✦ Enterprise' : planInfo.subscription.plan === 'paid' ? '✦ Pro' : 'Free'}
                    <span className="text-[10px] opacity-70">
                      {planInfo.usage.roomCount}/{planInfo.limits.maxRooms === Infinity ? '∞' : planInfo.limits.maxRooms}
                    </span>
                  </div>
                )}
                {planInfo && planInfo.subscription.status === 'cancelled' && currentPeriodEndLabel && (
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    {currentPeriodEndLabel}で解約予定
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRooms}
                  disabled={loadingRooms}
                  className="h-9 rounded-md border-[#e1dcdc] bg-white px-3 text-[#595959]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Button
                  onClick={() => {
                    if (planInfo && !planInfo.canCreateRoom) {
                      showToast('上限に達しています', `無料プランではルーム${planInfo.limits.maxRooms}個まで作成できます。Proプランにアップグレードしてください。`, 'destructive');
                      return;
                    }
                    setIsCreateRoomDialogOpen(true);
                  }}
                  className="h-9 rounded-md bg-[#2864f0] px-4 text-white shadow-sm hover:bg-[#285ac8]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  ルーム作成
                </Button>
                {planInfo && planInfo.subscription.plan === 'free' && !planInfo.canCreateRoom && (
                  <Button
                    asChild
                    className="h-9 rounded-md bg-[#2864f0] px-4 text-white shadow-sm hover:bg-[#285ac8]"
                  >
                    <Link href="/admin/account">
                      Proにアップグレード
                    </Link>
                  </Button>
                )}
            </AdminPageHeader>

            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-2xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8989]" />
                <Input
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="ルーム名・コード・ステータスで検索"
                  className="h-9 rounded-md border-[#cccccc] bg-white pl-9 text-sm"
                />
              </div>
              {roomSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setRoomSearch('')}
                  className="self-start text-xs font-bold text-[#2864f0] hover:text-[#285ac8] sm:self-auto"
                >
                  クリア
                </button>
              )}
            </div>

            {/* Room Creation Modal */}
            <CustomModal
              isOpen={isCreateRoomDialogOpen}
              onClose={() => setIsCreateRoomDialogOpen(false)}
              title="新しいルームを作成"
              description="参加者がリアルタイムでQ&Aや投票に参加できるルームを作成します。"
              className="sm:max-w-[440px]"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="room-title" className="text-sm font-medium text-slate-700">
                    ルーム名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="room-title"
                    placeholder="例: 経済学入門 Q&Aセッション"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsCreateRoomDialogOpen(false)} className="h-9 w-full sm:w-auto">
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={creatingRoom || !newRoomTitle.trim()}
                    className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {creatingRoom ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        作成中...
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        作成する
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CustomModal>

            {/* Room Edit Modal */}
            <CustomModal
              isOpen={isEditRoomDialogOpen}
              onClose={() => setIsEditRoomDialogOpen(false)}
              title="ルームを編集"
              description="ルーム名を変更できます。"
              className="sm:max-w-[440px]"
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-room-title" className="text-sm font-medium text-slate-700">
                    ルーム名 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-room-title"
                    value={editRoomTitle}
                    onChange={(e) => setEditRoomTitle(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsEditRoomDialogOpen(false)} className="h-9 w-full sm:w-auto">
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleUpdateRoom}
                    disabled={savingEditRoom || !editRoomTitle.trim()}
                    className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {savingEditRoom ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        更新中...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        更新する
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CustomModal>

            {/* Room list */}
            {loadingRooms ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <p className="text-sm text-slate-500">ルーム情報を読み込み中...</p>
                </div>
              </div>
            ) : rooms.length === 0 ? (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-20 px-4"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-50 to-fuchsia-50 ring-1 ring-purple-100 flex items-center justify-center mb-5 shadow-sm">
                  <Airplay className="h-9 w-9 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">最初のルームを作成しましょう</h3>
                <div className="grid w-full max-w-3xl grid-cols-1 gap-3 mb-6 sm:grid-cols-3">
                  {[
                    {
                      icon: Users,
                      title: '参加の場を用意',
                      description: '匿名Q&A・投票・クイズ・ランキング・ブレストを、参加者のスマホとリアルタイムに行えます。',
                    },
                    {
                      icon: QrCode,
                      title: 'コードでかんたん参加',
                      description: 'ルーム名を入力して作成すると、参加用コードとQRを発行。参加者の登録は不要です。',
                    },
                    {
                      icon: Airplay,
                      title: '反応は画面へ、終われば記録に',
                      description: '反応はスクリーンに共有でき、終了後はセッションレポートとして残せます。',
                    },
                  ].map(({ icon: Icon, title, description }) => (
                    <div key={title} className="rounded-lg border border-purple-100 bg-white px-4 py-3 text-left shadow-sm">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => setIsCreateRoomDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  最初のルームを作成する
                </Button>
              </motion.div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[#e9e7e7] bg-white px-4 py-16 text-center">
                <Search className="mb-3 h-8 w-8 text-[#aac8ff]" />
                <h3 className="text-sm font-bold text-[#323232]">一致するルームはありません</h3>
                <p className="mt-1 text-xs text-[#595959]">検索条件を変更してください。</p>
              </div>
            ) : (
              /* Room cards grid */
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredRooms.slice((roomPage - 1) * CARDS_PER_PAGE, roomPage * CARDS_PER_PAGE).map((room, index) => {
                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className="group relative bg-white rounded-2xl ring-1 ring-black/5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="p-4 sm:p-5">
                        {/* Top row: title + status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                              <Airplay className="h-4 w-4 text-indigo-600" />
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">{room.title}</h3>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                            room.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : room.status === 'closed'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {room.status === 'active' ? '公開中' : room.status === 'closed' ? '終了' : room.status}
                          </span>
                        </div>

                        {/* Room code */}
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-xs text-slate-400">コード:</span>
                          <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{room.code}</code>
                        </div>

                        {/* Actions row 1: main actions */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={copyPendingCode === room.code}
                            onClick={() => copyRoomUrl(room.code, room.title)}
                            className="h-8 w-full px-3 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-60 disabled:pointer-events-none"
                          >
                            {copyPendingCode === room.code ? (
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1.5" />
                            )}
                            URLコピー
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={viewPendingCode === room.code}
                            onClick={() => handleOpenParticipantView(room.code)}
                            className="h-8 w-full px-3 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-60 disabled:pointer-events-none"
                          >
                            {viewPendingCode === room.code ? (
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            ) : (
                              <Globe className="h-3 w-3 mr-1.5" />
                            )}
                            参加者ビュー
                          </Button>
                          <Button
                            size="sm"
                            disabled={hostPendingCode === room.code}
                            onClick={() => handleOpenHostView(room.code)}
                            className="h-8 w-full px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 disabled:pointer-events-none"
                          >
                            {hostPendingCode === room.code ? (
                              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                            ) : (
                              <Settings className="h-3 w-3 mr-1.5" />
                            )}
                            ホスト管理
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/rooms/${room.code}/host?tab=export`)}
                            className="h-8 w-full px-3 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300"
                          >
                            <Download className="h-3 w-3 mr-1.5" />
                            データ出力
                          </Button>
                        </div>

                        {/* Actions row 2: status toggle / edit / delete */}
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 sm:gap-1">
                            <button
                              type="button"
                              disabled={roomStatusPendingCode === room.code}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newStatus = room.status === 'active' ? 'closed' : 'active';
                                setRoomStatusPendingCode(room.code);
                                try {
                                  const res = await fetch(`/api/rooms/${room.code}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: newStatus }),
                                  });
                                  if (res.ok) {
                                    showToast("更新完了", newStatus === 'active' ? 'ルームを再開しました。' : 'ルームを終了しました。');
                                    await fetchRooms();
                                  }
                                } catch {
                                  showToast("更新失敗", "ステータスの変更に失敗しました。", "destructive");
                                } finally {
                                  setRoomStatusPendingCode(null);
                                }
                              }}
                              className={`h-9 px-3 sm:h-7 sm:px-2 text-xs rounded-md inline-flex items-center justify-center gap-1 transition-colors disabled:opacity-60 disabled:pointer-events-none ${
                                room.status === 'active'
                                  ? 'text-red-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100'
                                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100'
                              }`}
                            >
                              {roomStatusPendingCode === room.code ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 sm:h-3 sm:w-3 animate-spin shrink-0" />
                                  <span>{room.status === 'active' ? '終了中…' : '開始中…'}</span>
                                </>
                              ) : room.status === 'active' ? (
                                <>
                                  <StopCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                                  終了
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 sm:h-3 sm:w-3 shrink-0" />
                                  開始
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEditRoom(room); }}
                              className="h-9 px-3 sm:h-7 sm:px-2 text-xs rounded-md inline-flex items-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
                            >
                              <Edit className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" />
                              編集
                            </button>
                            <button
                              type="button"
                              disabled={duplicatePendingCode === room.code}
                              onClick={(e) => { e.stopPropagation(); handleDuplicateRoom(room); }}
                              title="ワーク構成を引き継いで複製（票・質問・履歴は引き継ぎません）"
                              className="h-9 px-3 sm:h-7 sm:px-2 text-xs rounded-md inline-flex items-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                            >
                              {duplicatePendingCode === room.code ? (
                                <Loader2 className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1 animate-spin" />
                              ) : (
                                <CopyPlus className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" />
                              )}
                              複製
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room); }}
                              className="h-9 px-3 sm:h-7 sm:px-2 text-xs rounded-md inline-flex items-center text-red-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-3 sm:w-3 mr-1" />
                              削除
                            </button>
                          </div>
                          <span className="text-xs text-slate-400">
                            作成: {new Date(room.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {renderPagination(
                roomPage,
                Math.max(1, Math.ceil(filteredRooms.length / CARDS_PER_PAGE)),
                setRoomPage
              )}
              </>
            )}
            </div>
          </TabsContent>

          {/* ===== ATTENDANCE DATA TAB ===== */}
          <TabsContent value="export" className="mt-0">
            <AdminPageHeader
              title="データ管理"
              description="フォームごとのデータをCSV形式でエクスポートできます"
              icon={BarChart3}
              theme={ADMIN_COLOR_THEMES.export}
              helpHref="/admin/faq#export"
            />
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
              <AttendanceExport />
            </div>
          </TabsContent>
        </Tabs>

      {/* 削除確認モーダル */}
      <CustomModal
        isOpen={!!deleteConfirm}
        onClose={() => { if (!isDeleting) setDeleteConfirm(null); }}
        title="削除の確認"
        description={
          deleteConfirm?.type === 'course'
            ? `「${deleteConfirm?.name}」を削除してもよろしいですか？\n関連する出席データもすべて削除されます。`
            : `「${deleteConfirm?.name}」を削除してもよろしいですか？\n関連するQ&Aデータ・投票データもすべて削除されます。`
        }
        className="max-w-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              {deleteConfirm?.type === 'course'
                ? 'このフォームと関連する出席データがすべて削除されます。この操作は取り消せません。'
                : 'このルームと関連するQ&A・投票データがすべて削除されます。この操作は取り消せません。'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={executeDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  削除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  削除する
                </>
              )}
            </Button>
          </div>
        </div>
      </CustomModal>

    </AdminShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  );
}
