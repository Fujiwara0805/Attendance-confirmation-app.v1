import { NextRequest, NextResponse } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, updateSheetData, createSheetIfEmpty, clearSheetData } from '@/lib/googleSheets';
import { FormField } from '@/app/types';
import { generateSpreadsheetHeaders } from '@/lib/formUtils';

// フォーム項目を取得
export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    const courseRow = coursesData.find(row => row[0] === courseId);
    
    if (!courseRow) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }
    
    // カスタムフォーム項目を取得（JSON形式で保存されていると仮定）
    console.log('講義行データ:', courseRow);
    console.log('カスタムフォーム項目（生データ）:', courseRow[6]);
    console.log('デフォルトフォーム使用フラグ（生データ）:', courseRow[7]);
    
    let customFormFields = null;
    if (courseRow[6]) {
      try {
        customFormFields = JSON.parse(courseRow[6]);
        console.log('パースされたカスタムフォーム項目:', customFormFields);
      } catch (parseError) {
        console.error('JSON解析エラー:', parseError);
        customFormFields = null;
      }
    }
    
    const useDefaultForm = courseRow[7] === 'true' || courseRow[7] === true || !courseRow[7]; // より明確な判定
    console.log('useDefaultForm判定:', courseRow[7], '->', useDefaultForm);
    console.log('最終的な設定:', { customFormFields, useDefaultForm });
    
    return NextResponse.json({
      customFormFields,
      useDefaultForm
    });
  } catch (error) {
    console.error('Error fetching form fields:', error);
    return NextResponse.json(
      { message: 'Failed to fetch form fields' },
      { status: 500 }
    );
  }
}

// フォーム項目を更新
export async function PUT(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    const { customFormFields, useDefaultForm } = await req.json();
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    const courseIndex = coursesData.findIndex(row => row[0] === courseId);
    
    if (courseIndex === -1) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }
    
    const courseRow = coursesData[courseIndex];
    const spreadsheetId = courseRow[3]; // スプレッドシートID
    const courseName = courseRow[1]; // 講義名
    const sheetName = courseName; // シート名は講義名と同じ
    
    // データを更新
    const updatedRow = [...courseRow];
    updatedRow[6] = JSON.stringify(customFormFields); // カスタムフォーム項目
    updatedRow[7] = useDefaultForm.toString(); // デフォルトフォーム使用フラグ
    
    // 講義設定スプレッドシートを更新
    await updateSheetData(
      adminConfigSpreadsheetId,
      coursesSheetName,
      courseIndex + 1, // 1-indexed
      [updatedRow]
    );
    
    // 出席データ用スプレッドシートのヘッダーを更新
    if (!useDefaultForm && customFormFields) {
      try {
        const headers = generateSpreadsheetHeaders(customFormFields);
        
        // 既存データを確認
        let existingData = [];
        try {
          existingData = await getSheetData(spreadsheetId, sheetName);
        } catch (getDataError: any) {
          console.log('シートが存在しないか、データ取得に失敗:', getDataError.message);
          existingData = [];
        }
        
        if (existingData.length === 0) {
          // データがない場合は新規作成
          await createSheetIfEmpty(spreadsheetId, sheetName, headers);
        } else {
          // 既存データがある場合は全データを削除して新しいヘッダーで再作成
          console.log('既存データを削除して新しいヘッダーで再作成します');
          
          // シート全体をクリア
          await clearSheetData(spreadsheetId, sheetName);
          
          // 新しいヘッダーで再作成
          await createSheetIfEmpty(spreadsheetId, sheetName, headers);
        }
        
        console.log('スプレッドシートヘッダーを更新しました:', headers);
      } catch (headerError) {
        console.error('ヘッダー更新エラー:', headerError);
        // ヘッダー更新に失敗してもフォーム設定は保存済みなので、エラーとしない
      }
    }
    
    return NextResponse.json({
      message: 'Form fields updated successfully',
      customFormFields,
      useDefaultForm
    });
  } catch (error) {
    console.error('Error updating form fields:', error);
    return NextResponse.json(
      { message: 'Failed to update form fields' },
      { status: 500 }
    );
  }
}
