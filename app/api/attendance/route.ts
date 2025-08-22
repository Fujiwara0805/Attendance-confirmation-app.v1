import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminConfigSpreadsheetId, getSheetData, createSheetIfEmpty, appendSheetData } from '@/lib/googleSheets';

// 出席データのヘッダー
const ATTENDANCE_HEADERS = [
  'ID', 'Date', 'ClassName', 'StudentID', 'Grade', 'Name', 'Department', 'Feedback', 'Latitude', 'Longitude', 'CreatedAt'
];

// 講義IDから対応するスプレッドシートIDを取得（新機能）
const getCourseSpreadsheetIdById = async (courseId: string) => {
  try {
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 講義IDに一致するデータを検索（A列：row[0]）
    const courseRow = coursesData.find(row => row[0] === courseId);
    
    if (courseRow && courseRow[3]) {
      return {
        spreadsheetId: courseRow[3],
        defaultSheetName: courseRow[4] || 'Attendance',
        courseName: courseRow[1] // 講義名も返却
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting course by ID:', error);
    return null;
  }
};

// 講義名に対応するスプレッドシートIDを取得（既存機能）
const getCourseSpreadsheetId = async (className: string) => {
  try {
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 講義名に一致するデータを検索（B列：row[1]）
    const courseRow = coursesData.find(row => row[1] === className);
    
    if (courseRow && courseRow[3]) {
      return {
        spreadsheetId: courseRow[3],
        defaultSheetName: courseRow[4] || 'Attendance'
      };
    }
    
    // 講義が見つからない場合はデフォルト設定を使用
    console.log(`Course not found: ${className}, using global settings`);
    return null;
  } catch (error) {
    console.error('Error getting course spreadsheet ID:', error);
    return null;
  }
};

// デフォルトスプレッドシート設定を取得（既存機能）
const getGlobalSpreadsheetId = async () => {
  try {
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const appSettingsSheetName = 'AppSettings';
    
    const settingsData = await getSheetData(adminConfigSpreadsheetId, appSettingsSheetName);
    const globalSpreadsheetIdRow = settingsData.find(row => row[0] === 'GLOBAL_SPREADSHEET_ID');
    const globalDefaultSheetNameRow = settingsData.find(row => row[0] === 'GLOBAL_DEFAULT_SHEET_NAME');
    
    return {
      spreadsheetId: globalSpreadsheetIdRow?.[1],
      defaultSheetName: globalDefaultSheetNameRow?.[1] || 'Attendance'
    };
  } catch (error) {
    console.error('Error getting global spreadsheet settings:', error);
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    const { 
      date, 
      class_name, 
      student_id, 
      grade, 
      name, 
      department, 
      feedback, 
      latitude, 
      longitude,
      courseId // 🆕 新しいパラメータ（オプショナル）
    } = await req.json();

    // 必須フィールドの検証
    if (!date || !student_id || !grade || !name || !department || !latitude || !longitude) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    let spreadsheetConfig = null;
    let finalClassName = class_name;

    // 🆕 新方式：courseId が提供された場合はIDベースで検索
    if (courseId) {
      spreadsheetConfig = await getCourseSpreadsheetIdById(courseId);
      if (spreadsheetConfig) {
        finalClassName = spreadsheetConfig.courseName; // IDから講義名を取得
      }
    } 
    // 🔄 従来方式：講義名ベースで検索（後方互換性のため残す）
    else if (class_name) {
      spreadsheetConfig = await getCourseSpreadsheetId(class_name);
    }
    
    // どちらでも見つからない場合はclass_nameが必須
    if (!spreadsheetConfig && !class_name) {
      return NextResponse.json({ 
        message: 'Either courseId or class_name is required' 
      }, { status: 400 });
    }
    
    // 講義が見つからない場合はグローバル設定を使用
    if (!spreadsheetConfig) {
      spreadsheetConfig = await getGlobalSpreadsheetId();
    }
    
    if (!spreadsheetConfig || !spreadsheetConfig.spreadsheetId) {
      return NextResponse.json({ 
        message: 'Spreadsheet not configured for this course. Please contact administrator.' 
      }, { status: 400 });
    }

    // シート名を決定
    const attendanceSheetName = `${spreadsheetConfig.defaultSheetName}`;

    // シートが存在しない、または空の場合はヘッダーを作成
    await createSheetIfEmpty(spreadsheetConfig.spreadsheetId, attendanceSheetName, ATTENDANCE_HEADERS);

    // サーバーサイドでIDとタイムスタンプを生成
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    // スプレッドシートに書き込むデータの形式
    const values = [
      [
        id,
        date,
        finalClassName, // 確定した講義名を使用
        student_id,
        grade,
        name,
        department,
        feedback || '',
        latitude,
        longitude,
        createdAt,
      ],
    ];

    await appendSheetData(spreadsheetConfig.spreadsheetId, attendanceSheetName, values);

    return NextResponse.json({ 
      message: 'Attendance recorded successfully!',
      spreadsheetId: spreadsheetConfig.spreadsheetId,
      sheetName: attendanceSheetName,
      courseName: finalClassName,
      method: courseId ? 'courseId' : 'className' // デバッグ用
    }, { status: 200 });
  } catch (error) {
    console.error('Error recording attendance:', error);
    return NextResponse.json({ 
      message: 'Failed to record attendance',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}