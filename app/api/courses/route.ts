// /app/api/courses/route.ts - 出席フォーム用の認証なし講義一覧API
import { NextRequest, NextResponse } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData } from '@/lib/googleSheets';
import { cache, generateCacheKey } from '@/lib/cache';

// 全講義一覧を取得（認証なし - 出席フォーム用）
export async function GET() {
  try {
    // キャッシュキーを生成（パブリック用）
    const cacheKey = generateCacheKey('public-courses', 'all');
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return NextResponse.json(cachedData, { status: 200 });
    }
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // タイムアウト対策：Promise.raceでタイムアウトを設定
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 8 seconds')), 8000);
    });
    
    const dataPromise = getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 8秒でタイムアウト（Vercelの10秒制限より短く設定）
    const coursesData = await Promise.race([dataPromise, timeoutPromise]) as any[][];
    
    // 公開情報のみを含む講義リストを作成
    const courses = coursesData.slice(1)
      .filter(row => row[0] && row[1]) // IDと講義名が存在するもののみ
      .map(row => ({
        id: row[0],
        courseName: row[1] || '',
        teacherName: row[2] || '',
        defaultSheetName: row[4] || 'Attendance',
        // スプレッドシートIDや作成者情報などの機密情報は除外
      }));
    
    const responseData = {
      courses,
      total: courses.length
    };
    
    // キャッシュに保存（5分間）
    cache.set(cacheKey, responseData, 300);
    
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching public courses:', error);
    
    // Rate Limitエラーの場合は特別なメッセージを返す
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
      return NextResponse.json({ 
        message: 'Google Sheets APIのリクエスト制限に達しました。しばらく待ってから再試行してください。',
        error: 'Rate limit exceeded'
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      message: 'Failed to fetch courses',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
