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

export type LocationErrorCode =
  | 'permission_denied'    // ブラウザ/OSで位置情報がブロックされている
  | 'position_unavailable' // 端末のGPSがOFF・圏外などで測位不能
  | 'timeout'              // タイムアウト（屋内・電波弱）
  | 'unsupported'          // ブラウザがGeolocation APIに非対応
  | 'insecure_context';    // HTTPS以外でアクセスしている

export class LocationError extends Error {
  code: LocationErrorCode;
  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'LocationError';
  }
}

export type LocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

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
   * Permissions APIで位置情報の許可状態を事前判定
   * Safari等で未対応の場合は 'unknown' を返す
   */
  static async checkPermission(): Promise<LocationPermissionState> {
    if (typeof navigator === 'undefined' || !navigator.permissions) return 'unknown';
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state;
    } catch {
      return 'unknown';
    }
  }

  /**
   * 単発の getCurrentPosition 呼び出し（オプション指定可）
   * GeolocationPositionError を LocationError に変換する
   */
  private static requestPosition(options: PositionOptions): Promise<CachedLocation> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: CachedLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          };
          this.saveLocation(location);
          resolve(location);
        },
        (error) => {
          let code: LocationErrorCode;
          let message: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              code = 'permission_denied';
              message = '位置情報の利用が許可されていません。ブラウザと端末の両方で位置情報を許可してください。';
              break;
            case error.POSITION_UNAVAILABLE:
              code = 'position_unavailable';
              message = '位置情報を取得できませんでした。端末の位置情報サービス(GPS)がONになっているか確認してください。';
              break;
            case error.TIMEOUT:
              code = 'timeout';
              message = '位置情報の取得がタイムアウトしました。屋外への移動またはWiFi接続をお試しください。';
              break;
            default:
              code = 'position_unavailable';
              message = '位置情報を取得できませんでした。';
          }
          reject(new LocationError(code, message));
        },
        options
      );
    });
  }

  /**
   * 位置情報を取得（キャッシュ優先 + TIMEOUT 時の低精度フォールバック）
   */
  static async getCurrentLocation(): Promise<CachedLocation> {
    // まずキャッシュをチェック
    const cached = this.getCachedLocation();
    if (cached) return cached;

    // セキュアコンテキスト確認（HTTPS or localhost でないと取得不可）
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const isSecure = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isSecure) {
        throw new LocationError(
          'insecure_context',
          '安全な接続(HTTPS)でないため位置情報を取得できません。URLが正しいかご確認ください。'
        );
      }
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new LocationError('unsupported', 'お使いのブラウザは位置情報に対応していません。');
    }

    // 1回目: 高精度（10秒）
    try {
      return await this.requestPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      });
    } catch (err) {
      // TIMEOUT のみ低精度にフォールバック（屋内・電波弱対策）
      if (err instanceof LocationError && err.code === 'timeout') {
        return await this.requestPosition({
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 30_000,
        });
      }
      throw err;
    }
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
