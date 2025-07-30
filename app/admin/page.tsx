'use client';

import { useState, useEffect } from 'react';
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
  Database, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Info,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  BookOpen,
  User,
  GraduationCap
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  spreadsheetId: string;
  defaultSheetName: string;
  createdAt: string;
  lastUpdated: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  
  // 全体設定用の状態
  const [globalSpreadsheetId, setGlobalSpreadsheetId] = useState<string>('');
  const [globalDefaultSheetName, setGlobalDefaultSheetName] = useState<string>('Attendance');
  const [loadingGlobalSettings, setLoadingGlobalSettings] = useState<boolean>(true);
  const [savingGlobal, setSavingGlobal] = useState<boolean>(false);

  // 講義管理用の状態
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  
  // 新規講義追加用の状態
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false);
  const [newCourse, setNewCourse] = useState({
    courseName: '',
    teacherName: '',
    spreadsheetId: '',
    defaultSheetName: 'Attendance'
  });
  const [savingNewCourse, setSavingNewCourse] = useState<boolean>(false);

  const SERVICE_ACCOUNT_EMAIL = 'id-791@attendance-management-467501.iam.gserviceaccount.com';

  // トースト表示を1秒間に設定
  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant,
      duration: 1000,
    });
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

  // 全体設定の取得
  const fetchGlobalSettings = async () => {
    setLoadingGlobalSettings(true);
    try {
      const response = await fetch('/api/admin/global-settings');
      if (response.ok) {
        const data = await response.json();
        setGlobalSpreadsheetId(data.globalSpreadsheetId || '');
        setGlobalDefaultSheetName(data.globalDefaultSheetName || 'Attendance');
        showToast("設定読み込み完了", "全体設定を正常に読み込みました。");
      } else {
        const errorData = await response.json();
        showToast("読み込みエラー", errorData.message || "設定の読み込みに失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to fetch global settings:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setLoadingGlobalSettings(false);
    }
  };

  // 全体設定の保存
  const handleSaveGlobalSettings = async () => {
    if (!globalSpreadsheetId.trim()) {
      showToast("入力エラー", "デフォルトスプレッドシートIDを入力してください。", "destructive");
      return;
    }

    setSavingGlobal(true);
    try {
      const response = await fetch('/api/admin/global-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          globalSpreadsheetId: globalSpreadsheetId.trim(),
          globalDefaultSheetName: globalDefaultSheetName.trim() || 'Attendance'
        }),
      });
      
      if (response.ok) {
        showToast("保存完了", "全体設定を正常に保存しました。");
        await fetchGlobalSettings();
      } else {
        const errorData = await response.json();
        showToast("保存失敗", errorData.message || "設定の保存に失敗しました。", "destructive");
      }
    } catch (error) {
      console.error('Failed to save global settings:', error);
      showToast("通信エラー", "サーバーとの通信中にエラーが発生しました。", "destructive");
    } finally {
      setSavingGlobal(false);
    }
  };

  // 講義一覧の取得
  const fetchCourses = async () => {
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
          spreadsheetId: newCourse.spreadsheetId.trim(),
          defaultSheetName: newCourse.defaultSheetName.trim() || 'Attendance'
        }),
      });
      
      if (response.ok) {
        showToast("講義追加完了", "新しい講義を正常に追加しました。");
        setIsAddDialogOpen(false);
        setNewCourse({ courseName: '', teacherName: '', spreadsheetId: '', defaultSheetName: 'Attendance' });
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

  useEffect(() => {
    fetchGlobalSettings();
    fetchCourses();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ヘッダーセクション */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">講義管理システム</h1>
                <p className="text-slate-600 mt-1">講義別スプレッドシート設定とデータ管理</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="courses" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="courses" className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>講義管理</span>
            </TabsTrigger>
            <TabsTrigger value="global" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>全体設定</span>
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex items-center space-x-2">
              <HelpCircle className="h-4 w-4" />
              <span>セットアップガイド</span>
            </TabsTrigger>
          </TabsList>

          {/* 講義管理タブ */}
          <TabsContent value="courses">
            <div className="space-y-6">
              {/* 講義管理ヘッダー */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">講義管理</h2>
                  <p className="text-slate-600 mt-1">各講義のスプレッドシート設定を管理します</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      新規講義追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>新規講義追加</DialogTitle>
                      <DialogDescription>
                        新しい講義とそのスプレッドシート設定を追加します。
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
                      <div className="space-y-2">
                        <Label htmlFor="new-sheet-name">デフォルトシート名</Label>
                        <Input
                          id="new-sheet-name"
                          placeholder="Attendance"
                          value={newCourse.defaultSheetName}
                          onChange={(e) => setNewCourse({...newCourse, defaultSheetName: e.target.value})}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        キャンセル
                      </Button>
                      <Button onClick={handleAddCourse} disabled={savingNewCourse}>
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

              {/* 統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-900">{courses.length}</p>
                        <p className="text-sm text-blue-700">登録講義数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <User className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-900">
                          {new Set(courses.map(c => c.teacherName)).size}
                        </p>
                        <p className="text-sm text-green-700">担当教員数</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Database className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-900">
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
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <GraduationCap className="h-6 w-6" />
                      <div>
                        <CardTitle className="text-xl font-semibold">講義一覧</CardTitle>
                        <CardDescription className="text-indigo-100 mt-1">
                          登録されている講義とその設定
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={fetchCourses}
                      disabled={loadingCourses}
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20"
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
                
                <CardContent className="p-6">
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
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left p-4 font-semibold text-slate-700">講義名</th>
                            <th className="text-left p-4 font-semibold text-slate-700">担当教員</th>
                            <th className="text-left p-4 font-semibold text-slate-700">スプレッドシートID</th>
                            <th className="text-left p-4 font-semibold text-slate-700">シート名</th>
                            <th className="text-left p-4 font-semibold text-slate-700">最終更新</th>
                            <th className="text-left p-4 font-semibold text-slate-700">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course, index) => (
                            <tr key={course.id} className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
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
                                <code className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-700 break-all">
                                  {course.spreadsheetId}
                                </code>
                              </td>
                              <td className="p-4">
                                <span className="text-sm text-slate-600">{course.defaultSheetName}</span>
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

          {/* 全体設定タブ */}
          <TabsContent value="global">
            <div className="space-y-6">
              {/* 全体設定ヘッダー */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">全体設定</h2>
                  <p className="text-slate-600 mt-1">システム全体の設定を管理します</p>
                </div>
              </div>

              {/* 全体設定フォーム */}
              <Card className="bg-white shadow-lg border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Database className="h-6 w-6" />
                      <div>
                        <CardTitle className="text-xl font-semibold">データ連携設定</CardTitle>
                        <CardDescription className="text-indigo-100 mt-1">
                          全体設定としてのGoogleスプレッドシート設定
                        </CardDescription>
                      </div>
                    </div>
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Zap className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  {loadingGlobalSettings ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
                        <p className="text-slate-600 font-medium">設定を読み込み中</p>
                        <p className="text-sm text-slate-500">少々お待ちください...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* デフォルトスプレッドシートID入力 */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="global-spreadsheet-id" className="text-slate-900 font-semibold text-base">
                            デフォルトスプレッドシートID
                          </Label>
                          <div className="px-2 py-1 bg-red-50 border border-red-200 rounded text-xs font-medium text-red-700">
                            必須
                          </div>
                        </div>
                        <Input
                          id="global-spreadsheet-id"
                          type="text"
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          value={globalSpreadsheetId}
                          onChange={(e) => setGlobalSpreadsheetId(e.target.value)}
                          className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-base h-12 px-4 rounded-lg shadow-sm"
                        />
                        <div className="flex items-start space-x-2">
                          <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-600">
                            全ての講義で共通のスプレッドシートIDを設定します。
                          </p>
                        </div>
                      </div>

                      <Separator className="bg-slate-200" />

                      {/* デフォルトシート名入力 */}
                      <div className="space-y-3">
                        <Label htmlFor="global-sheet-name" className="text-slate-900 font-semibold text-base">
                          デフォルトシート名
                        </Label>
                        <Input
                          id="global-sheet-name"
                          type="text"
                          placeholder="Attendance"
                          value={globalDefaultSheetName}
                          onChange={(e) => setGlobalDefaultSheetName(e.target.value)}
                          className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-base h-12 px-4 rounded-lg shadow-sm"
                        />
                        <div className="flex items-start space-x-2">
                          <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-slate-600">
                            全ての講義で共通のデフォルトシート名を設定します。
                          </p>
                        </div>
                      </div>

                      <Separator className="bg-slate-200" />

                      {/* アクションボタン */}
                      <div className="space-y-4">
                        <Button 
                          onClick={handleSaveGlobalSettings} 
                          disabled={savingGlobal || !globalSpreadsheetId.trim()}
                          className="w-full bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white font-semibold py-4 text-base rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                          size="lg"
                        >
                          {savingGlobal ? (
                            <>
                              <RefreshCw className="h-5 w-5 animate-spin mr-3" />
                              設定を保存中...
                            </>
                          ) : (
                            <>
                              <Save className="h-5 w-5 mr-3" />
                              設定を保存
                            </>
                          )}
                        </Button>

                        <Button 
                          onClick={fetchGlobalSettings} 
                          variant="outline"
                          disabled={loadingGlobalSettings}
                          className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 font-medium py-4 rounded-lg transition-all duration-200"
                          size="lg"
                        >
                          <RefreshCw className="h-5 w-5 mr-3" />
                          設定を再読み込み
                        </Button>
                      </div>

                      {/* 現在の設定表示 */}
                      {globalSpreadsheetId && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                          <div className="flex items-center space-x-3 mb-4">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                            <h4 className="font-semibold text-green-900 text-lg">設定確認</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="bg-white/50 rounded-lg p-4">
                                <p className="text-sm font-medium text-green-800 mb-1">デフォルトスプレッドシートID</p>
                                <p className="text-green-900 font-mono text-sm break-all">{globalSpreadsheetId}</p>
                              </div>
                              <div className="bg-white/50 rounded-lg p-4">
                                <p className="text-sm font-medium text-green-800 mb-1">デフォルトシート名</p>
                                <p className="text-green-900 font-medium">{globalDefaultSheetName}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ステータスカード */}
              <Card className="bg-white shadow-lg border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">システム統計</h3>
                        <p className="text-sm text-slate-600">リアルタイム稼働状況</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">100%</div>
                      <div className="text-sm text-slate-600">稼働率</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* セットアップガイドタブ */}
          <TabsContent value="guide">
            <Card className="bg-white shadow-lg border-0 h-fit">
              <CardHeader className="bg-gradient-to-r from-emerald-600 to-green-700 text-white p-6">
                <div className="flex items-center space-x-3">
                  <HelpCircle className="h-6 w-6" />
                  <div>
                    <CardTitle className="text-xl font-semibold">実装ガイド</CardTitle>
                    <CardDescription className="text-emerald-100 mt-1">
                      段階的なセットアップ手順
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-8">
                  {/* ステップ1 */}
                  <div className="relative">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          1
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">スプレッドシート作成</h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">
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
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">わかりやすい名前を設定（例：「出席管理データ」）</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">URLからスプレッドシートIDを抽出</span>
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-2">URL例:</p>
                          <div className="font-mono text-sm text-slate-600 bg-white p-3 rounded border break-all">
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
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          2
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">アクセス権限設定</h3>
                        
                        {/* サービスアカウント表示 */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <p className="font-medium text-blue-900">サービスアカウント</p>
                          </div>
                          <div className="flex items-center space-x-3 p-3 bg-white border border-blue-200 rounded-lg">
                            <code className="flex-1 text-sm font-mono text-slate-800 break-all select-all">
                              {SERVICE_ACCOUNT_EMAIL}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={copyServiceAccountEmail}
                              className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-3 py-2"
                            >
                              <Copy className="h-4 w-4" />
                              <span>コピー</span>
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">スプレッドシートの「共有」ボタンをクリック</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">上記サービスアカウントを追加</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">権限を<strong>「編集者」</strong>に設定</span>
                          </div>
                        </div>

                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
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
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          3
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 mb-3">システム設定</h3>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">左側の設定フォームにスプレッドシートIDを入力</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">デフォルトシート名を設定（オプション）</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <ArrowRight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-700">「設定を保存」ボタンで完了</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* データ構造 */}
                  <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">データ構造</h3>
                    <p className="text-slate-600 mb-4">学生の出席登録時に以下の形式で記録されます:</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-white border border-slate-200">
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">ID</th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">ClassName</th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">StudentID</th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Department</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">UUID</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">日付</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">講義名</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">学籍番号</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">氏名</td>
                            <td className="border border-slate-200 px-3 py-2 text-slate-600">学科</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                      各講義ごとに「{globalDefaultSheetName}」+「講義名」の形式でシートが自動作成されます
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