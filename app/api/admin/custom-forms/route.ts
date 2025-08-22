import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, createSheetIfEmpty, appendSheetData, updateSheetData } from '@/lib/googleSheets';
import { getCurrentUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// CustomFormTemplates シートの構造
const CUSTOM_FORM_TEMPLATES_HEADERS = [
  'ID', 'Name', 'Description', 'Fields', 'IsDefault', 'CreatedBy', 'CreatedAt', 'UpdatedAt'
];

// カスタムフォームテンプレート一覧を取得
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const templatesSheetName = 'CustomFormTemplates';
    
    // CustomFormTemplatesシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, templatesSheetName, CUSTOM_FORM_TEMPLATES_HEADERS);
    
    // テンプレートデータを取得
    const templatesData = await getSheetData(adminConfigSpreadsheetId, templatesSheetName);
    
    const templates = templatesData
      .filter(row => row[0] && row[0] !== 'ID' && row[0].trim() !== '') // ヘッダー行と空行をスキップ
      .map(row => {
        let fields = [];
        try {
          // Fieldsデータが存在し、ヘッダー文字列でない場合のみJSONパースを試行
          if (row[3] && row[3].trim() !== '' && row[3] !== 'Fields') {
            fields = JSON.parse(row[3]);
            // パース結果が配列でない場合は空配列にする
            if (!Array.isArray(fields)) {
              fields = [];
            }
          }
        } catch (parseError) {
          console.warn(`Failed to parse fields for template ${row[0]}:`, parseError);
          fields = []; // パースに失敗した場合は空配列
        }

        return {
          id: row[0],
          name: row[1],
          description: row[2] || '',
          fields,
          isDefault: row[4] === 'true',
          createdBy: row[5],
          createdAt: row[6],
          updatedAt: row[7]
        };
      });

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error('Error fetching custom form templates:', error);
    return NextResponse.json({ 
      message: 'カスタムフォームテンプレートの取得に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 新しいカスタムフォームテンプレートを作成
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, fields, isDefault } = body;

    if (!name || !fields || !Array.isArray(fields)) {
      return NextResponse.json({ 
        message: 'テンプレート名とフィールドは必須項目です' 
      }, { status: 400 });
    }

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const templatesSheetName = 'CustomFormTemplates';
    
    // CustomFormTemplatesシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, templatesSheetName, CUSTOM_FORM_TEMPLATES_HEADERS);
    
    // 新規テンプレートデータを作成
    const templateId = uuidv4();
    const now = new Date().toISOString();
    const newTemplateData = [
      templateId,
      name.trim(),
      description?.trim() || '',
      JSON.stringify(fields),
      isDefault ? 'true' : 'false',
      user.email,
      now,
      now
    ];

    // データを追加
    await appendSheetData(adminConfigSpreadsheetId, templatesSheetName, [newTemplateData]);

    console.log('New custom form template added successfully:', templateId);

    return NextResponse.json({ 
      message: 'カスタムフォームテンプレートを正常に作成しました',
      templateId
    }, { status: 200 });
  } catch (error) {
    console.error('Error creating custom form template:', error);
    return NextResponse.json({ 
      message: 'カスタムフォームテンプレートの作成に失敗しました',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}