import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, updateSheetData, createSheetIfEmpty, appendSheetData } from '@/lib/googleSheets';

// AppSettings シートの構造
const APP_SETTINGS_HEADERS = ['Key', 'Value', 'Description'];

// 設定を読み取り
export async function GET() {
  try {
    console.log('GET request received for global settings');
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const appSettingsSheetName = 'AppSettings';
    
    // AppSettingsシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, appSettingsSheetName, APP_SETTINGS_HEADERS);
    
    // 設定データを取得
    const settingsData = await getSheetData(adminConfigSpreadsheetId, appSettingsSheetName);
    const globalSpreadsheetIdRow = settingsData.find(row => row[0] === 'GLOBAL_SPREADSHEET_ID');
    const globalDefaultSheetNameRow = settingsData.find(row => row[0] === 'GLOBAL_DEFAULT_SHEET_NAME');
    
    const globalSpreadsheetId = globalSpreadsheetIdRow?.[1] || null;
    const globalDefaultSheetName = globalDefaultSheetNameRow?.[1] || 'Attendance';
    
    console.log('Global settings read from spreadsheet:', { globalSpreadsheetId, globalDefaultSheetName });
    
    return NextResponse.json({
      globalSpreadsheetId,
      globalDefaultSheetName,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching global settings:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch global settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 設定を更新
export async function POST(req: NextRequest) {
  try {
    console.log('POST request received for global settings');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { globalSpreadsheetId: newId, globalDefaultSheetName: newSheetName } = body;

    if (!newId || typeof newId !== 'string' || !newId.trim()) {
      return NextResponse.json({ 
        message: 'グローバルスプレッドシートIDが無効です。正しいIDを入力してください。' 
      }, { status: 400 });
    }

    // スプレッドシートIDの形式を簡単にチェック
    const trimmedId = newId.trim();
    if (trimmedId.length < 20 || trimmedId.includes('/') || trimmedId.includes(' ')) {
      return NextResponse.json({ 
        message: 'スプレッドシートIDの形式が正しくありません。URLからIDのみを抽出してください。' 
      }, { status: 400 });
    }

    const trimmedSheetName = (newSheetName || 'Attendance').trim();

    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const appSettingsSheetName = 'AppSettings';
    
    // AppSettingsシートが存在しない場合は作成
    await createSheetIfEmpty(adminConfigSpreadsheetId, appSettingsSheetName, APP_SETTINGS_HEADERS);
    
    // 既存の設定データを取得
    const settingsData = await getSheetData(adminConfigSpreadsheetId, appSettingsSheetName);
    
    // グローバルスプレッドシートIDの更新または追加
    const globalSpreadsheetIdRowIndex = settingsData.findIndex(row => row[0] === 'GLOBAL_SPREADSHEET_ID');
    if (globalSpreadsheetIdRowIndex >= 0) {
      await updateSheetData(
        adminConfigSpreadsheetId, 
        appSettingsSheetName, 
        globalSpreadsheetIdRowIndex + 2, 
        [['GLOBAL_SPREADSHEET_ID', trimmedId, 'グローバル設定のスプレッドシートID']]
      );
    } else {
      await appendSheetData(
        adminConfigSpreadsheetId, 
        appSettingsSheetName, 
        [['GLOBAL_SPREADSHEET_ID', trimmedId, 'グローバル設定のスプレッドシートID']]
      );
    }

    // グローバルデフォルトシート名の更新または追加
    const globalDefaultSheetNameRowIndex = settingsData.findIndex(row => row[0] === 'GLOBAL_DEFAULT_SHEET_NAME');
    if (globalDefaultSheetNameRowIndex >= 0) {
      await updateSheetData(
        adminConfigSpreadsheetId, 
        appSettingsSheetName, 
        globalDefaultSheetNameRowIndex + 2, 
        [['GLOBAL_DEFAULT_SHEET_NAME', trimmedSheetName, 'グローバル設定のデフォルトシート名']]
      );
    } else {
      await appendSheetData(
        adminConfigSpreadsheetId, 
        appSettingsSheetName, 
        [['GLOBAL_DEFAULT_SHEET_NAME', trimmedSheetName, 'グローバル設定のデフォルトシート名']]
      );
    }

    console.log('Global settings saved successfully:', { globalSpreadsheetId: trimmedId, globalDefaultSheetName: trimmedSheetName });

    return NextResponse.json({ 
      message: 'グローバル設定を正常に保存しました。',
      globalSpreadsheetId: trimmedId,
      globalDefaultSheetName: trimmedSheetName
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating global settings:', error);
    return NextResponse.json({ 
      message: 'グローバル設定の保存に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
