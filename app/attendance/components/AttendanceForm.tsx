'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, AlertTriangle, CheckCircle, GraduationCap, Settings, HelpCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { CustomFormField, CourseFormConfig } from '@/app/types';
import { createDynamicSchema, createDefaultValues, defaultFields } from '@/lib/dynamicFormUtils';
import DynamicFormField from './DynamicFormField';
import LocationPermissionModal from './LocationPermissionModal';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { LocationCacheManager } from '@/lib/locationCache';

// 講義情報の型定義
interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  spreadsheetId: string;
  defaultSheetName: string;
  // 新しく追加
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number; // km
    locationName?: string; // キャンパス名など
  };
}

// デフォルトのフォームスキーマ（フォールバック用）
const defaultFormSchema = z.object({
  date: z.string().min(1, { message: '日付を入力してください' }),
  class_name: z.string().optional(),
  student_id: z.string().min(1, { message: '学籍番号を入力してください' }),
  grade: z.string().min(1, { message: '学年を選択してください' }),
  name: z.string().min(1, { message: '名前を入力してください' }),
  department: z.string().min(1, { message: '学科・コースを入力してください' }),
  feedback: z.string().min(1, { message: '講義レポートを入力してください' }),
});

export interface GlobalSettings {
  defaultLocationSettings: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
}

// 大分大学旦野原キャンパスの位置情報
const CAMPUS_CENTER = {
  latitude: 33.1751332,
  longitude: 131.6138803,
  radius: 0.5,
};

