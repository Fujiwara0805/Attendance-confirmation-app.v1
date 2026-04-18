'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Calendar,
  Clock,
  UserCheck,
  ScanLine,
  RotateCcw,
  History,
} from 'lucide-react';
import Link from 'next/link';

interface ResponseData {
  id: string;
  response_code: string;
  respondent_name: string;
  respondent_email?: string;
  selected_date: string;
  selected_time_label?: string;
  checked_in_at?: string;
}

interface ScanHistoryItem {
  name: string;
  time: string;
  status: 'success' | 'already' | 'error';
}

type ScanMode = 'auto' | 'verify';
type ScanState = 'idle' | 'scanning' | 'fetching' | 'result' | 'checking_in' | 'awaiting_verification' | 'success' | 'error';

export default function AdminScannerPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    }>
      <AdminScannerPage />
    </Suspense>
  );
}

function AdminScannerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseCode = searchParams.get('course');

  const [scanMode, setScanMode] = useState<ScanMode>('verify');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [courseName, setCourseName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

  const html5QrCodeRef = useRef<any>(null);
  const scanLockRef = useRef(false);
  const readerDivId = 'qr-reader';

  // 認証チェック
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // カメラクリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrCodeRef.current.stop();
        }
      } catch {
        // ignore cleanup errors
      }
    }
    setCameraActive(false);
  }, []);

  const extractResponseCode = (text: string): string | null => {
    const match = text.match(/\/checkin\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleScanSuccess = useCallback(async (decodedText: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const responseCode = extractResponseCode(decodedText);
    if (!responseCode) {
      setError('無効なQRコードです。招待フォームのQRコードをスキャンしてください。');
      setScanState('error');
      scanLockRef.current = false;
      return;
    }

    // カメラ停止
    await stopCamera();
    setScanState('fetching');
    setError(null);

    try {
      // 参加者情報取得
      const res = await fetch(`/api/v2/invitation-responses/${responseCode}`);
      if (!res.ok) {
        setError('招待情報が見つかりません。QRコードが正しいか確認してください。');
        setScanState('error');
        scanLockRef.current = false;
        return;
      }

      const data = await res.json();
      setResponseData(data.response);
      setCourseName(data.courseName);

      // 既にチェックイン済み
      if (data.response.checked_in_at) {
        setAlreadyCheckedIn(true);
        setCheckedInAt(data.response.checked_in_at);
        setScanState('success');
        addToHistory(data.response.respondent_name, 'already');
        scanLockRef.current = false;
        return;
      }

      setAlreadyCheckedIn(false);

      if (scanMode === 'auto') {
        // 自動モード: 即チェックイン
        setScanState('checking_in');
        await performCheckin(responseCode, data.response.respondent_name);
      } else {
        // 名前確認モード: 確認待ち
        setScanState('awaiting_verification');
      }
    } catch {
      setError('データの取得に失敗しました。ネットワークを確認してください。');
      setScanState('error');
    }

    scanLockRef.current = false;
  }, [scanMode, stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  const performCheckin = async (responseCode: string, name: string) => {
    try {
      const res = await fetch(`/api/v2/invitation-responses/${responseCode}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkedInBy: session?.user?.name || session?.user?.email || 'staff',
        }),
      });

      if (!res.ok) {
        throw new Error('チェックインに失敗しました');
      }

      const data = await res.json();

      if (data.alreadyCheckedIn) {
        setAlreadyCheckedIn(true);
        setCheckedInAt(data.checkedInAt);
        addToHistory(name, 'already');
      } else {
        setCheckedInAt(data.checkedInAt);
        addToHistory(name, 'success');
      }

      setScanState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チェックインに失敗しました');
      setScanState('error');
      addToHistory(name, 'error');
    }
  };

  const handleVerifyAndCheckin = async () => {
    if (!responseData) return;
    setScanState('checking_in');
    await performCheckin(responseData.response_code, responseData.respondent_name);
  };

  const addToHistory = (name: string, historyStatus: 'success' | 'already' | 'error') => {
    setScanHistory(prev => [{
      name,
      time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: historyStatus,
    }, ...prev.slice(0, 49)]);
  };

  const startCamera = async () => {
    setError(null);
    setResponseData(null);
    setAlreadyCheckedIn(false);
    setCheckedInAt(null);
    setScanState('scanning');
    scanLockRef.current = false;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(readerDivId);
      }

      const qrConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      };

      try {
        // まず外カメラ（背面カメラ）を厳密に指定して起動
        await html5QrCodeRef.current.start(
          { facingMode: { exact: 'environment' } },
          qrConfig,
          handleScanSuccess,
          () => {}
        );
      } catch {
        // 外カメラが見つからない場合（デスクトップ等）はフォールバック
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          qrConfig,
          handleScanSuccess,
          () => {}
        );
      }

      setCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('カメラの起動に失敗しました。カメラへのアクセスを許可してください。');
      setScanState('error');
    }
  };

  const resetScanner = async () => {
    await stopCamera();
    setResponseData(null);
    setError(null);
    setAlreadyCheckedIn(false);
    setCheckedInAt(null);
    setScanState('idle');
    scanLockRef.current = false;
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-sm sm:text-base font-medium">管理画面</span>
          </Link>
          <h1 className="text-sm sm:text-base font-semibold text-slate-900">QRスキャン受付</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Hero */}
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-2">
            <ScanLine className="h-3 w-3" />
            Check-in Scanner
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">QRスキャン受付</h2>
          <p className="text-sm sm:text-base text-slate-500 mt-1 leading-relaxed">参加者のQRコードを読み取り、受付を完了します</p>
        </div>

        {/* モード切替 */}
        <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-4">
          <p className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-400 mb-2.5">受付モード</p>
          <div className="flex gap-2">
            <button
              onClick={() => setScanMode('auto')}
              className={`flex-1 py-3 px-3 rounded-xl text-sm sm:text-base font-semibold transition-all ${
                scanMode === 'auto'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/60'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              自動受付
            </button>
            <button
              onClick={() => setScanMode('verify')}
              className={`flex-1 py-3 px-3 rounded-xl text-sm sm:text-base font-semibold transition-all ${
                scanMode === 'verify'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/60'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              名前確認受付
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-2.5 leading-relaxed">
            {scanMode === 'auto'
              ? 'QRコードをスキャンすると自動的にチェックインします'
              : 'QRコードをスキャン後、名前を確認してからチェックインします'}
          </p>
        </div>

        {/* カメラビューポート */}
        <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="relative">
            <div
              id={readerDivId}
              className={`w-full ${cameraActive ? 'min-h-[300px]' : 'h-0 overflow-hidden'}`}
            />

            {!cameraActive && scanState !== 'fetching' && scanState !== 'result' && scanState !== 'checking_in' && scanState !== 'awaiting_verification' && scanState !== 'success' && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100 shadow-sm flex items-center justify-center mb-5">
                  <ScanLine className="h-10 w-10 text-indigo-400" />
                </div>
                <p className="text-sm sm:text-base text-slate-500 text-center mb-5 leading-relaxed">
                  カメラを起動して参加者のQRコードをスキャンします
                </p>
                <Button
                  onClick={startCamera}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-12 px-6 rounded-xl shadow-lg shadow-indigo-200/50 font-semibold active:scale-[0.98] transition-all"
                >
                  <Camera className="h-4 w-4" />
                  カメラを起動
                </Button>
              </div>
            )}
          </div>

          {/* スキャン中のインジケータ */}
          {cameraActive && (
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-t border-indigo-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-xs sm:text-sm text-indigo-700 font-semibold">スキャン中...</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopCamera}
                className="h-8 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
              >
                <CameraOff className="h-3.5 w-3.5 mr-1" />
                停止
              </Button>
            </div>
          )}
        </div>

        {/* ローディング */}
        {scanState === 'fetching' && (
          <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm sm:text-base text-slate-500">参加者情報を取得中...</p>
          </div>
        )}

        {/* チェックイン処理中 */}
        {scanState === 'checking_in' && (
          <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm sm:text-base text-slate-500">チェックイン処理中...</p>
          </div>
        )}

        {/* 名前確認待ち（Approach B） */}
        {scanState === 'awaiting_verification' && responseData && (
          <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <User className="h-5 w-5" />
              <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase">名前を確認してください</span>
            </div>

            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 ring-1 ring-amber-100 shadow-sm flex items-center justify-center mx-auto">
                <User className="h-9 w-9 text-amber-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {responseData.respondent_name}
              </h2>
              {courseName && (
                <p className="text-sm sm:text-base text-slate-500">{courseName}</p>
              )}
              <div className="flex items-center justify-center gap-4 text-xs sm:text-sm text-slate-400">
                {responseData.selected_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {responseData.selected_date}
                  </span>
                )}
                {responseData.selected_time_label && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {responseData.selected_time_label}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetScanner}
                className="flex-1 h-12 rounded-xl text-sm sm:text-base font-semibold"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleVerifyAndCheckin}
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm sm:text-base shadow-lg shadow-emerald-200/50 transition-all active:scale-[0.98]"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                確認してチェックイン
              </Button>
            </div>
          </div>
        )}

        {/* チェックイン結果 */}
        {scanState === 'success' && responseData && (
          <div className={`rounded-2xl ring-1 shadow-sm p-6 space-y-4 ${
            alreadyCheckedIn
              ? 'bg-gradient-to-br from-blue-50 to-indigo-50/60 ring-blue-200'
              : 'bg-gradient-to-br from-emerald-50 to-teal-50/60 ring-emerald-200'
          }`}>
            <div className="text-center space-y-3">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto ring-1 shadow-sm ${
                alreadyCheckedIn
                  ? 'bg-gradient-to-br from-blue-100 to-indigo-100 ring-blue-200'
                  : 'bg-gradient-to-br from-emerald-100 to-teal-100 ring-emerald-200'
              }`}>
                <UserCheck className={`h-9 w-9 ${
                  alreadyCheckedIn ? 'text-blue-600' : 'text-emerald-600'
                }`} />
              </div>

              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                alreadyCheckedIn ? 'text-blue-800' : 'text-emerald-800'
              }`}>
                {responseData.respondent_name}
              </h2>

              {courseName && (
                <p className="text-sm sm:text-base text-slate-500">{courseName}</p>
              )}

              <div className="flex items-center justify-center gap-4 text-xs sm:text-sm text-slate-400">
                {responseData.selected_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {responseData.selected_date}
                  </span>
                )}
                {responseData.selected_time_label && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {responseData.selected_time_label}
                  </span>
                )}
              </div>

              {alreadyCheckedIn ? (
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  既に受付済みです
                  {checkedInAt && (
                    <span className="text-blue-500 font-normal">({formatDateTime(checkedInAt)})</span>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  受付完了
                  {checkedInAt && (
                    <span className="text-emerald-500 font-normal">({formatDateTime(checkedInAt)})</span>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={resetScanner}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm sm:text-base gap-2 shadow-lg shadow-indigo-200/50 transition-all active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" />
              次のスキャンへ
            </Button>
          </div>
        )}

        {/* エラー表示 */}
        {scanState === 'error' && (
          <div className="bg-gradient-to-br from-red-50 to-rose-50/60 rounded-2xl ring-1 ring-red-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm sm:text-base text-red-600 leading-relaxed">{error}</p>
            </div>
            <Button
              onClick={resetScanner}
              variant="outline"
              className="w-full h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-sm sm:text-base font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              やり直す
            </Button>
          </div>
        )}

        {/* スキャン履歴 */}
        {scanHistory.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-black/5 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <History className="h-4 w-4 text-slate-400" />
              <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-slate-500">スキャン履歴</span>
              <Badge variant="secondary" className="ml-auto bg-slate-100 text-slate-500 text-[10px] sm:text-xs">
                {scanHistory.length}件
              </Badge>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {scanHistory.map((item, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.status === 'success' ? 'bg-emerald-100' :
                    item.status === 'already' ? 'bg-blue-100' :
                    'bg-red-100'
                  }`}>
                    {item.status === 'success' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    ) : item.status === 'already' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    )}
                  </div>
                  <span className="text-sm sm:text-base text-slate-700 flex-1 truncate">{item.name}</span>
                  <span className="text-xs sm:text-sm text-slate-400 shrink-0 tabular-nums">{item.time}</span>
                  <Badge variant="secondary" className={`text-[10px] sm:text-xs shrink-0 ${
                    item.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    item.status === 'already' ? 'bg-blue-50 text-blue-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {item.status === 'success' ? '受付完了' :
                     item.status === 'already' ? '受付済み' :
                     'エラー'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
