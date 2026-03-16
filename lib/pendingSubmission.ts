const PENDING_KEY = 'pendingAttendance';
const MAX_RETRIES = 3;

interface PendingSubmission {
  id: string;
  timestamp: number;
  url: string;
  body: Record<string, any>;
  status: 'pending' | 'confirmed' | 'failed';
  retryCount: number;
}

export function savePending(url: string, body: Record<string, any>): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: PendingSubmission = {
    id,
    timestamp: Date.now(),
    url,
    body,
    status: 'pending',
    retryCount: 0,
  };

  const existing = getAllPending();
  existing.push(entry);
  localStorage.setItem(PENDING_KEY, JSON.stringify(existing));
  return id;
}

export function getAllPending(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function markConfirmed(id: string): void {
  const items = getAllPending().filter(item => item.id !== id);
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

export function markFailed(id: string): void {
  const items = getAllPending().map(item =>
    item.id === id ? { ...item, status: 'failed' as const } : item
  );
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

/**
 * 未確認の送信をリトライします。
 * 完了ページやアプリマウント時に呼び出します。
 */
export async function retryPending(): Promise<void> {
  const items = getAllPending();
  const pending = items.filter(
    item => item.status === 'pending' && item.retryCount < MAX_RETRIES
  );

  for (const item of pending) {
    try {
      const response = await fetch(item.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });

      if (response.ok) {
        markConfirmed(item.id);
      } else {
        // リトライカウント増加
        const updated = getAllPending().map(i =>
          i.id === item.id ? { ...i, retryCount: i.retryCount + 1 } : i
        );
        localStorage.setItem(PENDING_KEY, JSON.stringify(updated));

        if (item.retryCount + 1 >= MAX_RETRIES) {
          markFailed(item.id);
        }
      }
    } catch {
      // ネットワークエラー時はリトライカウント増加
      const updated = getAllPending().map(i =>
        i.id === item.id ? { ...i, retryCount: i.retryCount + 1 } : i
      );
      localStorage.setItem(PENDING_KEY, JSON.stringify(updated));
    }
  }

  // 24時間以上前の完了・失敗エントリをクリーンアップ
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cleaned = getAllPending().filter(
    item => item.status === 'pending' || item.timestamp > cutoff
  );
  localStorage.setItem(PENDING_KEY, JSON.stringify(cleaned));
}

/**
 * 未確認の送信があるかチェックします。
 */
export function hasPendingSubmissions(): boolean {
  return getAllPending().some(item => item.status === 'pending');
}
