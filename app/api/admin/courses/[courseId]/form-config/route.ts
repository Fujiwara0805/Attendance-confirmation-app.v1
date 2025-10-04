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
      return NextResponse.json(cachedData);
    }
    
    // 環境変数の確認
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    
    const configsSheetName = 'CourseFormConfigs';
    
    // タイムアウト対策を追加
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Form config request timeout after 8 seconds')), 8000);
    });
    
    try {
      // createSheetIfEmptyを削除してAPI呼び出しを削減
      const dataPromise = getSheetData(adminConfigSpreadsheetId, configsSheetName);
      const configsData = await Promise.race([dataPromise, timeoutPromise]) as any[][];
      
      const courseConfig = configsData.find(row => row[0] === courseId);
      
      if (!courseConfig) {
        // デフォルト設定を返す
        const defaultConfig = {
          config: {
            courseId,
            templateId: null,
            customFields: [],
            enabledDefaultFields: ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback']
          }
        };
        
        // キャッシュに保存（15分間に延長）
        cache.set(cacheKey, defaultConfig, 900);
        
        return NextResponse.json(defaultConfig, { status: 200 });
      }
      
      // 設定データをパース
      const templateId = courseConfig[1] || null;
      const customFieldsJson = courseConfig[2] || '[]';
      const enabledDefaultFieldsJson = courseConfig[3] || '["date", "class_name", "student_id", "grade", "name", "department", "feedback"]';
      
      const customFields = JSON.parse(customFieldsJson);
      const enabledDefaultFields = JSON.parse(enabledDefaultFieldsJson);
      
      const responseData = {
        config: {
          courseId,
          templateId,
          customFields,
          enabledDefaultFields
        }
      };
      
      // キャッシュに保存（15分間に延長）
      cache.set(cacheKey, responseData, 900);
      
      return NextResponse.json(responseData, { status: 200 });
      
    } catch (sheetError) {
      // シートが存在しない場合はデフォルト設定を返す
      const defaultConfig = {
        config: {
          courseId,
          templateId: null,
          customFields: [],
          enabledDefaultFields: ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback']
        }
      };
      
      // デフォルト設定もキャッシュ（15分間）
      cache.set(cacheKey, defaultConfig, 900);
      
      return NextResponse.json(defaultConfig, { status: 200 });
    }

    // 削除：重複したコードを削除
  } catch (error) {
    console.error('Error fetching course form config:', error);
    
    // より詳細なエラー情報をログに出力
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // 環境変数関連のエラーの場合
    if (error instanceof Error && error.message.includes('ADMIN_CONFIG_SPREADSHEET_ID')) {
      return NextResponse.json({ 
        message: '管理設定が正しく設定されていません。環境変数を確認してください。',
        error: 'Configuration error',
        details: error.message
      }, { status: 500 });
    }
    
    // Google Sheets API関連のエラーの場合
    if (error instanceof Error && (error.message.includes('403') || error.message.includes('401'))) {
      return NextResponse.json({ 
        message: 'Google Sheets APIの認証に失敗しました。',
        error: 'Authentication error',
        details: error.message
      }, { status: 500 });
    }
    
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
