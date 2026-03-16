'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Card components available if needed by sub-components
// import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast';
import {
  Copy,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  Save,
  LogOut,
  Menu,
  X,
  Loader2,
  Sparkles,
  BarChart3,
  Inbox,
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation,
  Search,
  CheckCircle,
  Settings,
  MessageSquare,
  FileText,
  Zap,
  Globe,
  Users,
  Link2,
  ArrowRight,
} from 'lucide-react';
// Separator kept for potential sub-component use
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// 元のDialogインポートを削除し、CustomModalをインポート
import { CustomModal } from '@/components/ui/custom-modal';
import { motion } from 'framer-motion';
import Link from 'next/link';
import LocationSettingsForm from './components/LocationSettingsForm';
import CustomFormManager from './components/CustomFormManager';
import AttendanceExport from './components/AttendanceExport';

interface Course {
  id: string;
  code: string;
  courseName: string;
  teacherName: string;
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
  isCustomForm?: boolean;
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
}

export default function AdminPage() {
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();
  
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
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // 編集用の状態
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourse, setEditCourse] = useState({
    courseName: '',
    teacherName: '',
    enableLocation: false,
    locationName: '',
    latitude: 0,
    longitude: 0,
    radius: 0.5,
  });
  const [savingEditCourse, setSavingEditCourse] = useState<boolean>(false);
  const [editLocationResolved, setEditLocationResolved] = useState<boolean>(false);
  const [editLocationError, setEditLocationError] = useState<string | null>(null);
  const [isEditGettingLocation, setIsEditGettingLocation] = useState<boolean>(false);
  const [editLocationMode, setEditLocationMode] = useState<'search' | 'gps'>('search');
  const [editPlaceSuggestions, setEditPlaceSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [editShowSuggestions, setEditShowSuggestions] = useState(false);
  const editSearchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // モバイルメニュー用の状態
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // 作成タイプ選択モーダル
  const [isCreateTypeDialogOpen, setIsCreateTypeDialogOpen] = useState<boolean>(false);

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

  // 位置情報設定用の状態を追加
  const [locationSettings, setLocationSettings] = useState({
    latitude: 33.1751332,
    longitude: 131.6138803,
    radius: 0.5,
    locationName: ''
  });
  const [loadingLocationSettings, setLoadingLocationSettings] = useState(false);

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
    subscription: { plan: 'free' | 'paid'; status: string };
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
      }
    } catch (error) {
      console.error('Failed to fetch plan info:', error);
    }
  }, []);

  // Proプランにアップグレード
  const handleUpgrade = async () => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'pro_subscription',
          successUrl: `${window.location.origin}/admin?payment=success`,
          cancelUrl: `${window.location.origin}/admin?payment=cancelled`,
        }),
      });

      if (!response.ok) throw new Error('決済セッションの作成に失敗しました');

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Upgrade error:', error);
      showToast('エラー', '決済処理中にエラーが発生しました', 'destructive');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // カスタムフォームダイアログを開く（上限チェック付き）
  const handleCustomFormDialog = () => {
    if (planInfo && !planInfo.canCreateForm) {
      showToast('上限に達しています', `無料プランではフォーム${planInfo.limits.maxForms}個まで作成できます。Proプランにアップグレードしてください。`, 'destructive');
      return;
    }
    setIsCustomFormDialogOpen(true);
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
          createdBy: '',
          createdAt: c.created_at || '',
          lastUpdated: c.created_at || '',
          isCustomForm: (c.custom_fields && c.custom_fields.length > 0) || false,
          locationSettings: c.location_settings || undefined,
        }));
        setCourses(mappedCourses);
        showToast("データ更新", `${mappedCourses.length}件の出席フォームを読み込みました。`);
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

  // 位置情報設定を取得
  const fetchLocationSettings = useCallback(async () => {
    setLoadingLocationSettings(true);
    try {
      const response = await fetch('/api/admin/location-settings');
      if (response.ok) {
        const data = await response.json();
        setLocationSettings(data.defaultLocationSettings);
      }
    } catch (error) {
      console.error('位置情報設定の取得に失敗:', error);
      showToast('エラー', '位置情報設定の取得に失敗しました', 'destructive');
    } finally {
      setLoadingLocationSettings(false);
    }
  }, [showToast]);

  // 位置情報設定を保存
  const saveLocationSettings = async (settings: typeof locationSettings): Promise<void> => {
    try {
      const response = await fetch('/api/admin/location-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setLocationSettings(settings);
        showToast('成功', '位置情報設定を保存しました。出席フォームに反映されるまで数分かかる場合があります。');
        
        // ローカルストレージからキャッシュをクリア（ユーザー向け）
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('attendance_location_settings');
            console.log('位置情報設定のキャッシュをクリアしました');
          } catch (error) {
            console.warn('キャッシュクリアに失敗:', error);
          }
        }
      } else {
        throw new Error('保存に失敗しました');
      }
    } catch (error) {
      console.error('位置情報設定の保存に失敗:', error);
      showToast('エラー', '位置情報設定の保存に失敗しました', 'destructive');
      throw error;
    }
  };

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
      fetchLocationSettings();
      fetchPlanInfo();
    }
  }, [status, fetchCourses, fetchRooms, fetchLocationSettings, fetchPlanInfo]);

  // 決済結果の処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      showToast('決済完了', 'Proプランへのアップグレードが完了しました！', 'default');
      fetchPlanInfo(); // プラン情報を更新
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      showToast('決済キャンセル', '決済がキャンセルされました', 'destructive');
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);

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

  // ログアウト処理
  const handleSignOut = () => {
    signOut({ callbackUrl: '/admin/login' });
  };

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
        setNewCourse({ courseName: '', teacherName: '', enableLocation: false, locationName: '', latitude: 33.1751332, longitude: 131.6138803, radius: 0.5 });
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
        setEditCourse({ courseName: '', teacherName: '', enableLocation: false, locationName: '', latitude: 0, longitude: 0, radius: 0.5 });
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

  // 講義の削除（Supabase v2 API - ソフトデリート）
  const handleDeleteCourse = async (courseCode: string, courseName: string) => {
    if (!confirm(`「${courseName}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v2/courses/${courseCode}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast("削除完了", "フォームを削除しました。");
        await fetchCourses(); fetchPlanInfo();
      } else {
        const errorData = await response.json();
        showToast("削除失敗", errorData.message || "フォームの削除に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to delete course:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
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
    try {
      const url = `${window.location.origin}/rooms/${code}`;
      await navigator.clipboard.writeText(url);
      showToast("コピー完了", `${title}のルームURLをコピーしました。`);
    } catch {
      showToast("コピー失敗", "URLのコピーに失敗しました。", "destructive");
    }
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
  const handleDeleteRoom = async (room: Room) => {
    if (!confirm(`「${room.title}」を削除してもよろしいですか？\n関連するQ&Aデータ・投票データもすべて削除されます。`)) {
      return;
    }
    try {
      const response = await fetch(`/api/rooms/${room.code}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        showToast("削除完了", "ルームを削除しました。");
        await fetchRooms();
        fetchPlanInfo();
      } else {
        showToast("削除失敗", "ルームの削除に失敗しました。", "destructive");
      }
    } catch {
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal top nav */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + title */}
          <div className="flex items-center gap-3">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-base font-semibold text-slate-900 tracking-tight hidden sm:block">
              ざせきくん
            </span>
          </div>

          {/* Right: user + logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop user info */}
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                {session.user?.name?.charAt(0) || 'U'}
              </div>
              <span className="max-w-[160px] truncate">{session.user?.email}</span>
            </div>
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden h-8 w-8 p-0"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
              className="hidden sm:flex text-slate-500 hover:text-slate-900 h-8 gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-sm">ログアウト</span>
            </Button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="sm:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                {session.user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{session.user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{session.user?.email}</p>
              </div>
            </div>
            <Button
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              className="w-full h-8 text-sm"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              ログアウト
            </Button>
          </motion.div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs defaultValue="courses" className="w-full">
          {/* Clean pill tabs -- 2 tabs only */}
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-slate-100/80 p-0.5 rounded-lg h-9">
              <TabsTrigger
                value="courses"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 h-8 text-sm font-medium transition-all gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                出席管理
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 h-8 text-sm font-medium transition-all gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                ルーム
              </TabsTrigger>
              <TabsTrigger
                value="export"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 h-8 text-sm font-medium transition-all gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                出席データ
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===== COURSES TAB ===== */}
          <TabsContent value="courses" className="mt-0">
            {/* Section header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">出席管理</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {courses.length > 0
                    ? `${courses.length} 件の出席フォームを管理中`
                    : '出席フォームを作成して始めましょう'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* プランバッジ */}
                {planInfo && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    planInfo.subscription.plan === 'paid'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {planInfo.subscription.plan === 'paid' ? '✦ Pro' : 'Free'}
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
                  className="h-9 px-3 text-slate-600 border-slate-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingCourses ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Button
                  onClick={() => setIsCreateTypeDialogOpen(true)}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  新規作成
                </Button>
                {/* 無料プランの場合のアップグレードボタン */}
                {planInfo && planInfo.subscription.plan === 'free' && !planInfo.canCreateForm && (
                  <Button
                    onClick={handleUpgrade}
                    disabled={isProcessingPayment}
                    className="h-9 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm"
                  >
                    Proにアップグレード
                  </Button>
                )}
              </div>
            </div>

            {/* Add Course Modal */}
            <CustomModal
              isOpen={isAddDialogOpen}
              onClose={() => setIsAddDialogOpen(false)}
              title="デフォルトフォーム作成"
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

            {/* Custom Form Modal (kept for future use) */}
            <CustomModal
              isOpen={isCustomFormDialogOpen}
              onClose={() => setIsCustomFormDialogOpen(false)}
              title="カスタムフォーム設定"
              description="出席フォームの項目をカスタマイズできます。デフォルト項目の有効/無効化や、独自の項目を追加できます。"
              className="sm:max-w-[800px] max-h-[90vh]"
            >
              <CustomFormManager
                onCourseAdded={fetchCourses}
                onClose={() => setIsCustomFormDialogOpen(false)}
              />
            </CustomModal>

            {/* Create Type Choice Modal */}
            <CustomModal
              isOpen={isCreateTypeDialogOpen}
              onClose={() => setIsCreateTypeDialogOpen(false)}
              title="出席フォームのタイプを選択"
              description="作成するフォームのタイプを選んでください。"
              className="sm:max-w-[480px]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* デフォルトフォーム */}
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
                    <h3 className="text-sm font-semibold text-slate-900">デフォルトフォーム</h3>
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
              </div>
            </CustomModal>

            {/* Course list */}
            {loadingCourses ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                  <p className="text-sm text-slate-500">出席フォーム情報を読み込み中...</p>
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
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <Inbox className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">出席フォームがまだありません</h3>
                <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                  出席フォームを作成すると、専用のURLが自動生成されます。共有してすぐに出席管理を始められます。
                </p>
                <Button
                  onClick={() => setIsCreateTypeDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  最初の出席フォームを作成する
                </Button>
              </motion.div>
            ) : (
              /* Course cards grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {courses.map((course, index) => {
                  const formUrl = typeof window !== 'undefined'
                    ? `${window.location.origin}/attendance/${course.code}`
                    : `/attendance/${course.code}`;

                  return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className={`
                        group relative bg-white rounded-xl border transition-all duration-200
                        hover:shadow-md hover:border-slate-300
                        ${course.isCustomForm
                          ? 'border-purple-200/80 shadow-sm shadow-purple-100/50'
                          : 'border-slate-200 shadow-sm'
                        }
                      `}
                    >
                      <div className="p-4 sm:p-5">
                        {/* Top row: name + actions */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`
                              flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                              ${course.isCustomForm
                                ? 'bg-purple-100 text-purple-600'
                                : 'bg-indigo-50 text-indigo-600'
                              }
                            `}>
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-slate-900 text-sm truncate">
                                  {course.courseName}
                                </h3>
                                {course.isCustomForm && (
                                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    カスタム
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                {course.teacherName}
                              </p>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCourse(course)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCourse(course.code, course.courseName)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
                              onClick={() => window.open(formUrl, '_blank')}
                              className="h-8 w-8 p-0 flex-shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Date */}
                        <div className="mt-2.5 flex items-center justify-end">
                          <span className="text-[11px] text-slate-400">
                            更新: {new Date(course.lastUpdated).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ROOMS TAB ===== */}
          <TabsContent value="rooms" className="mt-0">
            {/* Section header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">ルーム管理</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {rooms.length > 0
                    ? `${rooms.length} 件のルームを管理中`
                    : 'ルームを作成してインタラクティブなQ&Aや投票を始めましょう'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* ルーム数バッジ */}
                {planInfo && (
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    planInfo.subscription.plan === 'paid'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {planInfo.subscription.plan === 'paid' ? '✦ Pro' : 'Free'}
                    <span className="text-[10px] opacity-70">
                      {planInfo.usage.roomCount}/{planInfo.limits.maxRooms === Infinity ? '∞' : planInfo.limits.maxRooms}
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRooms}
                  disabled={loadingRooms}
                  className="h-9 px-3 text-slate-600 border-slate-200"
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  ルーム作成
                </Button>
                {/* 無料プランの場合のアップグレードボタン */}
                {planInfo && planInfo.subscription.plan === 'free' && !planInfo.canCreateRoom && (
                  <Button
                    onClick={handleUpgrade}
                    disabled={isProcessingPayment}
                    className="h-9 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm"
                  >
                    Proにアップグレード
                  </Button>
                )}
              </div>
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && newRoomTitle.trim()) handleCreateRoom(); }}
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && editRoomTitle.trim()) handleUpdateRoom(); }}
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
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">ルームがまだありません</h3>
                <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                  ルームを作成すると、参加者とリアルタイムでQ&Aや投票ができます。共有コードで誰でも簡単に参加可能。
                </p>
                <Button
                  onClick={() => setIsCreateRoomDialogOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-5"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  最初のルームを作成する
                </Button>
              </motion.div>
            ) : (
              /* Room cards grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rooms.map((room, index) => {
                  const roomUrl = typeof window !== 'undefined'
                    ? `${window.location.origin}/rooms/${room.code}`
                    : `/rooms/${room.code}`;
                  const hostUrl = typeof window !== 'undefined'
                    ? `${window.location.origin}/rooms/${room.code}/host`
                    : `/rooms/${room.code}/host`;

                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.25 }}
                      className="group relative bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
                    >
                      <div className="p-4 sm:p-5">
                        {/* Top row: title + status */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4 w-4 text-indigo-600" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 truncate">{room.title}</h3>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyRoomUrl(room.code, room.title)}
                            className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300"
                          >
                            <Copy className="h-3 w-3 mr-1.5" />
                            URLコピー
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(roomUrl, '_blank')}
                            className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300"
                          >
                            <Globe className="h-3 w-3 mr-1.5" />
                            参加者ビュー
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => window.open(hostUrl, '_blank')}
                            className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Settings className="h-3 w-3 mr-1.5" />
                            ホスト管理
                          </Button>
                        </div>

                        {/* Actions row 2: edit / delete */}
                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRoom(room)}
                              className="h-7 px-2 text-xs text-slate-400 hover:text-indigo-600"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              編集
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRoom(room)}
                              className="h-7 px-2 text-xs text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              削除
                            </Button>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            作成: {new Date(room.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== ATTENDANCE DATA TAB ===== */}
          <TabsContent value="export" className="mt-0">
            <div className="mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">出席データ</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                フォームごとの出席データをCSV形式でエクスポートできます
              </p>
            </div>
            <AttendanceExport />
          </TabsContent>
        </Tabs>
      </main>

      {/* Subtle footer */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-6 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>Powered by Supabase</span>
          <Link href="/legal/tokusho" target="_blank" className="hover:text-slate-600 transition-colors">
            特定商取引法に基づく表記
          </Link>
        </div>
      </footer>
    </div>
  );
}