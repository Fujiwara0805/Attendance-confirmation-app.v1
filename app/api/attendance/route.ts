import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAdminConfigSpreadsheetId, getSheetData, createSheetIfEmpty, appendSheetData } from '@/lib/googleSheets';
import { CustomFormField } from '@/app/types';
import { cache, generateCacheKey } from '@/lib/cache';

// デフォルト出席データのヘッダー
const DEFAULT_ATTENDANCE_HEADERS = [
  'ID', 'Date', 'ClassName', 'StudentID', 'Grade', 'Name', 'Department', 'Feedback', 'Latitude', 'Longitude', 'CreatedAt'
];

// 動的ヘッダー生成
const generateDynamicHeaders = (customFields: CustomFormField[], enabledDefaultFields: string[] = []) => {
  const headers = ['ID']; // IDは常に最初
  
  // デフォルトフィールドの追加
  const defaultFieldMap: { [key: string]: string } = {
    'date': 'Date',
    'class_name': 'ClassName', 
    'student_id': 'StudentID',
    'grade': 'Grade',
    'name': 'Name',
    'department': 'Department',
    'feedback': 'Feedback'
  };

  enabledDefaultFields.forEach(fieldKey => {
    if (defaultFieldMap[fieldKey]) {
      headers.push(defaultFieldMap[fieldKey]);
    }
  });

  // カスタムフィールドの追加
  customFields.forEach(field => {
    headers.push(field.label || field.name);
  });

  // 位置情報とタイムスタンプは常に最後
  headers.push('Latitude', 'Longitude', 'CreatedAt');
  
  return headers;
};

