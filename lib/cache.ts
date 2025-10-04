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
