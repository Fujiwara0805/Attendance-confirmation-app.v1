'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const handleCheckin = async () => {
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(`/api/v2/invitation-responses/${responseCode}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error('チェックインに失敗しました');
      }

      const data = await res.json();
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
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {/* アイコン */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              checkedIn ? 'bg-emerald-100' : 'bg-indigo-100'
            }`}>
              {checkedIn ? (
                <UserCheck className="h-8 w-8 text-emerald-600" />
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
                disabled={checking}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg rounded-xl shadow-lg"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    処理中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    受付確認（出席）
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-3">
                上記のお名前に間違いがなければ、ボタンを押して受付を完了してください
              </p>
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
