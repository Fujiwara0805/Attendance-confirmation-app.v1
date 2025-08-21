'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search, Loader2 } from 'lucide-react';

interface LocationSettings {
  latitude: number;
  longitude: number;
  radius: number;
  locationName: string;
}

interface LocationSettingsFormProps {
  initialSettings?: LocationSettings;
  onSave: (settings: LocationSettings) => Promise<void>; // Promise<void>に変更
}

export default function LocationSettingsForm({ initialSettings, onSave }: LocationSettingsFormProps) {
  const [settings, setSettings] = useState<LocationSettings>(
    initialSettings || {
      latitude: 33.1751332,
      longitude: 131.6138803,
      radius: 0.5,
      locationName: '大分大学旦野原キャンパス'
    }
  );

  const [addressSearch, setAddressSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 保存中の状態を追加
  const [searchError, setSearchError] = useState<string | null>(null);

  // 住所から緯度・経度を取得する関数
  const searchByAddress = async () => {
    if (!addressSearch.trim()) {
      setSearchError('住所を入力してください');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Google Geocoding API を使用
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressSearch)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error('住所検索に失敗しました');
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const formattedAddress = data.results[0].formatted_address;
        
        setSettings(prev => ({
          ...prev,
          latitude: location.lat,
          longitude: location.lng,
          locationName: formattedAddress
        }));
        
        setSearchError(null);
      } else {
        setSearchError('住所が見つかりませんでした。別の表記で試してください。');
      }
    } catch (error) {
      console.error('住所検索エラー:', error);
      setSearchError('住所検索中にエラーが発生しました。');
    } finally {
      setIsSearching(false);
    }
  };

  // 現在地取得機能を改善
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('このブラウザは位置情報をサポートしていません。');
      return;
    }

    setIsGettingLocation(true);
    setSearchError(null);

    // 高精度な位置情報取得のオプション
    const options = {
      enableHighAccuracy: true,    // 高精度モードを有効
      timeout: 10000,             // 10秒でタイムアウト
      maximumAge: 0               // キャッシュを使用しない（常に新しい位置情報を取得）
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('取得した位置情報:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toLocaleString()
        });

        setSettings(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationName: `現在地 (精度: ${Math.round(position.coords.accuracy)}m)`
        }));

        setIsGettingLocation(false);
        setSearchError(null);
      },
      (error) => {
        console.error('位置情報取得エラー:', error);
        setIsGettingLocation(false);
        
        let errorMessage = '現在地の取得に失敗しました。';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '位置情報の使用が拒否されました。ブラウザの設定で位置情報を許可してください。';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置情報が利用できません。GPS機能を確認してください。';
            break;
          case error.TIMEOUT:
            errorMessage = '位置情報の取得がタイムアウトしました。再度お試しください。';
            break;
          default:
            errorMessage = `位置情報取得エラー: ${error.message}`;
            break;
        }
        setSearchError(errorMessage);
      },
      options
    );
  };

  // 保存処理にローディング状態を追加
  const handleSave = async () => {
    setIsSaving(true);
    setSearchError(null);
    
    try {
      await onSave(settings);
    } catch (error) {
      console.error('保存エラー:', error);
      setSearchError('位置情報の保存に失敗しました。再度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">位置情報設定</CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* 住所検索セクション - レスポンシブ対応 */}
        <div className="space-y-3">
          <Label htmlFor="addressSearch" className="text-sm sm:text-base">住所で検索</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="addressSearch"
              value={addressSearch}
              onChange={(e) => setAddressSearch(e.target.value)}
              placeholder="例: 大分大学旦野原キャンパス、東京都渋谷区..."
              className="flex-1 text-sm sm:text-base"
              onKeyPress={(e) => e.key === 'Enter' && searchByAddress()}
              disabled={isSearching || isSaving} // 保存中は無効化
            />
            <Button 
              type="button" 
              onClick={searchByAddress}
              disabled={isSearching || isSaving} // 保存中は無効化
              className="flex items-center justify-center gap-2 w-full sm:w-auto whitespace-nowrap"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="text-sm sm:text-base">検索</span>
            </Button>
          </div>
          {searchError && (
            <p className="text-sm text-red-600 break-words">{searchError}</p>
          )}
        </div>

        {/* 手動設定セクション - レスポンシブ対応 */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="locationName" className="text-sm sm:text-base">キャンパス・場所名</Label>
            <Input
              id="locationName"
              value={settings.locationName || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, locationName: e.target.value }))}
              placeholder="例: 大分大学旦野原キャンパス"
              className="text-sm sm:text-base"
              disabled={isSaving} // 保存中は無効化
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude" className="text-sm sm:text-base">緯度</Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={settings.latitude}
                onChange={(e) => setSettings(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                className="text-sm sm:text-base"
                disabled={isSaving} // 保存中は無効化
              />
            </div>
            <div>
              <Label htmlFor="longitude" className="text-sm sm:text-base">経度</Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={settings.longitude}
                onChange={(e) => setSettings(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                className="text-sm sm:text-base"
                disabled={isSaving} // 保存中は無効化
              />
            </div>
          </div>

          <div>
            <Label htmlFor="radius" className="text-sm sm:text-base">許可範囲（km）</Label>
            <Input
              id="radius"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={settings.radius}
              onChange={(e) => setSettings(prev => ({ ...prev, radius: parseFloat(e.target.value) || 0.5 }))}
              className="text-sm sm:text-base"
              disabled={isSaving} // 保存中は無効化
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCurrentLocation}
              disabled={isGettingLocation || isSaving} // 保存中は無効化
              className="w-full sm:w-auto"
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              <span className="text-sm sm:text-base">
                {isGettingLocation ? '位置情報取得中...' : '現在地を取得'}
              </span>
            </Button>
            
            {/* 保存ボタンにローディング状態を追加 */}
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm sm:text-base">保存中...</span>
                </>
              ) : (
                <span className="text-sm sm:text-base">位置情報を保存</span>
              )}
            </Button>
          </div>
        </div>

        {/* デバッグ情報表示 - レスポンシブ対応 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
            <p className="font-semibold mb-2">デバッグ情報:</p>
            <div className="space-y-1 break-all">
              <p>緯度: {settings.latitude}</p>
              <p>経度: {settings.longitude}</p>
              <p>場所名: {settings.locationName}</p>
              <p>保存状態: {isSaving ? '保存中' : '待機中'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
