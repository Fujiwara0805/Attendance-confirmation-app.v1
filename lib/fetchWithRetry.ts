// リトライ機能付きのfetch関数
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error, response?: Response) => boolean;
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error, response?: Response) => {
    // 5xx エラーまたはネットワークエラーの場合にリトライ
    if (!response) return true; // ネットワークエラー
    return response.status >= 500; // サーバーエラー
  }
};

export const fetchWithRetry = async (
  url: string, 
  options: RequestInit = {}, 
  retryOptions: RetryOptions = {}
): Promise<Response> => {
  const config = { ...defaultRetryOptions, ...retryOptions };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // 成功またはリトライ対象外のエラーの場合は即座に返す
      if (response.ok || !config.retryCondition(new Error(`HTTP ${response.status}`), response)) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      // 最後の試行でない場合は待機
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // リトライ条件をチェック
      if (!config.retryCondition(lastError)) {
        throw lastError;
      }
      
      // 最後の試行でない場合は待機
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
};

// JSONレスポンス用のヘルパー関数
export const fetchJsonWithRetry = async <T = any>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> => {
  const response = await fetchWithRetry(url, options, retryOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};
