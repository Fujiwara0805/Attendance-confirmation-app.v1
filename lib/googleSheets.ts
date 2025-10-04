import { google } from 'googleapis';

// OpenSSLエラーを回避するための設定
const createAuth = () => {
  // Vercel環境でのOpenSSL設定（プロセス開始時に1回だけ設定）
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    // OpenSSL設定を環境変数として設定
    if (!process.env.NODE_OPTIONS?.includes('--openssl-legacy-provider')) {
      process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --openssl-legacy-provider';
    }
  }

  // 秘密鍵の正規化処理を強化
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    ?.trim();

  if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('Google Service Account credentials are missing');
  }

  try {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } catch (error) {
    console.error('Google Auth creation failed:', error);
    throw error;
  }
};

const auth = createAuth();
export const sheets = google.sheets({ version: 'v4', auth });

/**
 * 環境変数から管理設定用スプレッドシートIDを取得します。
 * このIDはアプリケーションのコア設定を保存する固定のスプレッドシートIDです。
 */
export const getAdminConfigSpreadsheetId = () => {
  const spreadsheetId = process.env.ADMIN_CONFIG_SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    console.error('ADMIN_CONFIG_SPREADSHEET_ID environment variable is missing');
    throw new Error('ADMIN_CONFIG_SPREADSHEET_ID is not set in environment variables.');
  }
  return spreadsheetId;
};

/**
 * 管理設定スプレッドシートから勤怠データ用スプレッドシートIDを取得します。
 * このIDは管理者画面で設定可能です。
 */
export const getAttendanceSpreadsheetId = async () => {
  const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
  const appSettingsSheetName = 'AppSettings'; // 設定を保存するシート名

  // AppSettingsシートからATTENDANCE_DATA_SPREADSHEET_IDを取得
  const settingsData = await getSheetData(adminConfigSpreadsheetId, appSettingsSheetName);

  const attendanceSpreadsheetIdRow = settingsData.find(row => row[0] === 'ATTENDANCE_DATA_SPREADSHEET_ID');
  const attendanceSpreadsheetId = attendanceSpreadsheetIdRow?.[1]; // 'Value' 列

  if (!attendanceSpreadsheetId) {
    throw new Error('Attendance Data Spreadsheet ID is not set in AppSettings sheet.');
  }
  return attendanceSpreadsheetId;
};

/**
 * Rate Limitエラーに対する再試行機能付きでAPIを実行します
 */
const executeWithRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      // Rate Limitエラー（429）の場合のみリトライ
      if (error.code === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Rate limit exceeded. Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

/**
 * 指定されたスプレッドシートの指定されたシートからデータを取得します。
 * @param spreadsheetId 対象のスプレッドシートID
 * @param sheetName シート名
 * @returns 取得したデータの配列
 */
export const getSheetData = async (spreadsheetId: string, sheetName: string) => {
  const range = `${sheetName}!A:Z`; // A列からZ列までを対象とする (必要に応じて調整)

  return executeWithRetry(async () => {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || [];
  });
};

/**
 * 指定されたスプレッドシートの指定されたシートにデータを追加します。
 * @param spreadsheetId 対象のスプレッドシートID
 * @param sheetName シート名
 * @param values 追加するデータの配列 (例: [[value1, value2], [value3, value4]])
 */
export const appendSheetData = async (spreadsheetId: string, sheetName: string, values: any[][]) => {
  const range = `${sheetName}!A:A`; // 最初の列を基準に追加

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });
};

/**
 * 指定されたスプレッドシートの指定されたシートのデータを更新します。
 * @param spreadsheetId 対象のスプレッドシートID
 * @param sheetName シート名
 * @param rowNumber 更新する行番号 (1から始まる)
 * @param values 更新するデータの配列 (例: [[newValue1, newValue2]])
 */
export const updateSheetData = async (spreadsheetId: string, sheetName: string, rowNumber: number, values: any[][]) => {
  const range = `${sheetName}!A${rowNumber}`; // 指定された行のA列から更新

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  });
};

/**
 * 指定されたスプレッドシートの指定されたシートからデータを削除します。
 * @param spreadsheetId 対象のスプレッドシートID
 * @param sheetName シート名
 * @param rowNumber 削除する行番号 (1から始まる)
 */
export const deleteSheetData = async (spreadsheetId: string, sheetName: string, rowNumber: number) => {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteRange: {
          range: {
            sheetId: await getSheetIdByName(spreadsheetId, sheetName), // sheetIdを取得する必要がある
            startRowIndex: rowNumber - 1, // APIは0から始まるインデックス
            endRowIndex: rowNumber,
          },
          shiftDimension: 'ROWS',
        },
      }],
    },
  });
};

/**
 * シート名からシートIDを取得します。
 * @param spreadsheetId スプレッドシートID
 * @param sheetName シート名
 * @returns シートID
 */
const getSheetIdByName = async (spreadsheetId: string, sheetName: string): Promise<number> => {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet || sheet.properties?.sheetId === undefined || sheet.properties?.sheetId === null) {
    throw new Error(`Sheet with name "${sheetName}" not found or sheetId is missing.`);
  }
  return sheet.properties.sheetId;
};


/**
 * 指定されたスプレッドシートの指定されたシートが存在しない場合、または空の場合に指定されたヘッダー行を作成します。
 * @param spreadsheetId 対象のスプレッドシートID
 * @param sheetName シート名
 * @param headers 作成するヘッダーの配列
 */
export const createSheetIfEmpty = async (spreadsheetId: string, sheetName: string, headers: string[]) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1`, // 最初のセルをチェック
    });

    // データが空の場合 (response.data.values が存在しない、または空の配列の場合)
    if (!response.data.values || response.data.values.length === 0 || (response.data.values.length === 1 && response.data.values[0].length === 0)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
      console.log(`Headers for sheet '${sheetName}' created.`);
    }
  } catch (error: any) {
    // シートが存在しない場合のエラーを捕捉し、シートを作成してヘッダーを書き込む
    // エラーメッセージが "Unable to parse range" の場合、シートが存在しない可能性が高い
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
      console.log(`Sheet '${sheetName}' created.`);

      // 作成したシートにヘッダーを書き込む
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
      console.log(`Headers for new sheet '${sheetName}' created.`);
    } else {
      console.error(`Error checking or creating sheet '${sheetName}' headers:`, error);
      throw error;
    }
  }
};