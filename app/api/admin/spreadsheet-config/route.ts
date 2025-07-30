import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'attendance-config.json');

// 設定ファイルから出席データ用スプレッドシートIDを読み取り
const readConfig = async () => {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // ファイルが存在しない場合は空のオブジェクトを返す
    console.log('Config file not found, creating default config');
    return {};
  }
};

// 設定ファイルに出席データ用スプレッドシートIDを書き込み
const writeConfig = async (config: any) => {
  try {
    // ディレクトリが存在することを確認
    const dir = path.dirname(CONFIG_FILE_PATH);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log('Config file written successfully:', config);
  } catch (error) {
    console.error('Error writing config file:', error);
    throw error;
  }
};

// 出席データ用スプレッドシートIDを取得
export async function GET() {
  try {
    console.log('GET request received for spreadsheet config');
    const config = await readConfig();
    console.log('Config read:', config);
    
    return NextResponse.json({
      attendanceSpreadsheetId: config.attendanceSpreadsheetId || null,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch settings',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 出席データ用スプレッドシートIDを更新
export async function POST(req: NextRequest) {
  try {
    console.log('POST request received for spreadsheet config');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { attendanceSpreadsheetId: newId } = body;

    if (!newId || typeof newId !== 'string' || !newId.trim()) {
      return NextResponse.json({ 
        message: 'スプレッドシートIDが無効です。正しいIDを入力してください。' 
      }, { status: 400 });
    }

    // スプレッドシートIDの形式を簡単にチェック
    const trimmedId = newId.trim();
    if (trimmedId.length < 20 || trimmedId.includes('/') || trimmedId.includes(' ')) {
      return NextResponse.json({ 
        message: 'スプレッドシートIDの形式が正しくありません。URLからIDのみを抽出してください。' 
      }, { status: 400 });
    }

    // 設定ファイルに保存
    const config = await readConfig();
    config.attendanceSpreadsheetId = trimmedId;
    await writeConfig(config);

    console.log('Spreadsheet ID saved successfully:', trimmedId);

    return NextResponse.json({ 
      message: 'スプレッドシートIDを正常に保存しました。',
      attendanceSpreadsheetId: trimmedId
    }, { status: 200 });
  } catch (error) {
    console.error('Error updating attendance spreadsheet ID:', error);
    return NextResponse.json({ 
      message: 'スプレッドシートIDの保存に失敗しました。',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}