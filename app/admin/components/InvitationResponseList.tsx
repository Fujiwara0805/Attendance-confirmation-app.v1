'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

interface InvitationResponseListProps {
  courseCode: string;
  courseName: string;
}

export default function InvitationResponseList({ courseCode, courseName }: InvitationResponseListProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleExportCsv = () => {
    if (responses.length === 0) return;

    const headers = ['名前', 'メール', '電話番号', '選択日', '時間帯', 'チェックイン', '登録日時'];
    const rows = responses.map(r => [
      r.respondent_name,
      r.respondent_email || '',
      r.respondent_phone || '',
      r.selected_date,
      r.selected_time_label || '',
      r.checked_in_at ? new Date(r.checked_in_at).toLocaleString('ja-JP') : '未受付',
      new Date(r.created_at).toLocaleString('ja-JP'),
    ]);

    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
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

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
            {responses.length}名申込
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            {checkedInCount}名受付済み
          </Badge>
        </div>
        <div className="flex items-center gap-2">
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

      {/* 回答一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      ) : responses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">まだ回答がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map((response) => (
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
      )}
    </div>
  );
}
