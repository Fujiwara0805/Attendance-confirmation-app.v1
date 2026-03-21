'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  User,
  Calendar,
  Clock,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import Image from 'next/image';

interface ResponseData {
  id: string;
  response_code: string;
  respondent_name: string;
  respondent_email?: string;
  selected_date: string;
  selected_time_label?: string;
  checked_in_at?: string;
}

/**
 * selected_time_label（例: "12:00 - 13:00"）をパースして
 * { startHour, startMin, endHour, endMin } を返す
 */
function parseTimeLabel(label: string): { startHour: number; startMin: number; endHour: number; endMin: number } | null {
  const match = label.match(/(\d{1,2}):(\d{2})\s*[-−–〜~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1], 10),
    startMin: parseInt(match[2], 10),
    endHour: parseInt(match[3], 10),
    endMin: parseInt(match[4], 10),
  };
}

export default function CheckinPage() {
  const params = useParams();
  const responseCode = params.responseCode as string;

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [courseName, setCourseName] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 1分ごとに現在時刻を更新（時間帯チェックをリアルタイムで反映）
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchResponse = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v2/invitation-responses/${responseCode}`);
      if (!res.ok) {
        setError('招待情報が見つかりません');
        return;
      }
      const data = await res.json();
      setResponseData(data.response);
      setCourseName(data.courseName);

      if (data.response.checked_in_at) {
        setCheckedIn(true);
        setCheckedInAt(data.response.checked_in_at);
      }
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [responseCode]);

  useEffect(() => {
    fetchResponse();
  }, [fetchResponse]);

  // 日付・時間帯の照合チェック（クライアント側）
  const checkinStatus = useMemo(() => {
    if (!responseData) return { canCheckin: false, reason: '' };

    const now = currentTime;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 日付チェック
    if (responseData.selected_date && responseData.selected_date !== todayStr) {
      const selectedDate = new Date(responseData.selected_date + 'T00:00:00');
      const isBeforeEvent = now < selectedDate;
      return {
        canCheckin: false,
        reason: isBeforeEvent
          ? `受付は ${responseData.selected_date} に開始されます。当日の受付時間にお越しください。`
          : `受付期間が終了しました。受付日は ${responseData.selected_date} でした。`,
        type: isBeforeEvent ? 'before' : 'after',
      };
    }

    // 時間帯チェック
    if (responseData.selected_time_label) {
      const timeRange = parseTimeLabel(responseData.selected_time_label);
      if (timeRange) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = timeRange.startHour * 60 + timeRange.startMin;
        const endMinutes = timeRange.endHour * 60 + timeRange.endMin;

        if (currentMinutes < startMinutes) {
          const waitHours = Math.floor((startMinutes - currentMinutes) / 60);
          const waitMins = (startMinutes - currentMinutes) % 60;
          const waitText = waitHours > 0 ? `${waitHours}時間${waitMins > 0 ? `${waitMins}分` : ''}` : `${waitMins}分`;
          return {
            canCheckin: false,
            reason: `受付開始まであと${waitText}です。受付時間は ${responseData.selected_time_label} です。`,
            type: 'before',
          };
        }
        if (currentMinutes > endMinutes) {
          return {
            canCheckin: false,
            reason: `受付時間が終了しました。受付時間は ${responseData.selected_time_label} でした。`,
            type: 'after',
          };
        }
      }
    }

    return { canCheckin: true, reason: '' };
  }, [responseData, currentTime]);

  const handleCheckin = async () => {
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(`/api/v2/invitation-responses/${responseCode}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        // サーバー側の日付・時間バリデーションエラー
        throw new Error(data.message || 'チェックインに失敗しました');
      }

      setCheckedIn(true);
      setCheckedInAt(data.checkedInAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チェックインに失敗しました');
    } finally {
      setChecking(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !responseData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">エラー</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!responseData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-sm font-semibold text-slate-900">ざせきくん</span>
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* 受付時間外の警告バナー */}
        {!checkedIn && !checkinStatus.canCheckin && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">受付時間外です</p>
                <p className="text-sm text-amber-700 leading-relaxed">{checkinStatus.reason}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 受付時間内の通知バナー */}
        {!checkedIn && checkinStatus.canCheckin && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-2"
          >
            <Calendar className="h-4 w-4 text-indigo-600 shrink-0" />
            <p className="text-sm text-indigo-700 font-medium">
              受付時間内です。下のボタンから受付を行ってください。
            </p>
          </motion.div>
        )}

        {/* イベント名 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">受付確認</p>
          <h1 className="text-lg font-bold text-slate-900">{courseName}</h1>
        </motion.div>

        {/* 参加者情報カード */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl border-2 shadow-sm p-6 mb-6 ${
            checkedIn
              ? 'bg-emerald-50 border-emerald-300'
              : !checkinStatus.canCheckin
                ? 'bg-slate-50 border-slate-200'
                : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {/* アイコン */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              checkedIn ? 'bg-emerald-100' : !checkinStatus.canCheckin ? 'bg-slate-100' : 'bg-indigo-100'
            }`}>
              {checkedIn ? (
                <UserCheck className="h-8 w-8 text-emerald-600" />
              ) : !checkinStatus.canCheckin ? (
                <Clock className="h-8 w-8 text-slate-400" />
              ) : (
                <User className="h-8 w-8 text-indigo-600" />
              )}
            </div>

            {/* 名前 */}
            <h2 className={`text-2xl font-bold ${
              checkedIn ? 'text-emerald-800' : 'text-slate-900'
            }`}>
              {responseData.respondent_name}
            </h2>

            {/* 詳細情報 */}
            <div className="space-y-2 text-center">
              {responseData.selected_date && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4" />
                  <span>{responseData.selected_date}</span>
                </div>
              )}
              {responseData.selected_time_label && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span>{responseData.selected_time_label}</span>
                </div>
              )}
            </div>

            {/* チェックイン状態 */}
            {checkedIn && checkedInAt && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-100 rounded-full px-4 py-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">受付済み</span>
                <span className="text-emerald-500">({formatDateTime(checkedInAt)})</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* チェックインボタン or 済みメッセージ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {checkedIn ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 rounded-xl px-6 py-3 text-sm font-medium"
              >
                <CheckCircle className="h-5 w-5" />
                受付が完了しました
              </motion.div>
            </div>
          ) : (
            <>
              <Button
                onClick={handleCheckin}
                disabled={checking || !checkinStatus.canCheckin}
                className={`w-full h-14 font-bold text-lg rounded-xl shadow-lg ${
                  checkinStatus.canCheckin
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {checking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    処理中...
                  </>
                ) : !checkinStatus.canCheckin ? (
                  <>
                    <ShieldAlert className="h-5 w-5 mr-2" />
                    受付時間外
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    受付確認（出席）
                  </>
                )}
              </Button>
              {checkinStatus.canCheckin && (
                <p className="text-xs text-slate-400 text-center mt-3">
                  上記のお名前に間違いがなければ、ボタンを押して受付を完了してください
                </p>
              )}
              {!checkinStatus.canCheckin && (
                <p className="text-xs text-slate-400 text-center mt-3">
                  申し込み時に選択した日付・時間帯にのみ受付が可能です
                </p>
              )}
            </>
          )}
        </motion.div>

        {/* エラー表示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
