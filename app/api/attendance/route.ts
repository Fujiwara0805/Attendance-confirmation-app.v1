import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

// 動的レンダリングを強制する
export const dynamic = 'force-dynamic';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// 出席データのヘッダー
const ATTENDANCE_HEADERS = [
  'ID', 'Date', 'ClassName', 'StudentID', 'Grade', 'Name', 'Department', 'Feedback', 'Latitude', 'Longitude', 'CreatedAt'
];

const CONFIG_FILE_PATH = path.join(process.cwd(), 'attendance-config.json');

// 設定ファイルから管理者が設定したスプレッドシートIDを取得
const getAttendanceSpreadsheetId = async () => {
  try {
    const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf8');
    const config = JSON.parse(configData);
    return config.attendanceSpreadsheetId;
  } catch (error) {
    return null;
  }
};

// シートが存在しない場合や空の場合にヘッダーを作成
const createSheetIfEmpty = async (spreadsheetId: string, sheetName: string, headers: string[]) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
    }
  } catch (error: any) {
    if (error.code === 400 && error.message && error.message.includes("Unable to parse range")) {
      // シートを作成
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          }],
        },
      });

      // ヘッダーを書き込む
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
    } else {
      throw error;
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    const { date, class_name, student_id, grade, name, department, feedback, latitude, longitude } = await req.json();

    // 必須フィールドの検証
    if (!date || !class_name || !student_id || !grade || !name || !department || !latitude || !longitude) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const attendanceSpreadsheetId = await getAttendanceSpreadsheetId();
    if (!attendanceSpreadsheetId) {
      return NextResponse.json({ message: 'Attendance spreadsheet not configured' }, { status: 400 });
    }

    // 講義名に基づいてシート名を決定
    const attendanceSheetName = `${class_name}Attendance`;

    // シートが存在しない、または空の場合はヘッダーを作成
    await createSheetIfEmpty(attendanceSpreadsheetId, attendanceSheetName, ATTENDANCE_HEADERS);

    // サーバーサイドでIDとタイムスタンプを生成
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    // スプレッドシートに書き込むデータの形式
    const values = [
      [
        id,
        date,
        class_name,
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

    await sheets.spreadsheets.values.append({
      spreadsheetId: attendanceSpreadsheetId,
      range: `${attendanceSheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ message: 'Attendance recorded successfully!' }, { status: 200 });
  } catch (error) {
    console.error('Error recording attendance:', error);
    return NextResponse.json({ message: 'Failed to record attendance' }, { status: 500 });
  }
}