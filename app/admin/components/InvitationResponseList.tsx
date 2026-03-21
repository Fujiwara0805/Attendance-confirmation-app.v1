'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle,
  Clock,
  User,
  Calendar,
  RefreshCw,
  Download,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';

interface Response {
  id: string;
  response_code: string;
  respondent_name: string;
  respondent_email: string | null;
  respondent_phone: string | null;
  selected_date: string;
  selected_time_label: string | null;
  checked_in_at: string | null;
  created_at: string;
  custom_data?: Record<string, any>;
}

interface InvitationResponseListProps {
  courseCode: string;
  courseName: string;
}

const ITEMS_PER_PAGE = 5;

export default function InvitationResponseList({ courseCode, courseName }: InvitationResponseListProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [filterParticipationDateFrom, setFilterParticipationDateFrom] = useState('');
  const [filterParticipationTimeFrom, setFilterParticipationTimeFrom] = useState('');

  const fetchResponses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/invitation-responses?courseCode=${courseCode}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setResponses(data.responses || []);
    } catch {
      toast({ title: 'エラー', description: '回答一覧の取得に失敗しました', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, [courseCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkedInCount = responses.filter(r => r.checked_in_at).length;

  // Filtering
  const filteredResponses = useMemo(() => {
    let filtered = responses;
    // Status filter
    if (filterStatus === 'checked_in') {
      filtered = filtered.filter(r => r.checked_in_at !== null);
    } else if (filterStatus === 'not_checked_in') {
      filtered = filtered.filter(r => r.checked_in_at === null);
    }
    // Participation date/time filter
    if (filterParticipationDateFrom) {
      filtered = filtered.filter(r => r.selected_date === filterParticipationDateFrom);
      if (filterParticipationTimeFrom) {
        filtered = filtered.filter(r => {
          if (!r.selected_time_label) return false;
          // Parse time ranges like "10:00〜12:00" or "10:00-12:00"
          const timeMatch = r.selected_time_label.match(/(\d{1,2}:\d{2})\s*[〜~\-－―]\s*(\d{1,2}:\d{2})/);
          if (!timeMatch) return false;
          const rangeStart = timeMatch[1];
          const rangeEnd = timeMatch[2];
          return filterParticipationTimeFrom >= rangeStart && filterParticipationTimeFrom < rangeEnd;
        });
      }
    }
    return filtered;
  }, [responses, filterStatus, filterParticipationDateFrom, filterParticipationTimeFrom]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / ITEMS_PER_PAGE));
  const paginatedResponses = filteredResponses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterParticipationDateFrom, filterParticipationTimeFrom]);

  // Collect all custom field keys across responses for CSV export
  const allCustomFieldKeys = useMemo(() => {
    const keySet = new Set<string>();
    responses.forEach(r => {
      if (r.custom_data && typeof r.custom_data === 'object') {
        Object.keys(r.custom_data).forEach(k => keySet.add(k));
      }
    });
    return Array.from(keySet);
  }, [responses]);

  const handleExportCsv = () => {
    if (responses.length === 0) return;

    const baseHeaders = ['名前', 'メール', '電話番号', '選択日', '時間帯', 'チェックイン', '登録日時'];
    const headers = [...baseHeaders, ...allCustomFieldKeys];

    const rows = responses.map(r => {
      const baseRow = [
        r.respondent_name,
        r.respondent_email || '',
        r.respondent_phone || '',
        r.selected_date,
        r.selected_time_label || '',
        r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('ja-JP') : '未受付',
        new Date(r.created_at).toLocaleString('ja-JP'),
      ];
      const customRow = allCustomFieldKeys.map(key => {
        const val = r.custom_data?.[key];
        if (val === undefined || val === null) return '';
        if (typeof val === 'boolean') return val ? 'はい' : 'いいえ';
        return String(val);
      });
      return [...baseRow, ...customRow];
    });

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invitation-responses-${courseCode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterParticipationDateFrom('');
    setFilterParticipationTimeFrom('');
  };

  const hasActiveFilters = filterStatus !== 'all' || filterParticipationDateFrom || filterParticipationTimeFrom;

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
              申込
            </Badge>
            <span className="text-lg font-bold text-indigo-700 mt-0.5">{responses.length}</span>
          </div>
          <div className="flex flex-col items-center">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              受付済
            </Badge>
            <span className="text-lg font-bold text-emerald-700 mt-0.5">{checkedInCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilter(!showFilter)}
            className={`h-8 hidden md:flex ${hasActiveFilters ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`}
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            絞り込み
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">!</span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchResponses} disabled={loading} className="h-8">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={responses.length === 0} className="h-8">
            <Download className="h-3.5 w-3.5 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Filter panel (PC only) */}
      {showFilter && (
        <div className="hidden md:block p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          {/* Status filter */}
          <div className="flex items-center gap-3">
            <Label className="text-xs text-slate-500 shrink-0">ステータス</Label>
            <div className="flex rounded-md border border-slate-200 overflow-hidden">
              {([
                { value: 'all', label: 'すべて' },
                { value: 'not_checked_in', label: '未受付' },
                { value: 'checked_in', label: '受付済み' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilterStatus(option.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterStatus === option.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participation date/time filter */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">参加日時</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filterParticipationDateFrom}
                  onChange={(e) => setFilterParticipationDateFrom(e.target.value)}
                  className="h-8 text-sm w-40"
                />
                <Input
                  type="time"
                  value={filterParticipationTimeFrom}
                  onChange={(e) => setFilterParticipationTimeFrom(e.target.value)}
                  className="h-8 text-sm w-32"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-slate-500">
                <X className="h-3 w-3 mr-1" />
                クリア
              </Button>
            )}
            <div className="text-xs text-slate-400 ml-auto self-center">
              {filteredResponses.length}件表示
            </div>
          </div>
        </div>
      )}

      {/* 回答一覧 - モバイルでは非表示 */}
      <div className="hidden md:block">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : filteredResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">
              {hasActiveFilters ? '条件に一致する回答がありません' : 'まだ回答がありません'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedResponses.map((response) => (
                <div
                  key={response.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                    response.checked_in_at
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* アイコン */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    response.checked_in_at ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}>
                    {response.checked_in_at ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <User className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {response.respondent_name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {response.selected_time_label && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {response.selected_date} {response.selected_time_label}
                        </span>
                      )}
                      <span>{formatDate(response.created_at)}</span>
                    </div>
                  </div>

                  {/* ステータス */}
                  <div className="shrink-0">
                    {response.checked_in_at ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">
                        受付済み
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px]">
                        未受付
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-500">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* モバイル: 非表示のお知らせ */}
      <div className="md:hidden">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">参加者一覧はPCでご確認ください</p>
          <p className="text-xs text-slate-400 mt-1">CSVエクスポートはPC版からご利用いただけます</p>
        </div>
      </div>
    </div>
  );
}
