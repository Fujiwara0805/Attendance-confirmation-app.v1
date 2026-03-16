import { redis } from './redis';
import { appendSheetData, createSheetIfEmpty } from './googleSheets';

const BUFFER_PREFIX = 'writeBuffer';
const FLUSH_THRESHOLD = 50;
const SHEET_INIT_PREFIX = 'sheetInit';
const SHEET_INIT_TTL = 3600; // 1時間

interface BufferEntry {
  spreadsheetId: string;
  sheetName: string;
  rowData: any[];
}

/**
 * 書き込みデータをRedisバッファにキューイングします。
 * Redis未接続時は直接Google Sheetsに書き込みます。
 */
export async function enqueueWrite(
  spreadsheetId: string,
  sheetName: string,
  rowData: any[]
): Promise<void> {
  // Redis未接続時はフォールバック
  if (!redis) {
    await appendSheetData(spreadsheetId, sheetName, [rowData]);
    return;
  }

  try {
    const entry: BufferEntry = { spreadsheetId, sheetName, rowData };
    const bufferKey = `${BUFFER_PREFIX}:${spreadsheetId}:${sheetName}`;
    await redis.rpush(bufferKey, JSON.stringify(entry));

    // 閾値に達したらインラインフラッシュ
    const queueLength = await redis.llen(bufferKey);
    if (queueLength >= FLUSH_THRESHOLD) {
      await flushBufferForKey(bufferKey);
    }
  } catch (error) {
    console.warn('Redis enqueue failed, falling back to direct write:', error);
    await appendSheetData(spreadsheetId, sheetName, [rowData]);
  }
}

/**
 * 複数行を一括でバッファにキューイングします。
 */
export async function enqueueBatchWrite(
  spreadsheetId: string,
  sheetName: string,
  rows: any[][]
): Promise<void> {
  if (!redis) {
    await appendSheetData(spreadsheetId, sheetName, rows);
    return;
  }

  try {
    const bufferKey = `${BUFFER_PREFIX}:${spreadsheetId}:${sheetName}`;
    const entries = rows.map(rowData =>
      JSON.stringify({ spreadsheetId, sheetName, rowData } as BufferEntry)
    );

    if (entries.length > 0) {
      await redis.rpush(bufferKey, ...entries);
    }

    const queueLength = await redis.llen(bufferKey);
    if (queueLength >= FLUSH_THRESHOLD) {
      await flushBufferForKey(bufferKey);
    }
  } catch (error) {
    console.warn('Redis batch enqueue failed, falling back to direct write:', error);
    await appendSheetData(spreadsheetId, sheetName, rows);
  }
}

/**
 * 特定のバッファキーをフラッシュします。
 */
async function flushBufferForKey(bufferKey: string): Promise<number> {
  if (!redis) return 0;

  const entries = await redis.lrange(bufferKey, 0, FLUSH_THRESHOLD - 1);
  if (!entries || entries.length === 0) return 0;

  const parsed: BufferEntry[] = entries.map(e =>
    typeof e === 'string' ? JSON.parse(e) : e as BufferEntry
  );

  const { spreadsheetId, sheetName } = parsed[0];
  const rows = parsed.map(e => e.rowData);

  try {
    await appendSheetData(spreadsheetId, sheetName, rows);
    // 処理済みエントリを削除
    await redis.ltrim(bufferKey, entries.length, -1);
    return entries.length;
  } catch (error) {
    console.error(`Flush failed for ${bufferKey}:`, error);
    throw error;
  }
}

/**
 * 全バッファをフラッシュします (Cron Job用)。
 */
export async function flushAllBuffers(): Promise<{ flushed: number; errors: string[] }> {
  if (!redis) return { flushed: 0, errors: ['Redis not connected'] };

  let totalFlushed = 0;
  const errors: string[] = [];

  try {
    // writeBuffer:* パターンのキーを検索
    const keys = await scanKeys(`${BUFFER_PREFIX}:*`);

    for (const key of keys) {
      try {
        const flushed = await flushBufferForKey(key);
        totalFlushed += flushed;
      } catch (error) {
        const errorMsg = `Failed to flush ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  } catch (error) {
    errors.push(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { flushed: totalFlushed, errors };
}

/**
 * Redisキーをスキャンします (SCAN代替としてKEYSを使用、Upstash向け)。
 */
async function scanKeys(pattern: string): Promise<string[]> {
  if (!redis) return [];

  try {
    // Upstash RedisではSCANの代わりにkeysを使用 (小規模データセット向け)
    const keys = await redis.keys(pattern);
    return keys;
  } catch {
    return [];
  }
}

/**
 * シートの存在確認をRedisキャッシュ付きで行います。
 * 同じシートに対する重複チェックを排除します。
 */
export async function ensureSheetExists(
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const cacheKey = `${SHEET_INIT_PREFIX}:${spreadsheetId}:${sheetName}`;

  // Redisキャッシュ確認
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return; // 既にチェック済み
    } catch {
      // Redis失敗時は通常フローへ
    }
  }

  // Google Sheets APIでシート存在確認・作成
  await createSheetIfEmpty(spreadsheetId, sheetName, headers);

  // 結果をキャッシュ
  if (redis) {
    try {
      await redis.set(cacheKey, '1', { ex: SHEET_INIT_TTL });
    } catch {
      // キャッシュ書き込み失敗は無視
    }
  }
}

/**
 * バッファサイズを取得します (モニタリング用)。
 */
export async function getBufferSize(): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await scanKeys(`${BUFFER_PREFIX}:*`);
    let total = 0;
    for (const key of keys) {
      total += await redis.llen(key);
    }
    return total;
  } catch {
    return 0;
  }
}
