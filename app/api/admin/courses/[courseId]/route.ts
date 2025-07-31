import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, deleteSheetData } from '@/lib/googleSheets';

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