export default function DynamicAttendanceForm() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  
  // 動的フォーム設定用の状態
  const [formConfig, setFormConfig] = useState<CourseFormConfig | null>(null);
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);
  const [enabledDefaultFields, setEnabledDefaultFields] = useState<string[]>([
    'date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'
  ]);
  const [dynamicSchema, setDynamicSchema] = useState<any>(defaultFormSchema);
  
  const [locationInfo, setLocationInfo] = useState<{
    status: 'loading' | 'success' | 'error' | 'outside';
    message: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
    isOnCampus?: boolean;
  }>({
    status: 'loading',
    message: '位置情報を取得中...',
  });
  const [showLocationModal, setShowLocationModal] = useState(true);
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  const [lastSubmissionTime, setLastSubmissionTime] = useState<number | null>(null);
  const [timeUntilNextSubmission, setTimeUntilNextSubmission] = useState<number>(0);
  const [locationFetched, setLocationFetched] = useState(false); // 位置情報取得済みフラグ
  const [isSubmittingForm, setIsSubmittingForm] = useState(false); // フォーム送信中フラグ

  const [campusCenter, setCampusCenter] = useState<{
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  } | null>(null);

  // 動的フォームの初期化
  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: createDefaultValues(customFields, enabledDefaultFields),
    mode: 'onChange',
  });

  // スキーマが変更された時にフォームを再初期化
  useEffect(() => {
    const newSchema = createDynamicSchema(customFields, enabledDefaultFields);
    setDynamicSchema(newSchema);
    const newDefaultValues = createDefaultValues(customFields, enabledDefaultFields);
    
    // 現在の値を保持しつつ、新しいデフォルト値をマージ
    const currentValues = form.getValues();
    const mergedValues = { ...newDefaultValues, ...currentValues };
    
    // 講義名が既に設定されている場合は保持する
    if (targetCourse && currentValues.class_name) {
      mergedValues.class_name = currentValues.class_name;
    } else if (targetCourse && !currentValues.class_name) {
      // targetCourseがあるが、フォームに講義名が設定されていない場合は設定
      mergedValues.class_name = targetCourse.courseName;
    }
    
    form.reset(mergedValues);
  }, [customFields, enabledDefaultFields, form, targetCourse]);

  // 全講義一覧を取得（出席フォーム用：認証なし）
  const fetchCourses = async () => {
    try {
      // 認証なしのパブリックAPIを使用
      const data = await fetchJsonWithRetry('/api/courses', {}, {
        maxRetries: 2,
        baseDelay: 500
      });
      setCourses(data.courses || []);
    } catch (error) {
      // 講義一覧の取得に失敗（ログ削除）
      toast.error('講義一覧の取得に失敗しました');
    } finally {
      setLoadingCourses(false);
    }
  };

  // フォーム設定を取得
  const fetchFormConfig = useCallback(async () => {
    if (!courseId || isSubmittingForm) return; // フォーム送信中はスキップ

    try {
      // フォーム設定を取得（ログ削除）
      const data = await fetchJsonWithRetry(`/api/admin/courses/${courseId}/form-config`, {}, {
        maxRetries: 1, // リトライ回数を2→1に削減
        baseDelay: 1000
      });
      // フォーム設定レスポンス取得（ログ削除）
      
      setFormConfig(data.config);
      const customFields = data.config.customFields || [];
      const enabledDefaultFields = data.config.enabledDefaultFields || [
        'date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'
      ];
      
      // カスタムフィールドと有効フィールドを設定（ログ削除）
      
      setCustomFields(customFields);
      setEnabledDefaultFields(enabledDefaultFields);
    } catch (error) {
      // フォーム設定が見つかりません。デフォルト設定を使用します（ログ削除）
      // デフォルト設定を使用
      setCustomFields([]);
      setEnabledDefaultFields([
        'date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'
      ]);
    }
  }, [courseId, isSubmittingForm]); // isSubmittingFormを依存配列に追加

  // 特定の講義情報を取得
  const fetchTargetCourse = useCallback(async () => {
    if (!courseId) return;

    try {
      // 認証なしのパブリックAPIを使用して特定の講義情報を取得
      const response = await fetchJsonWithRetry(`/api/courses/${courseId}`, {}, {
        maxRetries: 2,
        baseDelay: 500
      });
      
      if (response.course) {
        const course = response.course;
        setTargetCourse(course);
        // フォームに講義名を直接設定（setTimeoutを削除）
        form.setValue('class_name', course.courseName);
      } else {
        // coursesから検索（フォールバック）
        const course = courses.find((c: any) => c.id === courseId);
        if (course) {
          setTargetCourse(course);
          form.setValue('class_name', course.courseName);
        } else {
          toast.error('指定された講義が見つかりません');
        }
      }
    } catch (error) {
      // API呼び出しが失敗した場合、coursesから検索
      const course = courses.find((c: any) => c.id === courseId);
      if (course) {
        setTargetCourse(course);
        form.setValue('class_name', course.courseName);
      } else {
        toast.error('講義情報の取得中にエラーが発生しました');
      }
    }
  }, [courseId, courses, form]);

  // 位置情報設定を取得する関数を修正
  const fetchLocationSettings = useCallback(async () => {
    // フォーム送信中は処理をスキップ
    if (isSubmittingForm) return;
    
    try {
      let locationSettings = null;

      // 特定講義の位置情報設定を優先
      if (targetCourse?.locationSettings) {
        locationSettings = targetCourse.locationSettings;
      } else {
        // リトライ回数を削減してリソース消費を抑制
        try {
          const data = await fetchJsonWithRetry('/api/admin/location-settings', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          }, {
            maxRetries: 1, // リトライ回数を3→1に削減
            baseDelay: 2000 // 遅延を1000→2000に増加
          });
          
          locationSettings = data.defaultLocationSettings;
          
          if (locationSettings) {
            // 管理画面から位置情報設定を取得（ログを削減）
          }
        } catch (apiError) {
          // API取得に失敗、キャッシュを確認（ログ削減）
            // APIが失敗した場合のみキャッシュを確認
            const cachedSettings = LocationCacheManager.getCachedLocationSettings();
            if (cachedSettings) {
              locationSettings = cachedSettings;
              // キャッシュから位置情報設定を取得（ログを削減）
            }
        }
      }

      if (locationSettings) {
        setCampusCenter(locationSettings);
        // 設定をキャッシュに保存
        LocationCacheManager.saveLocationSettings(locationSettings);
      } else {
        // フォールバック: デフォルト値
        // デフォルト位置情報設定を使用（ログを削減）
        const defaultSettings = {
          latitude: 33.1751332,
          longitude: 131.6138803,
          radius: 0.5,
          locationName: 'デフォルトキャンパス'
        };
        setCampusCenter(defaultSettings);
        LocationCacheManager.saveLocationSettings(defaultSettings);
      }
    } catch (error) {
      // 位置情報設定の取得に失敗（ログ削減）
      // フォールバック値を設定
      const defaultSettings = {
        latitude: 33.1751332,
        longitude: 131.6138803,
        radius: 0.5,
        locationName: 'デフォルトキャンパス'
      };
      setCampusCenter(defaultSettings);
      LocationCacheManager.saveLocationSettings(defaultSettings);
    }
  }, [targetCourse, isSubmittingForm]); // isSubmittingFormを依存配列に追加

  // 初期化状態を管理
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // コンポーネントマウント時の処理を修正（無限ループ防止）
  useEffect(() => {
    // 既に初期化済み、またはフォーム送信中の場合はスキップ
    if (isInitialized || isSubmittingForm) {
      return;
    }

    let isMounted = true; // クリーンアップ用フラグ

    const initializeData = async () => {
      try {
        setInitializationError(null);
        
        if (courseId) {
          // 特定の講義の場合：順次実行でリソース消費を抑制
          if (isMounted) await fetchCourses();
          if (isMounted) await fetchFormConfig();
          if (isMounted) await fetchLocationSettings();
        } else {
          // 講義指定がない場合：最小限の並列実行
          if (isMounted) {
            const [coursesResult, locationResult] = await Promise.allSettled([
              fetchCourses(),
              fetchLocationSettings()
            ]);
            
            // エラーハンドリング（開発環境でのみログ出力）
            if (process.env.NODE_ENV === 'development') {
              if (coursesResult.status === 'rejected') {
                console.warn('講義一覧の取得に失敗:', coursesResult.reason);
              }
              if (locationResult.status === 'rejected') {
                console.warn('位置情報設定の取得に失敗:', locationResult.reason);
              }
            }
          }
        }
        
        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : '初期化に失敗しました';
          setInitializationError(errorMessage);
          
          // 開発環境でのみエラーログ
          if (process.env.NODE_ENV === 'development') {
            console.error('データ初期化エラー:', error);
          }
        }
      }
    };

    // 少し遅延してから初期化（リソース競合を避ける）
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        initializeData();
      }
    }, 100);

    // クリーンアップ関数
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []); // 依存配列を空にして一度だけ実行

  // 前回の登録時刻チェック（別のuseEffectに分離）
  useEffect(() => {
    if (!isInitialized) return;
    
    const storageKey = courseId ? `lastAttendanceSubmission_${courseId}` : 'lastAttendanceSubmission';
    const lastSubmissionTimeStored = localStorage.getItem(storageKey);
    
    if (lastSubmissionTimeStored) {
      const lastTime = parseInt(lastSubmissionTimeStored, 10);
      setLastSubmissionTime(lastTime);
      
      const currentTime = Date.now();
      const elapsedMinutes = (currentTime - lastTime) / (1000 * 60);
      const remainingTime = Math.max(0, 15 - elapsedMinutes);
      
      if (remainingTime > 0) {
        setTimeUntilNextSubmission(remainingTime);
        
        // タイマーを設定
        const timer = setInterval(() => {
          const now = Date.now();
          const elapsed = (now - lastTime) / (1000 * 60);
          const remaining = Math.max(0, 15 - elapsed);
          
          setTimeUntilNextSubmission(remaining);
          
          if (remaining === 0) {
            clearInterval(timer);
          }
        }, 1000);
        
        return () => clearInterval(timer);
      }
    }
  }, [isInitialized, courseId]);

  // coursesが取得された後に講義情報を設定
  // フォーム設定の初期化が完了してから実行する
  useEffect(() => {
    if (courseId && isInitialized) {
      fetchTargetCourse();
    }
  }, [courseId, fetchTargetCourse, isInitialized]);

  // 残り時間のカウントダウン処理
  useEffect(() => {
    if (timeUntilNextSubmission <= 0) return;
    
    const timer = setInterval(() => {
      const storageKey = courseId ? `lastAttendanceSubmission_${courseId}` : 'lastAttendanceSubmission';
      const storedTime = localStorage.getItem(storageKey);
      if (!storedTime) {
        clearInterval(timer);
        return;
      }
      
      const parsedTime = parseInt(storedTime, 10);
      const cooldownPeriod = 15 * 60 * 1000;
      const currentTime = Date.now();
      const elapsedTime = currentTime - parsedTime;
      
      if (elapsedTime >= cooldownPeriod) {
        setTimeUntilNextSubmission(0);
        clearInterval(timer);
      } else {
        setTimeUntilNextSubmission(Math.ceil((cooldownPeriod - elapsedTime) / 1000 / 60));
      }
    }, 60000);
    
    return () => clearInterval(timer);
  }, [timeUntilNextSubmission, courseId]);

  // 位置情報を取得
  useEffect(() => {
    // campusCenterが設定されたら自動的に位置情報取得を開始
    if (campusCenter && showLocationModal) {
      setShowLocationModal(false); // モーダルを閉じて位置情報取得を開始
    }
  }, [campusCenter, showLocationModal]);

  // 位置情報を一度だけ取得
  useEffect(() => {
    if (!showLocationModal && campusCenter && !locationFetched) {
      const getLocationOnce = async () => {
        try {
          // 位置情報を一度だけ取得
          const location = await LocationCacheManager.getCurrentLocation();
          
          const validation = LocationCacheManager.isLocationValid(location, campusCenter);
          
          setLocationInfo({
            status: validation.isValid ? 'success' : 'outside',
            message: validation.isValid 
              ? `${campusCenter.locationName || 'キャンパス'}内から出席登録を行っています` 
              : `${campusCenter.locationName || 'キャンパス'}の外から出席登録を行っています`,
            latitude: location.latitude,
            longitude: location.longitude,
            distance: validation.distance,
            isOnCampus: validation.isValid
          });
          
          setLocationFetched(true); // 取得完了フラグを設定
        } catch (error) {
          setLocationInfo({
            status: 'error',
            message: `位置情報を取得できませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`,
          });
          setShowLocationPermissionModal(true);
          setLocationFetched(true); // エラーでも再試行を防ぐ
        }
      };
      
      getLocationOnce();
    }
  }, [showLocationModal, campusCenter, locationFetched]);

  // 2点間の距離を計算（Haversine公式）
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // フォーム送信処理
  const onSubmit = async (values: any) => {
    setSubmitError(null);
    setIsSubmittingForm(true); // フォーム送信開始
    
    // 講義名の確認を条件付きに変更
    if (!courseId && !values.class_name) {
      setSubmitError('講義が選択されていません。');
      toast.error('講義を選択してください');
      setIsSubmittingForm(false);
      return;
    }
    
    // 位置情報の検証（既に取得済みの情報を使用）
    if (process.env.NODE_ENV !== 'development' && campusCenter && locationInfo.status !== 'success') {
      setSubmitError(`${campusCenter.locationName || 'キャンパス'}の許可範囲外からは出席登録できません`);
      toast.error('許可範囲外からの出席登録は拒否されます');
      setIsSubmittingForm(false);
      return;
    }
    
    // 前回の登録から15分経過していないかチェック
    const storageKey = courseId ? `lastAttendanceSubmission_${courseId}` : 'lastAttendanceSubmission';
    const lastSubmissionTimeStored = localStorage.getItem(storageKey);
    if (lastSubmissionTimeStored) {
      const lastTime = parseInt(lastSubmissionTimeStored, 10);
      const currentTime = Date.now();
      const elapsedMinutes = (currentTime - lastTime) / (1000 * 60);
      
      if (elapsedMinutes < 15) {
        setSubmitError(`同一端末からの出席登録は15分間隔を空ける必要があります。あと約${Math.ceil(15 - elapsedMinutes)}分お待ちください。`);
        toast.error('出席登録の間隔が短すぎます');
        setIsSubmittingForm(false);
        return;
      }
    }
    
    try {
      setIsSubmitting(true);

      let latitude = locationInfo.latitude || campusCenter?.latitude || 33.1751332;
      let longitude = locationInfo.longitude || campusCenter?.longitude || 131.6138803;

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values, // 動的フォームの全ての値を送信
          grade: values.grade ? parseInt(values.grade) : undefined,
          latitude,
          longitude,
          courseId: targetCourse?.id, // 講義IDも送信（ある場合）
          customFields: customFields, // カスタムフィールド定義も送信
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '出席登録に失敗しました');
      }

      // 即座に完了画面に遷移
      localStorage.setItem(storageKey, Date.now().toString());
      setLastSubmissionTime(Date.now());
      setTimeUntilNextSubmission(15);
      
      // 成功メッセージと即座の遷移
      toast.success('出席を登録しました');
      
      // 少し遅延してから遷移（ローディング画面を表示）
      setTimeout(() => {
        router.replace('/attendance/complete');
      }, 1500);
      
    } catch (error: any) {
      // 出席登録エラー（ログ削除）
      
      // より詳細なエラー情報をログに出力（削除）
      if (error.response) {
        // レスポンスステータスとデータ（ログ削除）
      }
      
      // エラーメッセージを分類
      let errorMessage = '出席登録に失敗しました。もう一度お試しください。';
      
      if (error?.message?.includes('Configuration error')) {
        errorMessage = 'システム設定エラーです。管理者にお問い合わせください。';
      } else if (error?.message?.includes('Authentication error')) {
        errorMessage = 'システム認証エラーです。管理者にお問い合わせください。';
      } else if (error?.message?.includes('500')) {
        errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setSubmitError(errorMessage);
      toast.error(errorMessage);
      setIsSubmittingForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // フォーム有効性チェックの修正（416行目付近）
  const isFormValid = form.formState.isValid; // 講義名チェックを削除

  const isSubmitEnabled = 
    (process.env.NODE_ENV === 'development' 
      ? isFormValid
      : isFormValid && (locationInfo.isOnCampus === true))
    && timeUntilNextSubmission === 0;

  return (
    <>
      {/* フォーム送信中のローディング画面 */}
      {isSubmittingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-bold text-indigo-700 mb-2">出席を登録中...</h3>
                <p className="text-gray-600 text-sm">
                  データを処理しています。<br />
                  しばらくお待ちください。
                </p>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>出席データを送信中</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 初期化エラー表示 */}
      {initializationError && (
        <div className="w-full max-w-md mx-auto p-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-red-800">初期化エラー</h3>
                <p className="text-sm text-red-700 mt-1">{initializationError}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInitializationError(null);
                setIsInitialized(false);
              }}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
            >
              再試行
            </button>
          </div>
        </div>
      )}
      
      {/* 初期化中のローディング表示 */}
      {!isInitialized && !initializationError && (
        <div className="w-full max-w-md mx-auto p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              <div>
                <h3 className="text-sm font-medium text-blue-800">データを読み込み中...</h3>
                <p className="text-sm text-blue-700 mt-1">しばらくお待ちください</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-100">
      {/* 初期化完了後のみフォームを表示 */}
      {isInitialized && (
        <>
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-indigo-700 mb-4 text-center">位置情報の許可が必要です</h3>
            <p className="mb-4">
              ざせきくん - 出席管理システムでは、
              {campusCenter?.locationName || 'キャンパス'}内からの出席登録を確認するために、
              位置情報の利用許可が必要です。
            </p>
            <p className="mb-6 text-sm text-gray-600">
              次の画面で「許可」を選択してください。位置情報はキャンパス内にいることの確認のみに使用され、他の目的では利用されません。
              {campusCenter && (
                <span className="block mt-2 font-medium">
                  許可範囲: {campusCenter.locationName || 'キャンパス'}から半径{campusCenter.radius}km以内
                </span>
              )}
            </p>
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowLocationModal(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                理解しました
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col items-center mb-6">
        <Image
          src="https://res.cloudinary.com/dz9trbwma/image/upload/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
          alt="ざせきくん"
          width={96}
          height={96}
          className="rounded-lg shadow-sm mb-3"
        />
        <h2 className="text-2xl font-bold text-indigo-700 text-center mb-1">出席管理システム</h2>
        <p className="text-gray-600 text-center text-sm max-w-sm mb-4">
          レポートを提出して、出席登録をしましょう。
        </p>
        
        {/* 管理画面へのボタンを追加 - デザイン改善 */}
        <Button
          onClick={() => router.push('/admin')}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 text-indigo-700 hover:from-indigo-100 hover:to-blue-100 hover:border-indigo-300 hover:text-indigo-800 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium">管理者の方はこちら</span>
        </Button>
        
        {/* 位置情報許可の説明テキスト */}
        <button
          onClick={() => setShowLocationPermissionModal(true)}
          className="group flex items-center space-x-3 text-sm bg-red-50 text-red-600 font-semibold border-2 border-red-300 rounded-xl px-4 py-3 hover:bg-red-100 hover:border-red-400 hover:text-red-700 transition-all duration-300 mt-3 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <div className="p-1 bg-red-100 rounded-full group-hover:bg-red-200 transition-colors duration-200">
            <HelpCircle className="h-4 w-4 group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <span>位置情報を許可するには？</span>
        </button>
      </div>
      
      {timeUntilNextSubmission > 0 && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-md flex items-center gap-2">
          <AlertTriangle size={20} />
          <span className="text-sm">
            同一端末からの連続登録はできません。次回登録可能まであと約{timeUntilNextSubmission}分です。
          </span>
        </div>
      )}

      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
          <p className="font-semibold mb-2">デバッグ情報:</p>
          <div className="space-y-1">
            <p>管理者設定位置情報: {campusCenter ? 'あり' : 'なし'}</p>
            {campusCenter && (
              <>
                <p>キャンパス名: {campusCenter.locationName || '未設定'}</p>
                <p>中心座標: {campusCenter.latitude}, {campusCenter.longitude}</p>
                <p>許可範囲: {campusCenter.radius}km</p>
              </>
            )}
            <p>現在の位置情報状態: {locationInfo.status}</p>
            {locationInfo.distance && <p>距離: {locationInfo.distance.toFixed(3)}km</p>}
          </div>
        </div>
      )}

      <div className={`mb-6 p-3 rounded-md flex items-center gap-2 ${
        locationInfo.status === 'loading' ? 'bg-gray-100 text-gray-600' :
        locationInfo.status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
        locationInfo.status === 'outside' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
        'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {locationInfo.status === 'loading' && (
          <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
        )}
        {locationInfo.status === 'success' && <CheckCircle size={20} />}
        {locationInfo.status === 'outside' && <AlertTriangle size={20} />}
        {locationInfo.status === 'error' && <AlertTriangle size={20} />}
        
        <div className="flex-1">
          <span className="text-sm block">{locationInfo.message}</span>
          {campusCenter && locationInfo.distance !== undefined && (
            <span className="text-xs text-gray-500 block mt-1">
              {campusCenter.locationName || 'キャンパス'}から約{locationInfo.distance.toFixed(1)}km
              （許可範囲: {campusCenter.radius}km以内）
            </span>
          )}
        </div>
      </div>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {submitError}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 動的フィールドレンダリング */}
          {(() => {
            // 開発環境でのみデバッグログを表示
            if (process.env.NODE_ENV === 'development') {
              // console.log('Rendering dynamic fields...');
              // console.log('enabledDefaultFields:', enabledDefaultFields);
              // console.log('customFields:', customFields);
            }

            const allFields: CustomFormField[] = [
              // デフォルトフィールドを追加
              ...defaultFields.filter(field => enabledDefaultFields.includes(field.key)).map((field, index) => ({
                id: field.key,
                name: field.key,
                label: field.label,
                type: field.type,
                required: true,
                placeholder: '',
                description: '',
                options: field.key === 'grade' ? ['1', '2', '3', '4'] : [],
                order: index
              })),
              // カスタムフィールドを追加（orderに基づいてソート）
              ...customFields.sort((a, b) => (a.order || 0) - (b.order || 0))
            ];

            // 開発環境でのみデバッグログを表示
            if (process.env.NODE_ENV === 'development') {
              // console.log('allFields:', allFields);
            }

            if (allFields.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-gray-500">フォーム項目が設定されていません</p>
                </div>
              );
            }

            // フィールドをグループ化（2列レイアウト用）
            const fieldPairs = [];
            for (let i = 0; i < allFields.length; i += 2) {
              fieldPairs.push(allFields.slice(i, i + 2));
            }

            return fieldPairs.map((pair, pairIndex) => (
              <div key={pairIndex} className={`grid grid-cols-1 ${pair.length === 2 && pair[0].type !== 'textarea' && pair[1]?.type !== 'textarea' ? 'md:grid-cols-2' : ''} gap-4`}>
                {pair.map((field) => (
                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <DynamicFormField
                      control={form.control}
                      field={field}
                      courses={courses}
                      isClassNameField={field.name === 'class_name'}
                      targetCourse={targetCourse}
                      loadingCourses={loadingCourses}
                    />
                  </div>
                ))}
              </div>
            ));
          })()}

          <div className="pt-2">
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-medium"
              disabled={isSubmitting || !isSubmitEnabled}
            >
              {isSubmitting ? "送信中..." : 
               timeUntilNextSubmission > 0 ? `あと${timeUntilNextSubmission}分お待ちください` : "出席を登録する"}
            </Button>
          </div>
          
          {!isFormValid ? (
            <p className="text-sm text-amber-600 text-center">
              全ての必須項目を入力してください
            </p>
          ) : timeUntilNextSubmission > 0 ? (
            <p className="text-sm text-amber-600 text-center">同一端末からの連続登録には15分の間隔が必要です</p>
          ) : (!locationInfo.isOnCampus && process.env.NODE_ENV === 'production') ? (
            <p className="text-sm text-red-600 text-center">
              {campusCenter?.locationName || 'キャンパス'}内（半径{campusCenter?.radius || 0.5}km以内）からのみ出席登録が可能です
            </p>
          ) : null}
          
          <div className="mt-4 text-xs text-gray-500 flex items-center justify-center">
            <MapPin size={12} className="mr-1" />
            <span>
              {locationInfo.distance !== undefined 
                ? `キャンパスから約${(locationInfo.distance).toFixed(1)}km離れた場所から出席登録をしています`
                : '位置情報の取得中...'}
            </span>
          </div>
        </form>
      </Form>
      
      {/* 位置情報許可説明モーダル */}
      <LocationPermissionModal
        isOpen={showLocationPermissionModal}
        onClose={() => setShowLocationPermissionModal(false)}
      />
        </>
      )}
      </div>
    </>
  );
}