'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const LOGO_URL =
  'https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png';

export default function RoomsPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('6桁のルームコードを入力してください');
      return;
    }
    setIsJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) {
        setError('ルームが見つかりませんでした');
        return;
      }
      router.push(`/rooms/${code}`);
    } catch {
      setError('接続に失敗しました');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={LOGO_URL} alt="ざせきくん" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold text-slate-900">ざせきくん</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Join Room */}
          <div className="glass-card p-8">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">ルームに参加</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              ホストから共有された6桁のルームコードを入力して参加しましょう。ログインは不要です。
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && joinCode.length === 6 && handleJoin()}
              placeholder="例: ABC123"
              maxLength={6}
              className="modern-input w-full text-center text-2xl font-mono tracking-[0.3em] uppercase mb-4"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6 || isJoining}
              className="modern-button-primary w-full rounded-xl px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isJoining ? '接続中...' : '参加する'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Error */}
            {error && (
              <p className="mt-3 text-center text-sm text-red-500 animate-in fade-in duration-200">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
