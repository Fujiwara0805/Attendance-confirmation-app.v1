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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  Calendar,
  Users,
  BarChart3,
  Loader2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Mic,
  Presentation
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
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'all'>('single');
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  // プレビュー取得
  const fetchPreview = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, format: 'json' });
      if (dateMode === 'single' && exportDate) {
        params.set('date', exportDate);
      } else if (dateMode === 'range') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
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
  }, [selectedCourse, dateMode, exportDate, dateFrom, dateTo, toast]);

  useEffect(() => {
    if (selectedCourse) {
      fetchPreview();
    }
  }, [selectedCourse, dateMode, exportDate, dateFrom, dateTo, fetchPreview]);

  // エクスポート実行
  const handleExport = async (format: 'csv' | 'json') => {
    if (!selectedCourse) {
      toast({ title: '選択エラー', description: '講義を選択してください', variant: 'destructive', duration: 2000 });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ course_id: selectedCourse, format });
      if (dateMode === 'single' && exportDate) {
        params.set('date', exportDate);
      } else if (dateMode === 'range') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
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
      setLoading(false);
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

  return (
    <div className="space-y-6">
      {/* 講義選択 */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            出席データエクスポート
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
                variant={dateMode === 'range' ? 'default' : 'outline'}
                onClick={() => setDateMode('range')}
                className={dateMode === 'range' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
              >
                期間指定
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
              <Input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="max-w-[200px] border-slate-300"
              />
            )}

            {dateMode === 'range' && (
              <div className="flex gap-2 items-center flex-wrap">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="max-w-[180px] border-slate-300"
                  placeholder="開始日"
                />
                <span className="text-slate-500">〜</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="max-w-[180px] border-slate-300"
                  placeholder="終了日"
                />
              </div>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

                  {/* 直近のレコードプレビュー */}
                  {previewData.records && previewData.records.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-2 text-slate-600">学籍番号</th>
                            <th className="text-left py-2 px-2 text-slate-600">氏名</th>
                            <th className="text-left py-2 px-2 text-slate-600">学年</th>
                            <th className="text-left py-2 px-2 text-slate-600">出席日</th>
                            <th className="text-left py-2 px-2 text-slate-600">キャンパス</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.records.slice(0, 5).map((record: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td className="py-1.5 px-2 text-slate-800">{record.studentId}</td>
                              <td className="py-1.5 px-2 text-slate-800">{record.studentName}</td>
                              <td className="py-1.5 px-2 text-slate-800">{record.grade || '-'}</td>
                              <td className="py-1.5 px-2 text-slate-800">{record.attendedAt}</td>
                              <td className="py-1.5 px-2">
                                {record.isOnCampus ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {previewData.totalRecords > 5 && (
                        <p className="text-xs text-slate-400 mt-1">
                          他 {previewData.totalRecords - 5} 件のレコード...
                        </p>
                      )}
                    </div>
                  )}
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
              disabled={!selectedCourse || loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              CSV ダウンロード
              <span className="text-xs ml-1 opacity-75">(Excel対応)</span>
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={!selectedCourse || loading}
              variant="outline"
              className="flex-1 border-slate-300"
            >
              {loading ? (
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
