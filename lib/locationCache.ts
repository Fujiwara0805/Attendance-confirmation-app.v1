// 位置情報キャッシュ管理システム
interface CachedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

interface LocationSettings {
  latitude: number;
  longitude: number;
  radius: number;
  locationName?: string;
}

export class LocationCacheManager {
  private static readonly CACHE_KEY = 'attendance_location_cache';
  private static readonly SETTINGS_KEY = 'attendance_location_settings';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分間有効

  /**
   * 位置情報をキャッシュに保存
   */
  static saveLocation(location: CachedLocation): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(location));
    } catch (error) {
      // キャッシュ保存に失敗（ログ削減）
    }
  }

  /**
   * キャッシュから位置情報を取得
   */
  static getCachedLocation(): CachedLocation | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const location: CachedLocation = JSON.parse(cached);
      const now = Date.now();
      
      // キャッシュが期限切れかチェック
      if (now - location.timestamp > this.CACHE_DURATION) {
        this.clearLocationCache();
        return null;
      }

      return location;
    } catch (error) {
      // 位置情報キャッシュの取得に失敗（ログ削減）
      return null;
    }
  }

  /**
   * 位置情報設定をキャッシュに保存
   */
  static saveLocationSettings(settings: LocationSettings): void {
    try {
      const settingsWithTimestamp = {
        ...settings,
        timestamp: Date.now()
      };
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settingsWithTimestamp));
    } catch (error) {
      // 位置情報設定のキャッシュ保存に失敗（ログ削減）
    }
  }

  /**
   * キャッシュから位置情報設定を取得
   */
  static getCachedLocationSettings(): LocationSettings | null {
    try {
      const cached = localStorage.getItem(this.SETTINGS_KEY);
      if (!cached) return null;

      const settings = JSON.parse(cached);
      const now = Date.now();
      
      // 設定キャッシュは10分間有効
      if (now - settings.timestamp > 10 * 60 * 1000) {
        this.clearSettingsCache();
        return null;
      }

      return settings;
    } catch (error) {
      console.warn('位置情報設定キャッシュの取得に失敗:', error);
      return null;
    }
  }

  /**
   * 2点間の距離を計算（Haversine公式）
   */
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 位置情報が許可範囲内かチェック
   */
  static isLocationValid(
    userLocation: CachedLocation, 
    settings: LocationSettings
  ): { isValid: boolean; distance: number } {
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      settings.latitude,
      settings.longitude
    );

    return {
      isValid: distance <= settings.radius,
      distance
    };
  }

  /**
   * 高精度位置情報を取得（キャッシュ優先）
   */
  static async getCurrentLocation(): Promise<CachedLocation> {
    // まずキャッシュをチェック
    const cached = this.getCachedLocation();
    if (cached) {
      // キャッシュから位置情報を取得（ログを削減）
      return cached;
    }

    // キャッシュがない場合は新規取得
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('位置情報がサポートされていません'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: CachedLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          };
          
          // キャッシュに保存
          this.saveLocation(location);
          // 新しい位置情報を取得してキャッシュに保存（ログを削減）
          resolve(location);
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
    });
  }

  /**
   * キャッシュをクリア
   */
  static clearLocationCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.warn('位置情報キャッシュのクリアに失敗:', error);
    }
  }

  static clearSettingsCache(): void {
    try {
      localStorage.removeItem(this.SETTINGS_KEY);
    } catch (error) {
      console.warn('位置情報設定キャッシュのクリアに失敗:', error);
    }
  }

  /**
   * 位置情報設定を強制的に再取得（キャッシュを無視）
   */
  static async forceRefreshLocationSettings(): Promise<LocationSettings | null> {
    try {
      // キャッシュをクリア
      this.clearSettingsCache();
      
      // APIから最新データを取得
      const response = await fetch('/api/admin/location-settings', {
        cache: 'no-store', // キャッシュを無効化
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const settings = data.defaultLocationSettings;
      
      if (settings) {
        // 新しい設定をキャッシュに保存
        this.saveLocationSettings(settings);
        return settings;
      }
      
      return null;
    } catch (error) {
      console.error('位置情報設定の強制更新に失敗:', error);
      return null;
    }
  }

  /**
   * 全キャッシュをクリア
   */
  static clearAllCache(): void {
    this.clearLocationCache();
    this.clearSettingsCache();
  }
}
