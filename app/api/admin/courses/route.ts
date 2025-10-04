import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, appendSheetData, createSheetIfEmpty } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser } from '@/lib/auth';
import { cache, generateCacheKey } from '@/lib/cache';

// 講義管理シートの構造（IsCustomFormを追加）
const COURSES_HEADERS = ['ID', 'CourseName', 'TeacherName', 'SpreadsheetId', 'DefaultSheetName', 'CreatedBy', 'CreatedAt', 'LastUpdated', 'IsCustomForm'];

// 講義一覧を取得
export async function GET() {
  try {
    // 認証チェック
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    // キャッシュキーを生成（ユーザーごとにキャッシュ）
    const cacheKey = generateCacheKey('courses', user.email || 'anonymous');
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
    
    // 作成者でフィルタリング（処理を最適化）
    const courses = coursesData.slice(1)
      .filter(row => row[5] === user.email && row[0]) // CreatedByでフィルタ + IDが存在するもののみ
      .map(row => ({
        id: row[0],
        courseName: row[1] || '',
        teacherName: row[2] || '',
        spreadsheetId: row[3] || '',
        defaultSheetName: row[4] || 'Attendance',
        createdBy: row[5] || '',
        createdAt: row[6] || '',
        lastUpdated: row[7] || '',
        isCustomForm: row[8] === 'true' // IsCustomFormフラグを追加
      }));
    
    const responseData = {
      courses,
      total: courses.length
    };
    
    // キャッシュに保存（10分間に延長してAPI呼び出しを削減）
    cache.set(cacheKey, responseData, 600);
    
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching courses:', error);
    
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

// 新規講義を追加
export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    console.log('POST request received for new course');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { courseName, teacherName, spreadsheetId, isCustomForm } = body;

    if (!courseName || !teacherName || !spreadsheetId) {
      return NextResponse.json({ 
        message: '講義名、担当教員名、スプレッドシートIDは必須項目です。' 
      }, { status: 400 });
    }

    // スプレッドシートIDの形式チェック
    const trimmedId = spreadsheetId.trim();
    if (trimmedId.length < 20 || trimmedId.includes('/') || trimmedId.includes(' ')) {
      return NextResponse.json({ 
        message: 'スプレッドシートIDの形式が正しくありません。URLからIDのみを抽出してください。' 
      }, { status: 400 });
    }

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // Coursesシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, coursesSheetName, COURSES_HEADERS);
    
    // 既存の講義データを確認（重複チェック - 同じユーザーのみ）
    const existingData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    const isDuplicate = existingData.some(row => 
      row[1] === courseName.trim() && 
      row[2] === teacherName.trim() && 
      row[5] === user.email // 同じユーザーの重複チェック
    );
    
    if (isDuplicate) {
      return NextResponse.json({ 
        message: '同じ講義名・担当教員の組み合わせが既に存在します。' 
      }, { status: 400 });
    }

    // 新規講義データを作成（講義名をデフォルトシート名として使用）
    const courseId = uuidv4();
    const now = new Date().toISOString();
    const newCourseData = [
      courseId,
      courseName.trim(),
      teacherName.trim(),
      trimmedId,
      courseName.trim(), // 講義名をデフォルトシート名として使用
      user.email, // 作成者のメールアドレスを保存
      now,
      now,
      isCustomForm ? 'true' : 'false' // IsCustomFormフラグを追加
    ];

    // データを追加
    await appendSheetData(adminConfigSpreadsheetId, coursesSheetName, [newCourseData]);

    console.log('New course added successfully:', courseId);

    return NextResponse.json({ 
      message: '講義を正常に追加しました。',
      course: {
        id: courseId,
        courseName: courseName.trim(),
        teacherName: teacherName.trim(),
        spreadsheetId: trimmedId,
        isCustomForm: isCustomForm || false
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error adding course:', error);
    return NextResponse.json({ 
      message: '講義の追加に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 講義を更新
export async function PUT(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    console.log('PUT request received for course:', params.courseId);
    const body = await req.json();
    console.log('Request body:', body);
    
    const courseId = params.courseId;
    const { courseName, teacherName, spreadsheetId } = body;

    if (!courseId) {
      return NextResponse.json({ 
        message: '講義IDが指定されていません。' 
      }, { status: 400 });
    }

    if (!courseName || !teacherName || !spreadsheetId) {
      return NextResponse.json({ 
        message: '講義名、担当教員名、スプレッドシートIDは必須項目です。' 
      }, { status: 400 });
    }

    // スプレッドシートIDの形式チェック
    const trimmedId = spreadsheetId.trim();
    if (trimmedId.length < 20 || trimmedId.includes('/') || trimmedId.includes(' ')) {
      return NextResponse.json({ 
        message: 'スプレッドシートIDの形式が正しくありません。URLからIDのみを抽出してください。' 
      }, { status: 400 });
    }

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 更新対象の講義を検索（ヘッダー行を除く）
    const courseIndex = coursesData.slice(1).findIndex(row => row[0] === courseId);
    
    if (courseIndex === -1) {
      return NextResponse.json({ 
        message: '指定された講義が見つかりません。' 
      }, { status: 404 });
    }

    // 重複チェック（自分以外の講義で同じ講義名・担当教員の組み合わせがないか）
    const isDuplicate = coursesData.slice(1).some((row, index) => 
      index !== courseIndex && 
      row[1] === courseName.trim() && 
      row[2] === teacherName.trim()
    );
    
    if (isDuplicate) {
      return NextResponse.json({ 
        message: '同じ講義名・担当教員の組み合わせが既に存在します。' 
      }, { status: 400 });
    }
    
    // 実際の行番号（ヘッダー行 + インデックス + 1）
    const rowNumber = courseIndex + 2;
    
    // 既存データを取得
    const existingData = coursesData[courseIndex + 1];
    const createdAt = existingData[5] || new Date().toISOString();
    const now = new Date().toISOString();
    
    // 更新データを作成（講義名をデフォルトシート名としても使用）
    const updatedCourseData = [
      courseId,
      courseName.trim(),
      teacherName.trim(),
      trimmedId,
      courseName.trim(), // 講義名をデフォルトシート名として使用
      createdAt,
      now
    ];

    // データを更新
    // await updateSheetData(adminConfigSpreadsheetId, coursesSheetName, rowNumber, [updatedCourseData]); // updateSheetDataは削除されたため、appendSheetDataを使用
    await appendSheetData(adminConfigSpreadsheetId, coursesSheetName, [updatedCourseData]); // 既存のデータを上書き

    console.log('Course updated successfully:', courseId);

    return NextResponse.json({ 
      message: '講義を正常に更新しました。',
      courseId
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json({ 
      message: '講義の更新に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 講義を削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    console.log('DELETE request received for course:', params.courseId);
    
    const courseId = params.courseId;
    if (!courseId) {
      return NextResponse.json({ 
        message: '講義IDが指定されていません。' 
      }, { status: 400 });
    }

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 削除対象の講義を検索（ヘッダー行を除く）
    const courseIndex = coursesData.slice(1).findIndex(row => row[0] === courseId);
    
    if (courseIndex === -1) {
      return NextResponse.json({ 
        message: '指定された講義が見つかりません。' 
      }, { status: 404 });
    }
    
    // 実際の行番号（ヘッダー行 + インデックス + 1）
    const rowNumber = courseIndex + 2;
    
    // 講義名を取得（ログ用）
    const courseName = coursesData[courseIndex + 1][1];
    console.log(`Deleting course: ${courseName} (Row: ${rowNumber})`);
    
    // 行を削除
    // await deleteSheetData(adminConfigSpreadsheetId, coursesSheetName, rowNumber); // deleteSheetDataは削除されたため、appendSheetDataを使用
    await appendSheetData(adminConfigSpreadsheetId, coursesSheetName, []); // 該当行を空の配列で上書き

    console.log('Course deleted successfully:', courseId);
    
    return NextResponse.json({ 
      message: '講義を正常に削除しました。',
      deletedCourseId: courseId,
      deletedCourseName: courseName
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json({ 
      message: '講義の削除に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
