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
  ArrowLeft
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import Link from 'next/link';

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
    if (status === 'loading') return; // まだ読み込み中
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ヘッダーセクション */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8"> {/* Adjusted padding */}
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0"> {/* Flex direction change */}
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
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
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight text-center md:text-left">講義管理システム</h1> {/* Adjusted text size and alignment */}
                <p className="text-slate-600 mt-1 text-center md:text-left">講義別スプレッドシート設定とデータ管理</p>
              </div>
            </div>
            
            {/* ユーザー情報とログアウト */}
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 md:mt-0"> {/* Flex direction change and margin */}
              <div className="flex items-center space-x-3 px-3 py-2 bg-slate-50 rounded-lg"> {/* Adjusted padding */}
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
              
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg"> {/* Adjusted padding */}
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">システム稼働中</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:px-6 md:py-8"> {/* Adjusted padding */}
        <Tabs defaultValue="courses" className="w-full">
          <TabsList className="flex flex-col sm:flex-row w-full mb-8 space-y-2 sm:space-y-0 sm:space-x-2 bg-slate-100 p-2 rounded-lg">
            <TabsTrigger 
              value="courses" 
              className="flex items-center justify-center space-x-2 py-4 px-6 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span>講義管理</span>
            </TabsTrigger>
            <TabsTrigger 
              value="guide" 
              className="flex items-center justify-center space-x-2 py-4 px-6 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <HelpCircle className="h-4 w-4" />
              <span>セットアップガイド</span>
            </TabsTrigger>
          </TabsList>

          {/* 講義管理タブ */}
          <TabsContent value="courses" className="mt-6">
            <div className="space-y-6">
              {/* 講義管理ヘッダー */}
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0"> {/* Flex direction change */}
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center sm:text-left">講義管理</h2> {/* Adjusted text size and alignment */}
                  <p className="text-slate-600 mt-1 text-center sm:text-left">各講義のスプレッドシート設定を管理します</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white"> {/* Full width on small screens */}
                      <Plus className="h-4 w-4 mr-2" />
                      新規講義追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>新規講義追加</DialogTitle>
                      <DialogDescription>
                        新しい講義とそのスプレッドシート設定を追加します。講義名がシート名として使用されます。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="course-name">講義名 *</Label>
                        <Input
                          id="course-name"
                          placeholder="例: 経済学1"
                          value={newCourse.courseName}
                          onChange={(e) => setNewCourse({...newCourse, courseName: e.target.value})}
                        />
                        <p className="text-xs text-slate-500">この名前がスプレッドシートのシート名としても使用されます</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teacher-name">担当教員名 *</Label>
                        <Input
                          id="teacher-name"
                          placeholder="例: 田中太郎"
                          value={newCourse.teacherName}
                          onChange={(e) => setNewCourse({...newCourse, teacherName: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-spreadsheet-id">スプレッドシートID *</Label>
                        <Input
                          id="new-spreadsheet-id"
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          value={newCourse.spreadsheetId}
                          onChange={(e) => setNewCourse({...newCourse, spreadsheetId: e.target.value})}
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"> {/* Responsive buttons */}
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="w-full sm:w-auto mt-2 sm:mt-0">
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
              </div>

              {/* 編集ダイアログ */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>講義編集</DialogTitle>
                    <DialogDescription>
                      講義情報を編集します。講義名がシート名として使用されます。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-course-name">講義名 *</Label>
                      <Input
                        id="edit-course-name"
                        placeholder="例: 経済学1"
                        value={editCourse.courseName}
                        onChange={(e) => setEditCourse({...editCourse, courseName: e.target.value})}
                      />
                      <p className="text-xs text-slate-500">この名前がスプレッドシートのシート名としても使用されます</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-teacher-name">担当教員名 *</Label>
                      <Input
                        id="edit-teacher-name"
                        placeholder="例: 田中太郎"
                        value={editCourse.teacherName}
                        onChange={(e) => setEditCourse({...editCourse, teacherName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-spreadsheet-id">スプレッドシートID *</Label>
                      <Input
                        id="edit-spreadsheet-id"
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                        value={editCourse.spreadsheetId}
                        onChange={(e) => setEditCourse({...editCourse, spreadsheetId: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"> {/* Responsive buttons */}
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto mt-2 sm:mt-0">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6"> {/* Adjusted gap */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-4 md:p-6"> {/* Adjusted padding */}
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="h-5 w-5 md:h-6 md:w-6" /> {/* Adjusted icon size */}
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-bold text-blue-900">{courses.length}</p> {/* Adjusted text size */}
                        <p className="text-sm text-blue-700">登録講義数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-4 md:p-6"> {/* Adjusted padding */}
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <User className="h-5 w-5 md:h-6 md:w-6" /> {/* Adjusted icon size */}
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-bold text-green-900">
                          {new Set(courses.map(c => c.teacherName)).size}
                        </p>
                        <p className="text-sm text-green-700">担当教員数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
                  <CardContent className="p-4 md:p-6"> {/* Adjusted padding */}
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <BookOpen className="h-5 w-5 md:h-6 md:w-6" /> {/* Adjusted icon size */}
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-bold text-purple-900">
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
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-4 md:p-6"> {/* Adjusted padding */}
                  <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0"> {/* Flex direction change */}
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-5 w-5 md:h-6 md:w-6" /> {/* Adjusted icon size */}
                      <div>
                        <CardTitle className="text-lg md:text-xl font-semibold">講義一覧</CardTitle> {/* Adjusted text size */}
                        <CardDescription className="text-indigo-100 mt-1">
                          登録されている講義とその設定
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
                
                <CardContent className="p-4 md:p-6"> {/* Adjusted padding */}
                  {loadingCourses ? (
                    <div className="flex items-center justify-center py-8 md:py-12"> {/* Adjusted padding */}
                      <div className="text-center space-y-3">
                        <RefreshCw className="h-6 w-6 md:h-8 md:w-8 animate-spin text-indigo-500 mx-auto" /> {/* Adjusted icon size */}
                        <p className="text-slate-600 font-medium">講義情報を読み込み中</p>
                      </div>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="text-center py-8 md:py-12"> {/* Adjusted padding */}
                      <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-slate-400 mx-auto mb-4" /> {/* Adjusted icon size */}
                      <p className="text-slate-600 font-medium">登録されている講義がありません</p>
                      <p className="text-sm text-slate-500 mt-1">「新規講義追加」ボタンから講義を追加してください</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left p-3 md:p-4 font-semibold text-slate-700">講義名</th>
                            <th className="text-left p-3 md:p-4 font-semibold text-slate-700">担当教員</th>
                            <th className="text-left p-3 md:p-4 font-semibold text-slate-700">スプレッドシートID</th>
                            <th className="text-left p-3 md:p-4 font-semibold text-slate-700">最終更新</th>
                            <th className="text-left p-3 md:p-4 font-semibold text-slate-700">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course, index) => (
                            <tr key={course.id} className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                  <BookOpen className="h-4 w-4 text-slate-400" />
                                  <span className="font-medium text-slate-900">{course.courseName}</span>
                                </div>
                              </td>
                              <td className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                  <User className="h-4 w-4 text-slate-400" />
                                  <span className="text-slate-700">{course.teacherName}</span>
                                </div>
                              </td>
                              <td className="p-3 md:p-4">
                                <code className="text-xs md:text-sm bg-slate-100 px-2 py-1 rounded text-slate-700 break-all">
                                  {maskSpreadsheetId(course.spreadsheetId)}
                                </code>
                              </td>
                              <td className="p-3 md:p-4">
                                <span className="text-xs md:text-sm text-slate-600">
                                  {new Date(course.lastUpdated).toLocaleDateString('ja-JP')}
                                </span>
                              </td>
                              <td className="p-3 md:p-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditCourse(course)}
                                    className="w-full sm:w-auto text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    編集
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteCourse(course.id, course.courseName)}
                                    className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    削除
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* セットアップガイドタブ */}
          <TabsContent value="guide">
            <Card className="bg-white shadow-lg border-0 h-fit">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-700 text-white p-4 md:p-6"> {/* Adjusted padding */}
                <div className="flex items-center space-x-3">
                  <HelpCircle className="h-5 w-5 md:h-6 md:w-6" /> {/* Adjusted icon size */}
                  <div>
                    <CardTitle className="text-lg md:text-xl font-semibold">実装ガイド</CardTitle> {/* Adjusted text size */}
                    <CardDescription className="text-emerald-100 mt-1">
                      段階的なセットアップ手順
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4 md:p-6"> {/* Adjusted padding */}
                <div className="space-y-6 md:space-y-8"> {/* Adjusted spacing */}
                  {/* ステップ1 */}
                  <div className="relative">
                    <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4"> {/* Responsive flex */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base"> {/* Adjusted size and text size */}
                          1
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-2 md:mb-3">スプレッドシート作成</h3> {/* Adjusted text size */}
                        <div className="space-y-2 md:space-y-3"> {/* Adjusted spacing */}
                          <div className="flex items-start space-x-3"> {/* Align items-start for long text */}
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" /> {/* Flex-shrink and margin top for icon alignment */}
                            <span className="text-sm md:text-base text-slate-700"> {/* Adjusted text size */}
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
                            <span className="text-sm md:text-base text-slate-700">わかりやすい名前を設定（例：「出席管理データ」）</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">URLからスプレッドシートIDを抽出</span>
                          </div>
                        </div>
                        <div className="mt-3 md:mt-4 p-3 md:p-4 bg-slate-50 rounded-lg border border-slate-200"> {/* Adjusted padding and margin */}
                          <p className="text-xs md:text-sm font-medium text-slate-700 mb-1 md:mb-2">URL例:</p> {/* Adjusted text size */}
                          <div className="font-mono text-xs md:text-sm text-slate-600 bg-white p-2 md:p-3 rounded border break-all"> {/* Adjusted text size and padding */}
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
                    <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4"> {/* Responsive flex */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base"> {/* Adjusted size and text size */}
                          2
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-2 md:mb-3">アクセス権限設定</h3> {/* Adjusted text size */}
                        
                        {/* サービスアカウント表示 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4 mb-3 md:mb-4"> {/* Adjusted padding and margin */}
                          <div className="flex items-center space-x-2 mb-2 md:mb-3"> {/* Adjusted spacing and margin */}
                            <Shield className="h-4 w-4 md:h-5 md:w-5 text-blue-600" /> {/* Adjusted icon size */}
                            <p className="font-medium text-blue-900 text-sm md:text-base">サービスアカウント</p> {/* Adjusted text size */}
                          </div>
                          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 p-2 md:p-3 bg-white border border-blue-200 rounded-lg"> {/* Responsive flex and padding */}
                            <code className="flex-1 text-xs md:text-sm font-mono text-slate-800 break-all select-all"> {/* Adjusted text size */}
                              {SERVICE_ACCOUNT_EMAIL}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={copyServiceAccountEmail}
                              className="w-full sm:w-auto flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-3 py-2"
                            >
                              <Copy className="h-4 w-4" />
                              <span>コピー</span>
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 md:space-y-3"> {/* Adjusted spacing */}
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">スプレッドシートの「共有」ボタンをクリック</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">上記サービスアカウントを追加</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">権限を<strong>「編集者」</strong>に設定</span>
                          </div>
                        </div>

                        <div className="mt-3 md:mt-4 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-lg"> {/* Adjusted padding and margin */}
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-amber-600 flex-shrink-0" /> {/* Adjusted icon size */}
                            <p className="text-xs md:text-sm text-amber-800">
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
                    <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4"> {/* Responsive flex */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base"> {/* Adjusted size and text size */}
                          3
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-2 md:mb-3">システム設定</h3> {/* Adjusted text size */}
                        <div className="space-y-2 md:space-y-3"> {/* Adjusted spacing */}
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">「新規講義追加」ボタンから講義を登録</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">講義名がスプレッドシートのシート名として自動設定</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />
                            <span className="text-sm md:text-base text-slate-700">スプレッドシートIDは他の教員から見えないよう保護</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* データ構造 */}
                  <div className="bg-slate-50 rounded-lg p-3 md:p-6 border border-slate-200"> {/* Adjusted padding */}
                    <h3 className="text-base md:text-lg font-semibold text-slate-900 mb-3 md:mb-4">データ構造</h3> {/* Adjusted text size */}
                    <p className="text-sm md:text-base text-slate-600 mb-3 md:mb-4">学生の出席登録時に以下の形式で記録されます:</p> {/* Adjusted text size */}
                    <div className="overflow-x-auto"> {/* Added for horizontal scrolling on small screens */}
                      <table className="min-w-full text-sm border-collapse"> {/* Added min-width and adjusted text size */}
                        <thead>
                          <tr className="bg-white border border-slate-200">
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">ID</th> {/* Adjusted padding */}
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">Date</th> {/* Adjusted padding */}
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">ClassName</th> {/* Adjusted padding */}
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">StudentID</th> {/* Adjusted padding */}
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">Name</th> {/* Adjusted padding */}
                            <th className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-left font-semibold text-slate-700">Department</th> {/* Adjusted padding */}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">UUID</td> {/* Adjusted padding */}
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">日付</td> {/* Adjusted padding */}
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">講義名</td> {/* Adjusted padding */}
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">学籍番号</td> {/* Adjusted padding */}
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">氏名</td> {/* Adjusted padding */}
                            <td className="border border-slate-200 px-2 py-2 md:px-3 md:py-2 text-slate-600">学科</td> {/* Adjusted padding */}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs md:text-sm text-slate-500 mt-2 md:mt-3"> {/* Adjusted text size and margin */}
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