import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, createSheetIfEmpty, appendSheetData, updateSheetData } from '@/lib/googleSheets';
import { getCurrentUser } from '@/lib/auth';
import { cache, generateCacheKey } from '@/lib/cache';

// CourseFormConfigs シートの構造  
const COURSE_FORM_CONFIGS_HEADERS = [
  'CourseID', 'TemplateID', 'CustomFields', 'EnabledDefaultFields', 'UpdatedAt'
];

// 講義のフォーム設定を取得
export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    const courseId = params.courseId;
    
    // キャッシュから取得を試行
    const cacheKey = generateCacheKey('form-config', courseId);
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached form config for courseId:', courseId);
      return NextResponse.json(cachedData);
    }
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const configsSheetName = 'CourseFormConfigs';
    
    // CourseFormConfigsシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, configsSheetName, COURSE_FORM_CONFIGS_HEADERS);
    
    // 講義のフォーム設定データを取得
    const configsData = await getSheetData(adminConfigSpreadsheetId, configsSheetName);
    const courseConfig = configsData.find(row => row[0] === courseId);
    
    if (!courseConfig) {
      // デフォルト設定を返す
      return NextResponse.json({
        config: {
          courseId,
          templateId: null,
          customFields: [],
          enabledDefaultFields: ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback']
        }
      }, { status: 200 });
    }

    let customFields = [];
    let enabledDefaultFields = ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'];

    try {
      // JSONパースを安全に実行
      if (courseConfig[2] && courseConfig[2].trim() !== '' && courseConfig[2] !== 'CustomFields') {
        customFields = JSON.parse(courseConfig[2]);
      }
      if (courseConfig[3] && courseConfig[3].trim() !== '' && courseConfig[3] !== 'EnabledDefaultFields') {
        enabledDefaultFields = JSON.parse(courseConfig[3]);
      }
    } catch (parseError) {
      console.warn(`Failed to parse form config for course ${courseId}:`, parseError);
      // パースに失敗した場合はデフォルト値を使用
    }

    const config = {
      courseId: courseConfig[0],
      templateId: courseConfig[1] || null,
      customFields,
      enabledDefaultFields
    };

    const responseData = { config };
    
    // キャッシュに保存（5分間）
    cache.set(cacheKey, responseData, 300);

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error fetching course form config:', error);
    return NextResponse.json({ 
      message: '講義のフォーム設定の取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 講義のフォーム設定を更新
export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    const courseId = params.courseId;
    const body = await req.json();
    const { templateId, customFields, enabledDefaultFields } = body;

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const configsSheetName = 'CourseFormConfigs';
    
    // CourseFormConfigsシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, configsSheetName, COURSE_FORM_CONFIGS_HEADERS);
    
    // 既存の設定データを取得
    const configsData = await getSheetData(adminConfigSpreadsheetId, configsSheetName);
    const existingConfigIndex = configsData.findIndex(row => row[0] === courseId);
    
    const now = new Date().toISOString();
    const configData = [
      courseId,
      templateId || '',
      JSON.stringify(customFields || []),
      JSON.stringify(enabledDefaultFields || []),
      now
    ];

    if (existingConfigIndex >= 0) {
      // 既存設定を更新
      await updateSheetData(
        adminConfigSpreadsheetId,
        configsSheetName,
        existingConfigIndex + 2, // ヘッダー行を考慮
        [configData]
      );
    } else {
      // 新規設定を追加
      await appendSheetData(adminConfigSpreadsheetId, configsSheetName, [configData]);
    }

    console.log('Course form config updated successfully:', courseId);

    return NextResponse.json({ 
      message: '講義のフォーム設定を正常に更新しました'
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating course form config:', error);
    return NextResponse.json({ 
      message: '講義のフォーム設定の更新に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
