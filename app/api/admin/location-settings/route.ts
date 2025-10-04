import { NextResponse, NextRequest } from 'next/server';
import { getAdminConfigSpreadsheetId, getSheetData, updateSheetData, createSheetIfEmpty, appendSheetData } from '@/lib/googleSheets';
import { cache, generateCacheKey } from '@/lib/cache';

export async function GET() {
  try {
    // キャッシュから取得を試行
    const cacheKey = generateCacheKey('location-settings');
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached location settings');
      return NextResponse.json(cachedData);
    }
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const settingsSheetName = 'LocationSettings';
    
    await createSheetIfEmpty(adminConfigSpreadsheetId, settingsSheetName, [
      'Key', 'Value', 'Description'
    ]);
    
    const settingsData = await getSheetData(adminConfigSpreadsheetId, settingsSheetName);
    
    const defaultLocationSettings = {
      latitude: parseFloat(settingsData.find(row => row[0] === 'DEFAULT_LATITUDE')?.[1] || '33.1751332'),
      longitude: parseFloat(settingsData.find(row => row[0] === 'DEFAULT_LONGITUDE')?.[1] || '131.6138803'),
      radius: parseFloat(settingsData.find(row => row[0] === 'DEFAULT_RADIUS')?.[1] || '0.5'),
      locationName: settingsData.find(row => row[0] === 'DEFAULT_LOCATION_NAME')?.[1] || ''
    };
    
    const responseData = { defaultLocationSettings };
    
    // キャッシュに保存（10分間）
    cache.set(cacheKey, responseData, 600);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching location settings:', error);
    return NextResponse.json({ error: 'Failed to fetch location settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { latitude, longitude, radius, locationName } = await req.json();
    
    const adminConfigSpreadsheetId = getAdminConfigSpreadsheetId();
    const settingsSheetName = 'LocationSettings';
    
    // 設定を更新
    const settingsToUpdate = [
      ['DEFAULT_LATITUDE', latitude.toString(), 'デフォルト緯度'],
      ['DEFAULT_LONGITUDE', longitude.toString(), 'デフォルト経度'],
      ['DEFAULT_RADIUS', radius.toString(), 'デフォルト許可範囲（km）'],
      ['DEFAULT_LOCATION_NAME', locationName || '', 'デフォルト場所名']
    ];
    
    // 既存データを取得して更新または追加
    const existingData = await getSheetData(adminConfigSpreadsheetId, settingsSheetName);
    
    for (const [key, value, description] of settingsToUpdate) {
      const existingRowIndex = existingData.findIndex(row => row[0] === key);
      if (existingRowIndex >= 0) {
        await updateSheetData(adminConfigSpreadsheetId, settingsSheetName, existingRowIndex + 1, [[key, value, description]]);
      } else {
        await appendSheetData(adminConfigSpreadsheetId, settingsSheetName, [[key, value, description]]);
      }
    }
    
    // キャッシュを無効化
    const cacheKey = generateCacheKey('location-settings');
    cache.delete(cacheKey);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating location settings:', error);
    return NextResponse.json({ error: 'Failed to update location settings' }, { status: 500 });
  }
}
