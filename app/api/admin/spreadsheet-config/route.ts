import { NextResponse, NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// 動的レンダリングを強制する
export const dynamic = 'force-dynamic';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'attendance-config.json');

// 設定ファイルから出席データ用スプレッドシートIDを読み取り
const readConfig = async () => {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // ファイルが存在しない場合は空のオブジェクトを返す
    return {};
  }
};

// 設定ファイルに出席データ用スプレッドシートIDを書き込み
const writeConfig = async (config: any) => {
  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
};

// 出席データ用スプレッドシートIDを取得
export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json({
      attendanceSpreadsheetId: config.attendanceSpreadsheetId || null,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ message: 'Failed to fetch settings' }, { status: 500 });
  }
}

// 出席データ用スプレッドシートIDを更新
export async function POST(req: NextRequest) {
  try {
    const { attendanceSpreadsheetId: newId } = await req.json();

    if (!newId) {
      return NextResponse.json({ message: 'Missing attendanceSpreadsheetId' }, { status: 400 });
    }

    // 設定ファイルに保存
    const config = await readConfig();
    config.attendanceSpreadsheetId = newId;
    await writeConfig(config);

    return NextResponse.json({ message: 'Attendance Spreadsheet ID updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating attendance spreadsheet ID:', error);
    return NextResponse.json({ message: 'Failed to update attendance spreadsheet ID' }, { status: 500 });
  }
}
