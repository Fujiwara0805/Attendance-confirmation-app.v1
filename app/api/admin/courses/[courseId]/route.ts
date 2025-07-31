import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, deleteSheetData, updateSheetData } from '@/lib/googleSheets';

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
    await updateSheetData(adminConfigSpreadsheetId, coursesSheetName, rowNumber, [updatedCourseData]);

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
    await deleteSheetData(adminConfigSpreadsheetId, coursesSheetName, rowNumber);
    
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