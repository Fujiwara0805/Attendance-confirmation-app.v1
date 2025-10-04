'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search, Loader2, Navigation, Globe, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface LocationSettings {
  latitude: number;
  longitude: number;
  radius: number;
  locationName: string;
}

interface LocationSettingsFormProps {
  initialSettings?: LocationSettings;
  onSave: (settings: LocationSettings) => Promise<void>;
}

// フローティングラベル付き入力コンポーネント
const FloatingLabelInput = ({ 
  label, 
  error, 
  success, 
  icon: Icon, 
  required = false,
  ...props 
}: {
  label: string;
  error?: string;
  success?: boolean;
  icon?: React.ComponentType<any>;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setHasValue(e.target.value !== '');
    props.onBlur?.(e);
  };

  const isActive = isFocused || hasValue || props.value;

  return (
    <div className="floating-label-container">
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 z-10">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setHasValue(e.target.value !== '');
            props.onChange?.(e);
          }}
          className={`
            modern-input w-full
            ${Icon ? 'pl-12' : 'pl-4'}
            ${error ? 'input-error' : success ? 'input-success' : ''}
            ${isActive ? 'pt-6 pb-2' : 'py-3'}
          `}
          placeholder=""
        />
        <label 
          className={`floating-label ${isActive ? 'active' : ''} ${Icon ? 'left-12' : 'left-4'}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>
      
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="error-message"
        >
          <span>{error}</span>
        </motion.div>
      )}
      
      {success && !error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-green-600 text-sm mt-1 flex items-center"
        >
          <span>✅ 設定が正常に保存されました</span>
        </motion.div>
      )}
    </div>
  );
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
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
          locationName: `設定位置 (精度: ${Math.round(position.coords.accuracy)}m)`
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
    setSaveSuccess(false);
    
    try {
      await onSave(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // 3秒後に成功メッセージを消す
    } catch (error) {
      console.error('保存エラー:', error);
      setSearchError('位置情報の保存に失敗しました。再度お試しください。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl text-gradient flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          位置情報設定
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* 住所検索セクション */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-slate-700">住所で検索</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <FloatingLabelInput
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                label="住所を入力"
                placeholder="例: 大分大学旦野原キャンパス、東京都渋谷区..."
                onKeyPress={(e) => e.key === 'Enter' && searchByAddress()}
                disabled={isSearching || isSaving}
                icon={Globe}
              />
            </div>
            <Button 
              type="button" 
              onClick={searchByAddress}
              disabled={isSearching || isSaving}
              className="modern-button-primary w-full sm:w-auto"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              検索
            </Button>
          </div>
          
          {searchError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="error-message"
            >
              <span>{searchError}</span>
            </motion.div>
          )}
        </div>

        {/* 手動設定セクション */}
        <div className="space-y-6">
          <FloatingLabelInput
            value={settings.locationName || ''}
            onChange={(e) => setSettings(prev => ({ ...prev, locationName: e.target.value }))}
            label="キャンパス・場所名"
            placeholder="例: 大分大学旦野原キャンパス"
            disabled={isSaving}
            icon={MapPin}
            success={saveSuccess}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingLabelInput
              type="number"
              step="0.000001"
              value={settings.latitude}
              onChange={(e) => setSettings(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
              label="緯度"
              disabled={isSaving}
              icon={Navigation}
              success={saveSuccess}
            />
            
            <FloatingLabelInput
              type="number"
              step="0.000001"
              value={settings.longitude}
              onChange={(e) => setSettings(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
              label="経度"
              disabled={isSaving}
              icon={Navigation}
              success={saveSuccess}
            />
          </div>

          <FloatingLabelInput
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            value={settings.radius}
            onChange={(e) => setSettings(prev => ({ ...prev, radius: parseFloat(e.target.value) || 0.5 }))}
            label="許可範囲（km）"
            disabled={isSaving}
            icon={Target}
            success={saveSuccess}
          />

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCurrentLocation}
              disabled={isGettingLocation || isSaving}
              className="modern-button-secondary w-full sm:w-auto"
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              {isGettingLocation ? '位置情報取得中...' : '現在地を取得'}
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="modern-button-primary flex-1"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MapPin className="h-4 w-4 mr-2" />
              )}
              {isSaving ? '保存中...' : '位置情報を保存'}
            </Button>
          </div>
        </div>

        {/* デバッグ情報表示 */}
        {process.env.NODE_ENV === 'development' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200"
          >
            <p className="font-semibold mb-3 text-slate-700">デバッグ情報:</p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>緯度:</span>
                <span className="font-mono">{settings.latitude}</span>
              </div>
              <div className="flex justify-between">
                <span>経度:</span>
                <span className="font-mono">{settings.longitude}</span>
              </div>
              <div className="flex justify-between">
                <span>場所名:</span>
                <span className="truncate ml-2">{settings.locationName}</span>
              </div>
              <div className="flex justify-between">
                <span>保存状態:</span>
                <span className={`font-medium ${isSaving ? 'text-blue-600' : saveSuccess ? 'text-green-600' : 'text-slate-600'}`}>
                  {isSaving ? '保存中' : saveSuccess ? '保存完了' : '待機中'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
