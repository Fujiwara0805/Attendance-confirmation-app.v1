'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image'
import { useToast } from '@/hooks/use-toast';
import { 
  Copy, 
  HelpCircle, 
  ExternalLink, 
  Settings, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Shield,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  User,
  GraduationCap,
  Save,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  MapPin,
  Search,
  Loader2,
  FormInput,
  Sparkles,
  Star,
  Crown,
  Palette
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// 元のDialogインポートを削除し、CustomModalをインポート
import { CustomModal } from '@/components/ui/custom-modal';
import { motion } from 'framer-motion';
import Link from 'next/link';
import LocationSettingsForm from './components/LocationSettingsForm';
import CustomFormManager from './components/CustomFormManager';

interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  spreadsheetId: string;
  defaultSheetName: string;
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
  isCustomForm?: boolean; // カスタムフォームかどうかのフラグを追加
}

export default function AdminPage() {
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // 講義管理用の状態
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  
  // 新規講義追加用の状態
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [newCourse, setNewCourse] = useState({
    courseName: '',
    teacherName: '',
    spreadsheetId: ''
  });
  const [savingNewCourse, setSavingNewCourse] = useState<boolean>(false);

  // カスタムフォーム設定用の状態を追加
  const [isCustomFormDialogOpen, setIsCustomFormDialogOpen] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

  // 編集用の状態
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourse, setEditCourse] = useState({
    courseName: '',
    teacherName: '',
    spreadsheetId: ''
  });
  const [savingEditCourse, setSavingEditCourse] = useState<boolean>(false);

  // モバイルメニュー用の状態
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // 位置情報設定用の状態を追加
  const [locationSettings, setLocationSettings] = useState({
    latitude: 33.1751332,
    longitude: 131.6138803,
    radius: 0.5,
    locationName: ''
  });
  const [loadingLocationSettings, setLoadingLocationSettings] = useState(false);

  const SERVICE_ACCOUNT_EMAIL = 'id-791@attendance-management-467501.iam.gserviceaccount.com';

  // トースト表示を1秒間に設定
  const showToast = useCallback((title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant,
      duration: 1000,
    });
  }, [toast]);

  // スプレッドシートIDをマスクする関数
  const maskSpreadsheetId = (id: string) => {
    if (id.length <= 8) return id;
    return id.substring(0, 4) + '*'.repeat(id.length - 8) + id.substring(id.length - 4);
  };

  // サービスアカウントのメールアドレスをクリップボードにコピーする関数
  const copyServiceAccountEmail = async () => {
    try {
      await navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
      showToast("コピー完了", "サービスアカウントのメールアドレスをクリップボードにコピーしました。");
    } catch (error) {
      showToast("コピー失敗", "クリップボードへのコピーに失敗しました。手動でコピーしてください。", "destructive");
    }
  };

  // Stripe決済処理
  const handleCustomFormPayment = async () => {
    setIsProcessingPayment(true);
    try {
      // Stripe Checkoutセッションを作成
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType: 'custom_form',
          successUrl: `${window.location.origin}/admin?payment=success&type=custom_form`,
          cancelUrl: `${window.location.origin}/admin?payment=cancelled`
        }),
      });

      if (!response.ok) {
        throw new Error('決済セッションの作成に失敗しました');
      }

      const { url } = await response.json();
      
      // Stripe Checkoutページにリダイレクト
      window.location.href = url;
    } catch (error) {
      console.error('Payment error:', error);
      showToast('決済エラー', '決済処理中にエラーが発生しました', 'destructive');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // カスタムフォーム設定ダイアログを開く処理
  const handleCustomFormDialog = () => {
    // URLパラメータで決済成功をチェック
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const paymentType = urlParams.get('type');

    if (paymentStatus === 'success' && paymentType === 'custom_form') {
      // 決済成功後はカスタムフォーム作成画面を直接開く
      setIsCustomFormDialogOpen(true);
      // URLパラメータをクリア
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // 決済が必要な場合は決済画面を表示
      handleCustomFormPayment();
    }
  };

  // 講義一覧の取得
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const response = await fetch('/api/admin/courses');
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
        showToast("講義情報更新", `${data.courses?.length || 0}件の講義を読み込みました。`);
      } else {
        const errorData = await response.json();
        showToast("読み込みエラー", errorData.message || "講義情報の読み込みに失敗しました。", "destructive");
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
      fetchLocationSettings();
    }
  }, [status, fetchCourses, fetchLocationSettings]);

  // 決済結果の処理
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      showToast('決済完了', 'カスタムフォームの購入が完了しました！', 'default');
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

  // 新規講義の追加
  const handleAddCourse = async () => {
    if (!newCourse.courseName.trim() || !newCourse.teacherName.trim() || !newCourse.spreadsheetId.trim()) {
      showToast("入力エラー", "すべての必須項目を入力してください。", "destructive");
      return;
    }

    setSavingNewCourse(true);
    try {
      const response = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: newCourse.courseName.trim(),
          teacherName: newCourse.teacherName.trim(),
          spreadsheetId: newCourse.spreadsheetId.trim()
        }),
      });
      
      if (response.ok) {
        showToast("講義追加完了", "新しい講義を正常に追加しました。");
        setIsAddDialogOpen(false);
        setNewCourse({ courseName: '', teacherName: '', spreadsheetId: '' });
        await fetchCourses();
      } else {
        const errorData = await response.json();
        showToast("追加失敗", errorData.message || "講義の追加に失敗しました。", "destructive");
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
    setEditCourse({
      courseName: course.courseName,
      teacherName: course.teacherName,
      spreadsheetId: course.spreadsheetId
    });
    setIsEditDialogOpen(true);
  };

  // 講義の編集
  const handleUpdateCourse = async () => {
    if (!editingCourse || !editCourse.courseName.trim() || !editCourse.teacherName.trim() || !editCourse.spreadsheetId.trim()) {
      showToast("入力エラー", "すべての必須項目を入力してください。", "destructive");
      return;
    }

    setSavingEditCourse(true);
    try {
      const response = await fetch(`/api/admin/courses/${editingCourse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: editCourse.courseName.trim(),
          teacherName: editCourse.teacherName.trim(),
          spreadsheetId: editCourse.spreadsheetId.trim()
        }),
      });
      
      if (response.ok) {
        showToast("講義更新完了", "講義情報を正常に更新しました。");
        setIsEditDialogOpen(false);
        setEditingCourse(null);
        setEditCourse({ courseName: '', teacherName: '', spreadsheetId: '' });
        await fetchCourses();
      } else {
        const errorData = await response.json();
        showToast("更新失敗", errorData.message || "講義の更新に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to update course:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setSavingEditCourse(false);
    }
  };

  // 講義の削除
  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`講義「${courseName}」を削除してもよろしいですか？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        showToast("削除完了", "講義を正常に削除しました。");
        await fetchCourses();
      } else {
        const errorData = await response.json();
        showToast("削除失敗", errorData.message || "講義の削除に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to delete course:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    }
  };

  // コースカードコンポーネント（モバイル用）- カスタムフォーム対応
  const CourseCard = ({ course, index }: { course: Course; index: number }) => {
    const formUrl = `${window.location.origin}/attendance/${course.id}`;
    
    const copyFormUrl = async (url: string, courseName: string) => {
      try {
        await navigator.clipboard.writeText(url);
        showToast("URL コピー完了", `${courseName}のフォームURLをコピーしました。`);
      } catch (error) {
        showToast("コピー失敗", "URLのコピーに失敗しました。", "destructive");
      }
    };
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`
          border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300
          ${course.isCustomForm 
            ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-purple-100' 
            : 'bg-white border-slate-200'
          }
        `}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {course.isCustomForm ? (
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    <Crown className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{course.courseName}</h3>
                  <div className="flex items-center space-x-1">
                    <Sparkles className="h-3 w-3 text-purple-500" />
                    <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                      カスタム
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <h3 className="font-medium text-slate-900 text-sm">{course.courseName}</h3>
                </>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {new Date(course.lastUpdated).toLocaleDateString('ja-JP')}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-700">{course.teacherName}</span>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs text-slate-500">スプレッドシートID</p>
            <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 break-all block">
              {maskSpreadsheetId(course.spreadsheetId)}
            </code>
          </div>
          
          {/* フォームURL表示 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">専用フォームURL</p>
            <div className={`
              flex items-center space-x-2 p-2 rounded border
              ${course.isCustomForm 
                ? 'bg-purple-50 border-purple-200' 
                : 'bg-blue-50 border-blue-200'
              }
            `}>
              <code className={`
                flex-1 text-xs break-all
                ${course.isCustomForm ? 'text-purple-800' : 'text-blue-800'}
              `}>
                {formUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyFormUrl(formUrl, course.courseName)}
                className={`
                  flex-shrink-0 h-6 px-2
                  ${course.isCustomForm 
                    ? 'border-purple-300 text-purple-700 hover:bg-purple-100' 
                    : 'border-blue-300 text-blue-700 hover:bg-blue-100'
                  }
                `}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(formUrl, '_blank')}
              className={`
                w-full
                ${course.isCustomForm 
                  ? 'text-purple-600 border-purple-300 hover:bg-purple-50' 
                  : 'text-blue-600 border-blue-300 hover:bg-blue-50'
                }
              `}
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              フォームを開く
            </Button>
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditCourse(course)}
              className="flex-1 text-indigo-600 border-indigo-300 hover:bg-indigo-50 modern-button-secondary"
            >
              <Edit className="h-3 w-3 mr-1" />
              編集
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteCourse(course.id, course.courseName)}
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50 modern-button-secondary"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              削除
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ヘッダーセクション */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
          {/* モバイル用ヘッダー */}
          <div className="block lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br rounded-xl shadow-lg">
                  <Image
                    src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                    alt="ざせきくん"
                    width={50}
                    height={50}
                    className="rounded"
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">講義管理システム</h1>
                  <p className="text-xs text-slate-600">講義別スプレッドシート設定</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
            
            {/* モバイルメニュー */}
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pb-4 border-t border-slate-200 pt-4"
              > 
                <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 rounded-lg">
                  <User className="h-4 w-4 text-slate-600" />
                  <div className="text-sm flex-1">
                    <p className="font-medium text-slate-900">{session.user?.name}</p>
                    <p className="text-slate-600 text-xs">{session.user?.email}</p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center space-x-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>ログアウト</span>
                  </Button>
                  
                  <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-green-800">稼働中</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* デスクトップ用ヘッダー */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br rounded-xl shadow-lg">
                <Image
                  src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                  alt="ざせきくん"
                  width={50}
                  height={50}
                  className="rounded"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">講義管理システム</h1>
                <p className="text-slate-600 mt-1">講義別スプレッドシート設定とデータ管理</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-50 rounded-lg">
                <User className="h-4 w-4 text-slate-600" />
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{session.user?.name}</p>
                  <p className="text-slate-600">{session.user?.email}</p>
                </div>
              </div>
              
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>ログアウト</span>
              </Button>
              
              <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">システム稼働中</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        <Tabs defaultValue="courses" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto mb-6 sm:mb-8 bg-slate-100 p-1 rounded-lg gap-1">
            <TabsTrigger 
              value="courses" 
              className="flex flex-col items-center justify-center p-2 sm:p-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 text-xs sm:text-base min-h-[60px] sm:min-h-[48px]"
            >
              <BookOpen className="w-4 h-4 mb-1 sm:mb-0 sm:mr-2" />
              <span className="leading-tight text-center">講義</span>
            </TabsTrigger>
            <TabsTrigger 
              value="guide" 
              className="flex flex-col items-center justify-center p-2 sm:p-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 text-xs sm:text-base min-h-[60px] sm:min-h-[48px]"
            >
              <HelpCircle className="w-4 h-4 mb-1 sm:mb-0 sm:mr-2" />
              <span className="leading-tight text-center">ガイド</span>
            </TabsTrigger>
            <TabsTrigger 
              value="location" 
              className="flex flex-col items-center justify-center p-2 sm:p-3 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 text-xs sm:text-base min-h-[60px] sm:min-h-[48px]"
            >
              <MapPin className="w-4 h-4 mb-1 sm:mb-0 sm:mr-2" />
              <span className="leading-tight text-center">位置情報</span>
            </TabsTrigger>
          </TabsList>

          {/* 講義管理タブ */}
          <TabsContent value="courses" className="mt-6">
            <div className="space-y-4 sm:space-y-6">
              {/* 講義管理ヘッダー */}
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="text-center sm:text-left">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">講義管理</h2>
                  <p className="text-slate-600 mt-1 text-sm sm:text-base">各講義のスプレッドシート設定を管理します</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {/* <Button 
                    onClick={handleCustomFormDialog}
                    disabled={isProcessingPayment}
                    variant="outline" 
                    className="w-full sm:w-auto border-purple-600 text-purple-600 hover:bg-purple-50 modern-button-secondary"
                  >
                    {isProcessingPayment ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <div className="flex items-center">
                        <Sparkles className="h-4 w-4 mr-2" />
                        <Crown className="h-3 w-3 mr-1 text-yellow-500" />
                      </div>
                    )}
                    <span className="sm:hidden">カスタムフォーム</span>
                    <span className="hidden sm:inline">
                      {isProcessingPayment ? '決済処理中...' : 'カスタムフォーム設定（有料）'}
                    </span>
                  </Button> */}
                  
                  {/* 特定商取引法リンクを追加 */}
                  <Link href="/legal/tokusho" target="_blank">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto text-xs border-slate-300 text-slate-600 hover:bg-slate-50 modern-button-secondary"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      <span className="sm:hidden">特定商取引法</span>
                      <span className="hidden sm:inline">特定商取引法に基づく表記</span>
                    </Button>
                  </Link>
                  
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
                  
                  <Button 
                    className="w-full sm:w-auto modern-button-primary"
                    onClick={() => setIsAddDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="sm:hidden">講義追加</span>
                    <span className="hidden sm:inline">新規講義追加</span>
                  </Button>
                  
                  <CustomModal
                    isOpen={isAddDialogOpen}
                    onClose={() => setIsAddDialogOpen(false)}
                    title="新規講義追加"
                    description="新しい講義とそのスプレッドシート設定を追加します。講義名がシート名として使用されます。"
                    className="sm:max-w-[500px]"
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="course-name" className="text-sm font-medium">講義名 *</Label>
                        <Input
                          id="course-name"
                          placeholder="例: 経済学1"
                          value={newCourse.courseName}
                          onChange={(e) => setNewCourse({...newCourse, courseName: e.target.value})}
                          className="modern-input"
                        />
                        <p className="text-xs text-slate-500">この名前がスプレッドシートのシート名としても使用されます</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teacher-name" className="text-sm font-medium">担当教員名 *</Label>
                        <Input
                          id="teacher-name"
                          placeholder="例: 田中太郎"
                          value={newCourse.teacherName}
                          onChange={(e) => setNewCourse({...newCourse, teacherName: e.target.value})}
                          className="modern-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-spreadsheet-id" className="text-sm font-medium">スプレッドシートID *</Label>
                        <Input
                          id="new-spreadsheet-id"
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          value={newCourse.spreadsheetId}
                          onChange={(e) => setNewCourse({...newCourse, spreadsheetId: e.target.value})}
                          className="modern-input"
                        />
                      </div>
                      <div className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2 pt-4">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="modern-button-secondary w-full sm:w-auto">
                          キャンセル
                        </Button>
                        <Button onClick={handleAddCourse} disabled={savingNewCourse} className="modern-button-primary w-full sm:w-auto">
                          {savingNewCourse ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              追加中...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              追加
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CustomModal>
                </div>
              </div>

              {/* 編集ダイアログ */}
              <CustomModal
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                title="講義編集"
                description="講義情報を編集します。講義名がシート名として使用されます。"
                className="sm:max-w-[500px]"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-course-name" className="text-sm font-medium">講義名 *</Label>
                    <Input
                      id="edit-course-name"
                      placeholder="例: 経済学1"
                      value={editCourse.courseName}
                      onChange={(e) => setEditCourse({...editCourse, courseName: e.target.value})}
                      className="modern-input"
                    />
                    <p className="text-xs text-slate-500">この名前がスプレッドシートのシート名としても使用されます</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-teacher-name" className="text-sm font-medium">担当教員名 *</Label>
                    <Input
                      id="edit-teacher-name"
                      placeholder="例: 田中太郎"
                      value={editCourse.teacherName}
                      onChange={(e) => setEditCourse({...editCourse, teacherName: e.target.value})}
                      className="modern-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-spreadsheet-id" className="text-sm font-medium">スプレッドシートID *</Label>
                    <Input
                      id="edit-spreadsheet-id"
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                      value={editCourse.spreadsheetId}
                      onChange={(e) => setEditCourse({...editCourse, spreadsheetId: e.target.value})}
                      className="modern-input"
                    />
                  </div>
                  <div className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="modern-button-secondary w-full sm:w-auto">
                      キャンセル
                    </Button>
                    <Button onClick={handleUpdateCourse} disabled={savingEditCourse} className="modern-button-primary w-full sm:w-auto">
                      {savingEditCourse ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          更新中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          更新
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CustomModal>

              {/* 統計カード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 card-hover">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-900">{courses.length}</p>
                        <p className="text-sm text-blue-700">登録講義数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 card-hover">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <User className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold text-green-900">
                          {new Set(courses.map(c => c.teacherName)).size}
                        </p>
                        <p className="text-sm text-green-700">担当教員数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 card-hover">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-900">
                          {courses.filter(c => c.isCustomForm).length}
                        </p>
                        <p className="text-sm text-purple-700">カスタムフォーム</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 card-hover">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold text-orange-900">
                          {new Set(courses.map(c => c.spreadsheetId)).size}
                        </p>
                        <p className="text-sm text-orange-700">連携スプレッドシート数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 講義一覧 */}
              <Card className="bg-white shadow-lg border-0 card-hover">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-4 sm:p-6">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />
                      <div>
                        <CardTitle className="text-lg sm:text-xl font-semibold">講義一覧</CardTitle>
                        <CardDescription className="text-indigo-100 mt-1 text-sm sm:text-base">
                          登録されている講義とその設定 - 各講義専用のフォームURL付き
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={fetchCourses}
                      disabled={loadingCourses}
                      variant="secondary"
                      className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/20 modern-button-secondary"
                    >
                      {loadingCourses ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      更新
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6">
                  {loadingCourses ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
                        <p className="text-slate-600 font-medium">講義情報を読み込み中</p>
                      </div>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">登録されている講義がありません</p>
                      <p className="text-sm text-slate-500 mt-1">「新規講義追加」ボタンから講義を追加してください</p>
                    </div>
                  ) : (
                    <>
                      {/* モバイル用カード表示 */}
                      <div className="block lg:hidden space-y-4">
                        {courses.map((course, index) => (
                          <CourseCard key={course.id} course={course} index={index} />
                        ))}
                      </div>

                      {/* デスクトップ用テーブル表示 */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left p-4 font-semibold text-slate-700">講義名</th>
                              <th className="text-left p-4 font-semibold text-slate-700">担当教員</th>
                              <th className="text-left p-4 font-semibold text-slate-700">専用フォームURL</th>
                              <th className="text-left p-4 font-semibold text-slate-700">最終更新</th>
                              <th className="text-left p-4 font-semibold text-slate-700">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courses.map((course, index) => {
                              const formUrl = `${window.location.origin}/attendance/${course.id}`;
                              
                              const copyFormUrl = async () => {
                                try {
                                  await navigator.clipboard.writeText(formUrl);
                                  showToast("URL コピー完了", `${course.courseName}のフォームURLをコピーしました。`);
                                } catch (error) {
                                  showToast("コピー失敗", "URLのコピーに失敗しました。", "destructive");
                                }
                              };
                              
                              return (
                                <motion.tr
                                  key={course.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className={`
                                    border-b border-slate-100 transition-colors
                                    ${course.isCustomForm 
                                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100' 
                                      : index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100'
                                    }
                                  `}
                                >
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      {course.isCustomForm ? (
                                        <div className="flex items-center space-x-2">
                                          <div className="relative">
                                            <BookOpen className="h-4 w-4 text-purple-600" />
                                            <Crown className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
                                          </div>
                                          <span className="font-semibold text-slate-900">{course.courseName}</span>
                                          <div className="flex items-center space-x-1">
                                            <Sparkles className="h-3 w-3 text-purple-500" />
                                            <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                                              カスタム
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <BookOpen className="h-4 w-4 text-slate-400" />
                                          <span className="font-medium text-slate-900">{course.courseName}</span>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4 text-slate-400" />
                                      <span className="text-slate-700">{course.teacherName}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="space-y-2 max-w-xs">
                                      <div className={`
                                        flex items-center space-x-2 p-2 rounded border
                                        ${course.isCustomForm 
                                          ? 'bg-purple-50 border-purple-200' 
                                          : 'bg-blue-50 border-blue-200'
                                        }
                                      `}>
                                        <code className={`
                                          flex-1 text-xs break-all
                                          ${course.isCustomForm ? 'text-purple-800' : 'text-blue-800'}
                                        `}>
                                          {formUrl.length > 40 ? `${formUrl.substring(0, 40)}...` : formUrl}
                                        </code>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={copyFormUrl}
                                          className={`
                                            flex-shrink-0 h-6 px-2
                                            ${course.isCustomForm 
                                              ? 'border-purple-300 text-purple-700 hover:bg-purple-100' 
                                              : 'border-blue-300 text-blue-700 hover:bg-blue-100'
                                            }
                                          `}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(formUrl, '_blank')}
                                        className={`
                                          w-full text-xs h-7
                                          ${course.isCustomForm 
                                            ? 'text-purple-600 border-purple-300 hover:bg-purple-50' 
                                            : 'text-blue-600 border-blue-300 hover:bg-blue-50'
                                          }
                                        `}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        フォームを開く
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-sm text-slate-600">
                                      {new Date(course.lastUpdated).toLocaleDateString('ja-JP')}
                                    </span>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditCourse(course)}
                                        className="text-indigo-600 border-indigo-300 hover:bg-indigo-50 modern-button-secondary"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        編集
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteCourse(course.id, course.courseName)}
                                        className="text-red-600 border-red-300 hover:bg-red-50 modern-button-secondary"
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        削除
                                      </Button>
                                    </div>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* セットアップガイドタブ */}
          <TabsContent value="guide">
            <Card className="bg-white shadow-lg border-0 card-hover">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-700 text-white p-4 sm:p-6">
                <div className="flex items-center space-x-3">
                  <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-semibold">実装ガイド</CardTitle>
                    <CardDescription className="text-emerald-100 mt-1 text-sm sm:text-base">
                      段階的なセットアップ手順
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-6 sm:space-y-8">
                  {/* ステップ1 */}
                  <div className="relative">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-4">
                      <div className="flex-shrink-0 self-center sm:self-start">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          1
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">スプレッドシート作成</h3>
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">
                              <a 
                                href="https://sheets.google.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-medium underline"
                              >
                                Google Sheets
                              </a>
                              で新しいスプレッドシートを作成
                            </span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">わかりやすい名前を設定（例：「出席管理データ」）</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* ステップ2 */}
                  <div className="relative">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-4">
                      <div className="flex-shrink-0 self-center sm:self-start">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          2
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">アクセス権限設定</h3>
                        
                        {/* サービスアカウント表示 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <p className="font-medium text-blue-900">サービスアカウント</p>
                          </div>
                          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 p-3 bg-white border border-blue-200 rounded-lg">
                            <code className="flex-1 text-xs sm:text-sm font-mono text-slate-800 break-all select-all">
                              {SERVICE_ACCOUNT_EMAIL}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={copyServiceAccountEmail}
                              className="w-full sm:w-auto flex items-center justify-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50 modern-button-secondary"
                            >
                              <Copy className="h-4 w-4" />
                              <span>コピー</span>
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">スプレッドシートの「共有」ボタンをクリック</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">上記サービスアカウントを追加</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">権限を<strong>「編集者」</strong>に設定</span>
                          </div>
                        </div>

                        <div className="mt-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                              <strong>重要:</strong> 「閲覧者」権限では正常に動作しません。必ず「編集者」権限を設定してください。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* ステップ3 */}
                  <div className="relative">
                    <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-4">
                      <div className="flex-shrink-0 self-center sm:self-start">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          3
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">システム設定</h3>
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">「新規講義追加」ボタンから講義を登録</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">講義名がスプレッドシートのシート名として自動設定</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">URLからスプレッドシートIDを抽出</span>
                          </div>
                        </div>
                        <div className="mt-4 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-2">URL例:</p>
                          <div className="font-mono text-xs sm:text-sm text-slate-600 bg-white p-2 sm:p-3 rounded border break-all">
                            https://docs.google.com/spreadsheets/d/<span className="bg-yellow-200 px-1 rounded font-semibold">1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms</span>/edit
                          </div>
                          <p className="text-xs text-slate-500 mt-2">ハイライト部分がスプレッドシートIDです</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* データ構造 */}
                  <div className="bg-slate-50 rounded-lg p-4 sm:p-6 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">データ構造</h3>
                    <p className="text-sm sm:text-base text-slate-600 mb-4">学生の出席登録時に以下の形式で記録されます:</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-white border border-slate-200">
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">ID</th>
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">Date</th>
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">ClassName</th>
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">StudentID</th>
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">Name</th>
                            <th className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-left font-semibold text-slate-700 whitespace-nowrap">Department</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">UUID</td>
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">日付</td>
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">講義名</td>
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">学籍番号</td>
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">氏名</td>
                            <td className="border border-slate-200 px-2 py-2 sm:px-3 sm:py-2 text-slate-600 whitespace-nowrap">学科</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-3">
                      各講義ごとに講義名の形式でシートが自動作成されます
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 位置情報設定タブ */}
          <TabsContent value="location" className="space-y-4 sm:space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-hover">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-xl sm:text-2xl font-bold text-gradient flex items-center">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                    位置情報設定
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    出席登録で使用するキャンパスの位置情報を設定します。この設定は全ての講義に適用されます。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {loadingLocationSettings ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                      <span className="text-sm sm:text-base">設定を読み込み中...</span>
                    </div>
                  ) : (
                    <div className="space-y-4 sm:space-y-6">
                      {/* 現在の設定表示 */}
                      <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">現在の設定</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <span className="text-blue-700 font-medium mb-1 sm:mb-0 sm:mr-2">キャンパス名:</span>
                            <span className="font-medium break-words">
                              {locationSettings.locationName || '大分大学旦野原キャンパス'}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <span className="text-blue-700 font-medium mb-1 sm:mb-0 sm:mr-2">許可範囲:</span>
                            <span className="font-medium">{locationSettings.radius}km</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <span className="text-blue-700 font-medium mb-1 sm:mb-0 sm:mr-2">緯度:</span>
                            <span className="font-mono text-xs break-all">{locationSettings.latitude}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center">
                            <span className="text-blue-700 font-medium mb-1 sm:mb-0 sm:mr-2">経度:</span>
                            <span className="font-mono text-xs break-all">{locationSettings.longitude}</span>
                          </div>
                        </div>
                      </div>

                      {/* 位置情報設定フォーム */}
                      <LocationSettingsForm
                        initialSettings={locationSettings}
                        onSave={saveLocationSettings}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}