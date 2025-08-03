'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  QrCode,
  Download
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect as useEffectQR, useRef } from 'react';

interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  spreadsheetId: string;
  defaultSheetName: string;
  createdBy: string;
  createdAt: string;
  lastUpdated: string;
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

  // QRコード用の状態
  const [isQRDialogOpen, setIsQRDialogOpen] = useState<boolean>(false);
  const [selectedCourseForQR, setSelectedCourseForQR] = useState<Course | null>(null);
  const [qrCodeLoading, setQrCodeLoading] = useState<boolean>(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // QRコード生成関数（デバッグ強化版）
  const generateQRCode = useCallback(async (text: string, canvas: HTMLCanvasElement) => {
    console.log('QRコード生成開始 - URL:', text);
    console.log('キャンバス要素:', canvas);
    setQrCodeLoading(true);
    
    try {
      // まず手動でQRコードパターンを描画してキャンバスが動作するかテスト
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('キャンバスコンテキストが取得できません');
      }
      console.log('キャンバスコンテキスト取得成功');
      
      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 複数のCDNを試行
      const cdnUrls = [
        'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js',
        'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
        'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
      ];
      
      let QRCode = (window as any).QRCode;
      
      if (!QRCode) {
        console.log('QRCodeライブラリが見つかりません。CDNから読み込み中...');
        
        for (const url of cdnUrls) {
          try {
            console.log('CDN試行中:', url);
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = url;
              script.async = true;
              script.onload = () => {
                console.log('CDN読み込み成功:', url);
                resolve();
              };
              script.onerror = () => {
                console.log('CDN読み込み失敗:', url);
                reject(new Error(`CDN読み込み失敗: ${url}`));
              };
              document.head.appendChild(script);
            });
            
            QRCode = (window as any).QRCode;
            if (QRCode) {
              console.log('QRCodeライブラリ読み込み成功');
              break;
            }
          } catch (error) {
            console.log('CDN読み込みエラー:', error);
            continue;
          }
        }
      }

      if (!QRCode) {
        console.error('すべてのCDNからの読み込みに失敗');
        // フォールバック：手動でシンプルなQRコードパターンを描画
        drawFallbackQR(ctx, canvas.width, canvas.height);
        return;
      }

      console.log('QRCode.toCanvas実行中...');
      await QRCode.toCanvas(canvas, text, {
        width: 256,
        height: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      console.log('QRコード生成成功');
    } catch (error) {
      console.error('QRコード生成エラー:', error);
      showToast("QRコード生成エラー", "QRコードの生成に失敗しました。コンソールでエラーを確認してください。", "destructive");
      
      // エラー時の表示
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawErrorDisplay(ctx, canvas.width, canvas.height);
      }
    } finally {
      setQrCodeLoading(false);
    }
  }, [showToast]);

  // フォールバック用のQRコードパターン描画
  const drawFallbackQR = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    console.log('フォールバックQRコードを描画');
    // 背景を白で塗りつぶし
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    
    // 黒い正方形でシンプルなQRコードパターンを模倣
    ctx.fillStyle = '#000000';
    const blockSize = width / 21; // 21x21のグリッド
    
    // 角の検出パターンを描画
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if ((i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          ctx.fillRect(i * blockSize, j * blockSize, blockSize, blockSize);
          ctx.fillRect((width - (7 - i) * blockSize), j * blockSize, blockSize, blockSize);
          ctx.fillRect(i * blockSize, (height - (7 - j) * blockSize), blockSize, blockSize);
        }
      }
    }
    
    // 中央にテキストを表示
    ctx.fillStyle = '#666666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QRコード', width / 2, height / 2 - 10);
    ctx.fillText('生成中...', width / 2, height / 2 + 10);
  };

  // エラー表示用の関数
  const drawErrorDisplay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#374151';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QRコード生成エラー', width / 2, height / 2 - 10);
    ctx.fillText('再試行してください', width / 2, height / 2 + 10);
  };

  // QRコードダイアログを開く
  const handleShowQRCode = async (course: Course) => {
    setSelectedCourseForQR(course);
    setIsQRDialogOpen(true);
  };

  // QRコードをダウンロード
  const downloadQRCode = () => {
    if (qrCanvasRef.current && selectedCourseForQR) {
      try {
        const link = document.createElement('a');
        link.download = `${selectedCourseForQR.courseName}_QRコード.png`;
        link.href = qrCanvasRef.current.toDataURL('image/png');
        link.click();
        showToast("ダウンロード完了", `${selectedCourseForQR.courseName}のQRコードをダウンロードしました。`);
      } catch (error) {
        console.error('QRコードダウンロードエラー:', error);
        showToast("ダウンロード失敗", "QRコードのダウンロードに失敗しました。", "destructive");
      }
    }
  };

  // QRコードダイアログが開かれた時の処理（高速化版）
  useEffectQR(() => {
    if (isQRDialogOpen && selectedCourseForQR && qrCanvasRef.current) {
      const formUrl = `${window.location.origin}/attendance/${selectedCourseForQR.id}`;
      console.log('⚡ QRコードダイアログ開かれた - 即座に生成開始:', formUrl);
      
      // 非同期関数を即座に実行（遅延なし）
      (async () => {
        try {
          // 最小限の遅延のみ（DOM準備完了確認）
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (qrCanvasRef.current) {
            console.log('🚀 generateQRCode即座実行');
            await generateQRCode(formUrl, qrCanvasRef.current);
            console.log('✅ generateQRCode完了');
          } else {
            console.error('❌ キャンバス参照が見つかりません');
          }
        } catch (error) {
          console.error('❌ QRコード生成で例外が発生:', error);
        }
      })();
    }
  }, [isQRDialogOpen, selectedCourseForQR, generateQRCode]);

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

  // 認証チェック
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // 初期データ取得
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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

  // コースカードコンポーネント（モバイル用）
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
        className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-slate-400" />
              <h3 className="font-medium text-slate-900 text-sm">{course.courseName}</h3>
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
            <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border">
              <code className="flex-1 text-xs text-blue-800 break-all">
                {formUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyFormUrl(formUrl, course.courseName)}
                className="flex-shrink-0 h-7 px-2 border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(formUrl, '_blank')}
              className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <ExternalLink className="h-3 w-3 mr-2" />
              フォームを開く
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleShowQRCode(course)}
              className="w-full text-green-600 border-green-300 hover:bg-green-50"
            >
              <QrCode className="h-3 w-3 mr-2" />
              QRコード表示
            </Button>
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditCourse(course)}
              className="flex-1 text-indigo-600 border-indigo-300 hover:bg-indigo-50"
            >
              <Edit className="h-3 w-3 mr-1" />
              編集
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDeleteCourse(course.id, course.courseName)}
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
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
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                  <Settings className="h-6 w-6 text-white" />
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
                <Link href="/">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-slate-800">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    出席管理画面に戻る
                  </Button>
                </Link>
                
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
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  出席管理画面に戻る
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                <Settings className="h-8 w-8 text-white" />
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
          <TabsList className="w-full mb-6 sm:mb-8 bg-slate-100 p-1 rounded-lg">
            <TabsTrigger 
              value="courses" 
              className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">講義管理</span>
              <span className="sm:hidden">講義</span>
            </TabsTrigger>
            <TabsTrigger 
              value="guide" 
              className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">セットアップガイド</span>
              <span className="sm:hidden">ガイド</span>
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
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="sm:hidden">講義追加</span>
                      <span className="hidden sm:inline">新規講義追加</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="mx-4 sm:mx-auto sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl">新規講義追加</DialogTitle>
                      <DialogDescription className="text-sm sm:text-base">
                        新しい講義とそのスプレッドシート設定を追加します。講義名がシート名として使用されます。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="course-name" className="text-sm font-medium">講義名 *</Label>
                        <Input
                          id="course-name"
                          placeholder="例: 経済学1"
                          value={newCourse.courseName}
                          onChange={(e) => setNewCourse({...newCourse, courseName: e.target.value})}
                          className="w-full"
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
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-spreadsheet-id" className="text-sm font-medium">スプレッドシートID *</Label>
                        <Input
                          id="new-spreadsheet-id"
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          value={newCourse.spreadsheetId}
                          onChange={(e) => setNewCourse({...newCourse, spreadsheetId: e.target.value})}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto">
                        キャンセル
                      </Button>
                      <Button onClick={handleAddCourse} disabled={savingNewCourse} className="w-full sm:w-auto">
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
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

              {/* QRコード表示ダイアログ（デバッグ強化版） */}
              <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
                <DialogContent className="mx-4 sm:mx-auto sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl flex items-center space-x-2">
                      <QrCode className="h-5 w-5 text-green-600" />
                      <span>QRコード</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-base">
                      {selectedCourseForQR ? `「${selectedCourseForQR.courseName}」の出席フォーム用QRコード` : 'QRコード'}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="py-6">
                    <div className="flex flex-col items-center space-y-4">
                      {/* QRコード表示エリア */}
                      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm relative">
                        {qrCodeLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                            <div className="flex flex-col items-center space-y-2">
                              <RefreshCw className="h-6 w-6 animate-spin text-green-600" />
                              <span className="text-sm text-slate-600">QRコード生成中...</span>
                            </div>
                          </div>
                        )}
                        <canvas
                          ref={qrCanvasRef}
                          width={256}
                          height={256}
                          className="block border border-gray-200"
                          style={{ width: '200px', height: '200px' }}
                          onLoad={() => console.log('キャンバス読み込み完了')}
                        />
                        {/* デバッグ情報表示 */}
                        <div className="mt-2 text-xs text-gray-500 text-center">
                          Canvas: {qrCanvasRef.current ? '準備完了' : '未準備'} | 
                          Loading: {qrCodeLoading ? 'はい' : 'いいえ'}
                        </div>
                      </div>
                      
                      {/* URL表示 */}
                      {selectedCourseForQR && (
                        <div className="w-full">
                          <p className="text-xs text-slate-500 mb-2 text-center">フォームURL</p>
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-center">
                            <code className="text-xs text-slate-700 break-all">
                              {`${window.location.origin}/attendance/${selectedCourseForQR.id}`}
                            </code>
                          </div>
                        </div>
                      )}
                      
                      {/* 使用方法 */}
                      <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">使用方法</h4>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li>• 学生にQRコードをスクリーンで表示</li>
                          <li>• スマートフォンのカメラでスキャン</li>
                          <li>• 自動的に出席フォームが開きます</li>
                        </ul>
                      </div>

                      {/* デバッグボタン */}
                      <Button
                        onClick={() => {
                          if (selectedCourseForQR && qrCanvasRef.current) {
                            const formUrl = `${window.location.origin}/attendance/${selectedCourseForQR.id}`;
                            console.log('手動QRコード生成トリガー');
                            generateQRCode(formUrl, qrCanvasRef.current);
                          }
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        手動生成（デバッグ用）
                      </Button>
                    </div>
                  </div>
                  
                  <DialogFooter className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsQRDialogOpen(false)} 
                      className="w-full sm:w-auto"
                    >
                      閉じる
                    </Button>
                    <Button 
                      onClick={downloadQRCode}
                      disabled={qrCodeLoading}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      QRコードをダウンロード
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>

              {/* 編集ダイアログ */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="mx-4 sm:mx-auto sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">講義編集</DialogTitle>
                    <DialogDescription className="text-sm sm:text-base">
                      講義情報を編集します。講義名がシート名として使用されます。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-course-name" className="text-sm font-medium">講義名 *</Label>
                      <Input
                        id="edit-course-name"
                        placeholder="例: 経済学1"
                        value={editCourse.courseName}
                        onChange={(e) => setEditCourse({...editCourse, courseName: e.target.value})}
                        className="w-full"
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
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-spreadsheet-id" className="text-sm font-medium">スプレッドシートID *</Label>
                      <Input
                        id="edit-spreadsheet-id"
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                        value={editCourse.spreadsheetId}
                        onChange={(e) => setEditCourse({...editCourse, spreadsheetId: e.target.value})}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto">
                      キャンセル
                    </Button>
                    <Button onClick={handleUpdateCourse} disabled={savingEditCourse} className="w-full sm:w-auto">
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
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 統計カード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
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
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
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
                <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 sm:col-span-2 lg:col-span-1">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <div>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-900">
                          {new Set(courses.map(c => c.spreadsheetId)).size}
                        </p>
                        <p className="text-sm text-purple-700">連携スプレッドシート数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 講義一覧 */}
              <Card className="bg-white shadow-lg border-0">
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
                      className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/20"
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
                                  className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                >
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <BookOpen className="h-4 w-4 text-slate-400" />
                                      <span className="font-medium text-slate-900">{course.courseName}</span>
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
                                      <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border border-blue-200">
                                        <code className="flex-1 text-xs text-blue-800 break-all">
                                          {formUrl.length > 40 ? `${formUrl.substring(0, 40)}...` : formUrl}
                                        </code>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={copyFormUrl}
                                          className="flex-shrink-0 h-6 px-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(formUrl, '_blank')}
                                        className="w-full text-xs text-blue-600 border-blue-300 hover:bg-blue-50 h-7"
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        フォームを開く
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleShowQRCode(course)}
                                        className="w-full text-xs text-green-600 border-green-300 hover:bg-green-50 h-7"
                                      >
                                        <QrCode className="h-3 w-3 mr-1" />
                                        QRコード
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
                                        className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        編集
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeleteCourse(course.id, course.courseName)}
                                        className="text-red-600 border-red-300 hover:bg-red-50"
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
            <Card className="bg-white shadow-lg border-0">
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
                                className="text-indigo-600 hover:text-indigo-800 underline font-medium inline-flex items-center space-x-1"
                              >
                                <span>Google Sheets</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              で新しいスプレッドシートを作成
                            </span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm sm:text-base text-slate-700">わかりやすい名前を設定（例：「出席管理データ」）</span>
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
                              className="w-full sm:w-auto flex items-center justify-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50"
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
                            <span className="text-sm sm:text-base text-slate-700">スプレッドシートIDは他の教員から見えないよう保護</span>
                          </div>
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
        </Tabs>
      </div>
    </div>
  );
}