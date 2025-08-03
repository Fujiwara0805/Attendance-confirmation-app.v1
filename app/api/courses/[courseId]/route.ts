// /app/api/courses/[courseId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData } from '@/lib/googleSheets';

// 既存のライブラリ関数を使用して講義情報を取得
async function getCourseById(courseId: string) {
  try {
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses'; // 既存コードと同じシート名

    // 講義データを取得（既存関数を活用）
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    if (!coursesData || coursesData.length === 0) {
      return null;
    }

    // ID列（A列：row[0]）でマッチングを確認
    const courseRow = coursesData.find(row => row[0] === courseId);
    
    if (courseRow) {
      // 既存のデータ構造に合わせて返却
      const course = {
        id: courseRow[0] || '',
        courseName: courseRow[1] || '',
        teacherName: courseRow[2] || '',
        spreadsheetId: courseRow[3] || '',
        defaultSheetName: courseRow[4] || 'Attendance',
        createdBy: courseRow[5] || '',
        createdAt: courseRow[6] || '',
        lastUpdated: courseRow[7] || new Date().toISOString(),
      };
      
      return course;
    }

    return null; // 見つからない場合
  } catch (error) {
    console.error('講義取得エラー:', error);
    throw error;
  }
}

// GET /api/courses/[courseId] - 特定の講義情報を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    
    if (!courseId) {
      return NextResponse.json(
        { error: '講義IDが指定されていません' },
        { status: 400 }
      );
    }

    // スプレッドシートから特定の講義を取得
    const course = await getCourseById(courseId);
    
    if (!course) {
      return NextResponse.json(
        { error: '指定された講義が見つかりません' },
        { status: 404 }
      );
    }
    
    // スプレッドシートIDなどの機密情報は除外して返却
    const publicCourseInfo = {
      id: course.id,
      courseName: course.courseName,
      teacherName: course.teacherName,
      defaultSheetName: course.defaultSheetName,
      lastUpdated: course.lastUpdated,
    };
    
    return NextResponse.json({ 
      course: publicCourseInfo,
      message: '講義情報を取得しました'
    });
    
  } catch (error) {
    console.error('API エラー:', error);
    return NextResponse.json(
      { error: '講義情報の取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}