'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle, Download, QrCode, Calendar, User, Copy } from 'lucide-react';
import Image from 'next/image';

interface ResponseData {
  responseCode: string;
  respondentName: string;
  selectedTimeLabel: string | null;
  courseName: string;
}

export default function InvitationCompletePage() {
  const router = useRouter();
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('invitation_response');
    if (!stored) {
      router.replace('/');
      return;
    }

    const data: ResponseData = JSON.parse(stored);
    setResponseData(data);

    // QRコード生成
    const generateQr = async () => {
      const checkinUrl = `${window.location.origin}/checkin/${data.responseCode}`;
      try {
        const QRCode = await import('qrcode');
        const dataUrl = await QRCode.toDataURL(checkinUrl, { width: 512, margin: 2 });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    };
    generateQr();
  }, [router]);

  const handleDownloadQr = () => {
    if (!qrDataUrl || !responseData) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `invitation-qr-${responseData.responseCode}.png`;
    link.click();
  };

  const handleCopyUrl = async () => {
    if (!responseData) return;
    const url = `${window.location.origin}/checkin/${responseData.responseCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!responseData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
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
        {/* 成功アイコン */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          className="flex justify-center mb-6"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-xl font-bold text-slate-900 mb-2">参加申込が完了しました</h1>
          <p className="text-sm text-slate-500">
            当日は以下のQRコードを受付で提示してください
          </p>
        </motion.div>

        {/* QRコード */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6"
        >
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              <div className="bg-white p-3 rounded-xl border border-slate-100">
                <img src={qrDataUrl} alt="受付用QRコード" className="w-56 h-56" />
              </div>
            ) : (
              <div className="w-56 h-56 bg-slate-100 rounded-xl flex items-center justify-center">
                <QrCode className="h-12 w-12 text-slate-300 animate-pulse" />
              </div>
            )}

            <div className="text-center space-y-2 w-full">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span className="font-medium">{responseData.respondentName}</span>
              </div>
              {responseData.selectedTimeLabel && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4" />
                  <span>{responseData.selectedTimeLabel}</span>
                </div>
              )}
              <p className="text-xs text-slate-400">{responseData.courseName}</p>
            </div>

            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                onClick={handleCopyUrl}
                className="flex-1 h-10 text-sm"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied ? 'コピーしました' : 'URLコピー'}
              </Button>
              <Button
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="flex-1 h-10 text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                QRダウンロード
              </Button>
            </div>
          </div>
        </motion.div>

        {/* 注意事項 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4"
        >
          <h3 className="text-sm font-semibold text-amber-800 mb-2">当日の受付について</h3>
          <ul className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
            <li>- このQRコードをスクリーンショットで保存しておくことをおすすめします</li>
            <li>- 受付時にスタッフにQRコードを提示し、お名前を確認してください</li>
            <li>- QRコードは本人確認用のため、他の方への共有はご遠慮ください</li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
