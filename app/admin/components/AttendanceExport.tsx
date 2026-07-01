'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet,
  FileJson,
  Calendar,
  BarChart3,
  Loader2,
  AlertCircle,
  GraduationCap,
  Mic,
  Presentation,
  Trash2,
} from 'lucide-react';

interface Course {
  id: string;
  code: string;
  name: string;
  category: string;
  teacher_name: string;
  created_at: string;
}

interface AttendanceSummary {
  totalRecords: number;
  uniqueStudents: number;
  dateRange: string;
}

export default function AttendanceExport() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateMode, setDateMode] = useState<'single' | 'all'>('single');
  const [loadingFormat, setLoadingFormat] = useState<'csv' | 'json' | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [deletingDate, setDeletingDate] = useState(false);

  // 講義一覧取得（自分の講義のみ）
  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/courses?teacher_email=self');
      if (!response.ok) {
        // フォールバック: セッション情報なしでも取得試行
        const res2 = await fetch('/api/v2/courses');
        if (res2.ok) {
          const data = await res2.json();
          setCourses(data.courses || []);
        }
        return;
      }
      const data = await response.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      toast({ title: 'エラー', description: '講義一覧の取得に失敗しました', variant: 'destructive', duration: 2000 });
    } finally {
      setLoadingCourses(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 選択中フォームが実際に使われた出席日一覧を取得（新しい順）
  const fetchAvailableDates = useCallback(async () => {
    if (!selectedCourse) {
      setAvailableDates([]);
      return;
    }
    setLoadingDates(true);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, format: 'json' });
      const response = await fetch(`/api/v2/attendance/export?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const dates: string[] = Array.from(
          new Set(((data.records || []) as any[]).map((r) => r.attendedAt).filter(Boolean))
        ).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        setAvailableDates(dates);
        // 既定で最新の利用日を選択（現在値が一覧に無ければ差し替え）
        setExportDate((prev) => (prev && dates.includes(prev) ? prev : (dates[0] || '')));
      } else {
        setAvailableDates([]);
      }
    } catch (error) {
      console.error('Failed to fetch available dates:', error);
      setAvailableDates([]);
    } finally {
      setLoadingDates(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  // プレビュー取得
  const fetchPreview = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, format: 'json' });
      if (dateMode === 'single' && exportDate) {
        params.set('date', exportDate);
      }

      const response = await fetch(`/api/v2/attendance/export?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
      } else {
        const err = await response.json();
        if (response.status === 403) {
          toast({ title: 'アクセス拒否', description: err.message, variant: 'destructive', duration: 3000 });
        }
        setPreviewData(null);
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedCourse, dateMode, exportDate, toast]);

  useEffect(() => {
    if (selectedCourse) {
      fetchPreview();
    }
  }, [selectedCourse, dateMode, exportDate, fetchPreview]);

  // エクスポート実行
  const handleExport = async (format: 'csv' | 'json') => {
    if (!selectedCourse) {
      toast({ title: '選択エラー', description: '講義を選択してください', variant: 'destructive', duration: 2000 });
      return;
    }

    setLoadingFormat(format);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, format });
      if (dateMode === 'single' && exportDate) {
        params.set('date', exportDate);
      }

      const response = await fetch(`/api/v2/attendance/export?${params.toString()}`);

      if (!response.ok) {
        const err = await response.json();
        toast({ title: 'エクスポートエラー', description: err.message, variant: 'destructive', duration: 3000 });
        return;
      }

      if (format === 'json') {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `attendance_${selectedCourse}_${exportDate || 'all'}.json`);
      } else {
        const blob = await response.blob();
        const courseName = courses.find(c => c.id === selectedCourse)?.name || 'course';
        downloadBlob(blob, `${courseName}_出席データ_${exportDate || 'all'}.csv`);
      }

      toast({ title: 'エクスポート完了', description: `${format.toUpperCase()} ファイルをダウンロードしました`, duration: 2000 });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'エラー', description: 'エクスポート中にエラーが発生しました', variant: 'destructive', duration: 3000 });
    } finally {
      setLoadingFormat(null);
    }
  };

  // 特定の日の出席データを物理削除（復元不可）
  const handleDeleteDay = async () => {
    if (!selectedCourse || !exportDate) return;
    setDeletingDate(true);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, date: exportDate });
      const res = await fetch(`/api/v2/attendance/export?${params.toString()}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: '削除エラー', description: data.message || '削除に失敗しました', variant: 'destructive', duration: 3000 });
        return;
      }
      toast({
        title: '削除しました',
        description: `${formatDateLabel(exportDate)} の出席データ ${data.deleted ?? 0} 件を削除しました`,
        duration: 2500,
      });
      // 利用日一覧を再取得（exportDate は最新の残存日へ更新され、プレビューも自動再取得される）
      await fetchAvailableDates();
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'エラー', description: '削除中にエラーが発生しました', variant: 'destructive', duration: 3000 });
    } finally {
      setDeletingDate(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'lecture': return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'seminar': return <Mic className="h-4 w-4 text-green-500" />;
      case 'workshop': return <Presentation className="h-4 w-4 text-purple-500" />;
      default: return <GraduationCap className="h-4 w-4 text-slate-400" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'lecture': return '講義';
      case 'seminar': return '講演会';
      case 'workshop': return 'セミナー';
      default: return category;
    }
  };

  // 'YYYY-MM-DD' を '2026/7/1' 形式に整形（タイムゾーンずれを避けるため手動パース）
  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    return `${Number(y)}/${Number(m)}/${Number(d)}`;
  };

  return (
    <div className="space-y-6">
      {/* 講義選択 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            データエクスポート
          </CardTitle>
          <CardDescription>
            講義・講演会・セミナーの出席データをCSVまたはJSON形式でダウンロードできます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 講義選択 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">講義 / イベントを選択</Label>
            {loadingCourses ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                講義一覧を読み込み中...
              </div>
            ) : courses.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 py-2">
                <AlertCircle className="h-4 w-4" />
                Supabaseに登録された講義がありません。先に講義を作成してください。
              </div>
            ) : (
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger className="border-slate-300">
                  <SelectValue placeholder="講義を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(course.category)}
                        <span>{course.name}</span>
                        <span className="text-xs text-slate-400">({getCategoryLabel(course.category)})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 日付フィルタ */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">日付フィルタ</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={dateMode === 'single' ? 'default' : 'outline'}
                onClick={() => setDateMode('single')}
                className={dateMode === 'single' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              >
                特定の日
              </Button>
              <Button
                size="sm"
                variant={dateMode === 'all' ? 'default' : 'outline'}
                onClick={() => setDateMode('all')}
                className={dateMode === 'all' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              >
                全期間
              </Button>
            </div>

            {dateMode === 'single' && (
              !selectedCourse ? (
                <p className="text-sm text-slate-400 py-1">
                  先に講義 / イベントを選択してください
                </p>
              ) : loadingDates ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  利用日を読み込み中...
                </div>
              ) : availableDates.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 py-1">
                  <AlertCircle className="h-4 w-4" />
                  このフォームが使われた記録はまだありません
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={exportDate} onValueChange={setExportDate}>
                    <SelectTrigger className="max-w-[280px] border-slate-300">
                      <SelectValue placeholder="出席日を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDates.map((d) => (
                        <SelectItem key={d} value={d}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-500" />
                            <span>{formatDateLabel(d)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {exportDate && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deletingDate}
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          {deletingDate ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1.5" />
                          )}
                          この日のデータを削除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {formatDateLabel(exportDate)} の出席データを削除しますか？
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            この日に記録された出席データをデータベースから完全に削除します。
                            <span className="font-medium text-red-600">この操作は取り消せません。</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deletingDate}>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDay()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )
            )}
          </div>

          {/* プレビュー */}
          {selectedCourse && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  データを読み込み中...
                </div>
              ) : previewData ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    データプレビュー
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-2xl font-bold text-indigo-600">{previewData.totalRecords}</div>
                      <div className="text-xs text-slate-500">出席レコード数</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-2xl font-bold text-green-600">
                        {previewData.records ? new Set(previewData.records.map((r: any) => r.studentId)).size : 0}
                      </div>
                      <div className="text-xs text-slate-500">ユニーク参加者</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="text-2xl font-bold text-amber-600">
                        {previewData.records ? new Set(previewData.records.map((r: any) => r.attendedAt)).size : 0}
                      </div>
                      <div className="text-xs text-slate-500">日数</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  データがありません
                </div>
              )}
            </div>
          )}

          {/* エクスポートボタン */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={() => handleExport('csv')}
              disabled={!selectedCourse || loadingFormat !== null}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loadingFormat === 'csv' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              CSV ダウンロード
              <span className="text-xs ml-1 opacity-75">(Excel対応)</span>
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={!selectedCourse || loadingFormat !== null}
              variant="outline"
              className="flex-1 border-slate-300"
            >
              {loadingFormat === 'json' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileJson className="h-4 w-4 mr-2" />
              )}
              JSON ダウンロード
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            ※ CSV ファイルはExcelで直接開けるBOM付きUTF-8形式です。自分が作成した講義のデータのみダウンロード可能です。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
