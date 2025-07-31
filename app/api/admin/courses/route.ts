import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, appendSheetData, createSheetIfEmpty } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';

// 講義管理シートの構造
const COURSES_HEADERS = ['ID', 'CourseName', 'TeacherName', 'SpreadsheetId', 'DefaultSheetName', 'CreatedAt', 'LastUpdated'];

// 講義一覧を取得
export async function GET() {
  try {
    console.log('GET request received for courses');
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得（createSheetIfEmptyを削除してAPI呼び出しを削減）
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // ヘッダー行を除外してデータを整形
    const courses = coursesData.slice(1).map(row => ({
      id: row[0] || '',
      courseName: row[1] || '',
      teacherName: row[2] || '',
      spreadsheetId: row[3] || '',
      defaultSheetName: row[4] || 'Attendance',
      createdAt: row[5] || '',
      lastUpdated: row[6] || ''
    })).filter(course => course.id); // IDが存在するもののみ
    
    console.log('Courses read from spreadsheet:', courses.length);
    
    return NextResponse.json({
      courses,
      total: courses.length
    }, { status: 200 });
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
    console.log('POST request received for new course');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { courseName, teacherName, spreadsheetId, defaultSheetName } = body;

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
    
    // 既存の講義データを確認（重複チェック）
    const existingData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    const isDuplicate = existingData.some(row => 
      row[1] === courseName.trim() && row[2] === teacherName.trim()
    );
    
    if (isDuplicate) {
      return NextResponse.json({ 
        message: '同じ講義名・担当教員の組み合わせが既に存在します。' 
      }, { status: 400 });
    }

    // 新規講義データを作成
    const courseId = uuidv4();
    const now = new Date().toISOString();
    const newCourseData = [
      courseId,
      courseName.trim(),
      teacherName.trim(),
      trimmedId,
      (defaultSheetName || 'Attendance').trim(),
      now,
      now
    ];

    // データを追加
    await appendSheetData(adminConfigSpreadsheetId, coursesSheetName, [newCourseData]);

    console.log('New course added successfully:', courseId);

    return NextResponse.json({ 
      message: '講義を正常に追加しました。',
      courseId
    }, { status: 200 });
  } catch (error) {
    console.error('Error adding course:', error);
    return NextResponse.json({ 
      message: '講義の追加に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