// 講義IDから対応するスプレッドシートIDを取得（新機能）
const getCourseSpreadsheetIdById = async (courseId: string) => {
  try {
    // キャッシュから取得を試行
    const cacheKey = generateCacheKey('course-spreadsheet', courseId);
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const coursesSheetName = 'Courses';
    
    // 講義データを取得
    const coursesData = await getSheetData(adminConfigSpreadsheetId, coursesSheetName);
    
    // 講義IDに一致するデータを検索（A列：row[0]）
    const courseRow = coursesData.find(row => row[0] === courseId);
    
    if (courseRow && courseRow[3]) {
      const result = {
        spreadsheetId: courseRow[3],
        defaultSheetName: courseRow[4] || 'Attendance',
        courseName: courseRow[1] // 講義名も返却
      };
      
      // キャッシュに保存（5分間）
      cache.set(cacheKey, result, 300);
      
      return result;
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
    const requestBody = await req.json();
    
    // バッチ処理かどうかを判定
    if (Array.isArray(requestBody.submissions)) {
      return await handleBatchSubmissions(requestBody);
    }
    
    // 単一の出席データ処理（既存の処理）
    return await handleSingleSubmission(requestBody);
  } catch (error) {
    console.error('Error in attendance API:', error);
    return NextResponse.json({ 
      message: 'Failed to process attendance',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// バッチ処理用の関数
async function handleBatchSubmissions(requestBody: any) {
  const { submissions, courseId, customFields = [] } = requestBody;
  
  if (!Array.isArray(submissions) || submissions.length === 0) {
    return NextResponse.json({ message: 'No submissions provided' }, { status: 400 });
  }
  
  // 講義設定を取得
  let spreadsheetConfig = null;
  if (courseId) {
    spreadsheetConfig = await getCourseSpreadsheetIdById(courseId);
  }
  
  if (!spreadsheetConfig) {
    spreadsheetConfig = await getGlobalSpreadsheetId();
  }
  
  if (!spreadsheetConfig || !spreadsheetConfig.spreadsheetId) {
    return NextResponse.json({ 
      message: 'Spreadsheet not configured for this course. Please contact administrator.' 
    }, { status: 400 });
  }
  
  const attendanceSheetName = `${spreadsheetConfig.defaultSheetName}`;
  
  // 動的ヘッダーを生成（最初の提出データから）
  const firstSubmission = submissions[0];
  const enabledDefaultFields = Object.keys(firstSubmission).filter(key => 
    ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'].includes(key)
  );
  const dynamicHeaders = generateDynamicHeaders(customFields, enabledDefaultFields);
  
  // シートが存在しない、または空の場合はヘッダーを作成
  await createSheetIfEmpty(spreadsheetConfig.spreadsheetId, attendanceSheetName, dynamicHeaders);
  
  // バッチデータを準備
  const batchData = submissions.map((submission: any) => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    
    const rowData = [id]; // IDは常に最初
    
    // デフォルトフィールドのデータを追加
    const defaultFieldMap: { [key: string]: string } = {
      'date': 'date',
      'class_name': 'class_name',
      'student_id': 'student_id',
      'grade': 'grade',
      'name': 'name',
      'department': 'department',
      'feedback': 'feedback'
    };

    enabledDefaultFields.forEach(fieldKey => {
      if (defaultFieldMap[fieldKey]) {
        let value = submission[fieldKey] || '';
        // 講義名の特別処理
        if (fieldKey === 'class_name') {
          value = spreadsheetConfig.courseName || value;
        }
        rowData.push(value);
      }
    });

    // カスタムフィールドのデータを追加
    customFields.forEach((field: CustomFormField) => {
      rowData.push(submission[field.name] || '');
    });

    // 位置情報とタイムスタンプを最後に追加
    rowData.push(submission.latitude || '', submission.longitude || '', createdAt);
    
    return rowData;
  });
  
  // バッチでデータを追加
  await appendSheetData(spreadsheetConfig.spreadsheetId, attendanceSheetName, batchData);
  
  return NextResponse.json({ 
    message: `${submissions.length} attendance records submitted successfully!`,
    spreadsheetId: spreadsheetConfig.spreadsheetId,
    sheetName: attendanceSheetName,
    count: submissions.length
  }, { status: 200 });
}

// 単一提出処理用の関数（既存の処理をリファクタリング）
async function handleSingleSubmission(requestBody: any) {
  const { 
    latitude, 
    longitude,
    courseId,
    customFields = [] // カスタムフィールド定義
  } = requestBody;

  // customFieldsとrequestBodyから動的にデータを抽出
  const formData: { [key: string]: any } = {};
  
  // 基本的なフィールドを抽出
  const basicFields = ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'];
  basicFields.forEach(field => {
    if (requestBody[field] !== undefined) {
      formData[field] = requestBody[field];
    }
  });

  // カスタムフィールドを抽出
  customFields.forEach((field: CustomFormField) => {
    if (requestBody[field.name] !== undefined) {
      formData[field.name] = requestBody[field.name];
    }
  });

  // 必須フィールドの検証（動的）
  if (!latitude || !longitude) {
    return NextResponse.json({ message: 'Location data is required' }, { status: 400 });
  }

  // 基本的な必須フィールドの検証（存在する場合のみ）
  const requiredFields = ['student_id', 'name'];
  for (const field of requiredFields) {
    if (formData[field] === undefined || formData[field] === '') {
      return NextResponse.json({ message: `${field} is required` }, { status: 400 });
    }
  }

  let spreadsheetConfig = null;
  let finalClassName = formData.class_name;

  // 🆕 新方式：courseId が提供された場合はIDベースで検索
  if (courseId) {
    spreadsheetConfig = await getCourseSpreadsheetIdById(courseId);
    if (spreadsheetConfig) {
      finalClassName = spreadsheetConfig.courseName; // IDから講義名を取得
    }
  } 
  // 🔄 従来方式：講義名ベースで検索（後方互換性のため残す）
  else if (formData.class_name) {
    spreadsheetConfig = await getCourseSpreadsheetId(formData.class_name);
  }
  
  // どちらでも見つからない場合はclass_nameが必須
  if (!spreadsheetConfig && !formData.class_name) {
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

  // 動的ヘッダーを生成
  const enabledDefaultFields = Object.keys(formData).filter(key => 
    ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'].includes(key)
  );
  const dynamicHeaders = generateDynamicHeaders(customFields, enabledDefaultFields);

  // シートが存在しない、または空の場合はヘッダーを作成
  await createSheetIfEmpty(spreadsheetConfig.spreadsheetId, attendanceSheetName, dynamicHeaders);

  // サーバーサイドでIDとタイムスタンプを生成
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  // 動的にデータ行を構築
  const rowData = [id]; // IDは常に最初
  
  // デフォルトフィールドのデータを追加
  const defaultFieldMap: { [key: string]: string } = {
    'date': 'date',
    'class_name': 'class_name',
    'student_id': 'student_id',
    'grade': 'grade',
    'name': 'name',
    'department': 'department',
    'feedback': 'feedback'
  };

  enabledDefaultFields.forEach(fieldKey => {
    if (defaultFieldMap[fieldKey]) {
      let value = formData[fieldKey] || '';
      // 講義名の特別処理
      if (fieldKey === 'class_name') {
        value = finalClassName || value;
      }
      rowData.push(value);
    }
  });

  // カスタムフィールドのデータを追加
  customFields.forEach((field: CustomFormField) => {
    rowData.push(formData[field.name] || '');
  });

  // 位置情報とタイムスタンプを最後に追加
  rowData.push(latitude, longitude, createdAt);

  const values = [rowData];

  await appendSheetData(spreadsheetConfig.spreadsheetId, attendanceSheetName, values);

  return NextResponse.json({ 
    message: 'Attendance recorded successfully!',
    spreadsheetId: spreadsheetConfig.spreadsheetId,
    sheetName: attendanceSheetName,
    courseName: finalClassName,
    method: courseId ? 'courseId' : 'className' // デバッグ用
  }, { status: 200 });
}