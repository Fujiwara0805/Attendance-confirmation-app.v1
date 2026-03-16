import { redis } from './redis';

// シンプルなメモリキャッシュ実装
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();

  set(key: string, data: any, ttlSeconds: number = 300) {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expires });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // 期限切れのアイテムを定期的にクリーンアップ
  cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((item, key) => {
      if (now > item.expires) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Redis付きでデータを保存します (サーバーレスインスタンス間で共有)。
   * メモリキャッシュとRedis両方に書き込みます。
   */
  async setWithRedis(key: string, data: any, ttlSeconds: number = 300) {
    this.set(key, data, ttlSeconds);

    if (redis) {
      try {
        await redis.set(`cache:${key}`, JSON.stringify(data), { ex: ttlSeconds });
      } catch {
        // Redis書き込み失敗は無視 (メモリキャッシュで対応)
      }
    }
  }

  /**
   * Redis付きでデータを取得します。
   * メモリキャッシュを優先し、ミス時にRedisをチェックします。
   */
  async getWithRedis(key: string): Promise<any | null> {
    // メモリキャッシュ優先
    const memoryResult = this.get(key);
    if (memoryResult !== null) return memoryResult;

    // Redisフォールバック
    if (redis) {
      try {
        const redisResult = await redis.get(`cache:${key}`);
        if (redisResult) {
          const data = typeof redisResult === 'string' ? JSON.parse(redisResult) : redisResult;
          // メモリキャッシュに復元 (短いTTL)
          this.set(key, data, 60);
          return data;
        }
      } catch {
        // Redis読み取り失敗は無視
      }
    }

    return null;
  }
}

// グローバルキャッシュインスタンス
export const cache = new MemoryCache();

// 定期的なクリーンアップ（5分間隔）
if (typeof window === 'undefined') { // サーバーサイドでのみ実行
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

// キャッシュキーを生成するヘルパー関数
export const generateCacheKey = (prefix: string, ...params: (string | number)[]): string => {
  return `${prefix}:${params.join(':')}`;
};
