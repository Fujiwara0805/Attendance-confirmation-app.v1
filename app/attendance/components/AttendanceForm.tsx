'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertTriangle, CheckCircle, GraduationCap, Settings, HelpCircle, AlertCircle, Loader2, ChevronRight, Shield, Send, RefreshCw } from 'lucide-react';
import { fadeInUp, staggerContainer, scaleIn, slideUp } from '@/lib/animations';
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
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number; // km
    locationName?: string;
  };
}

// デフォルトのフォームスキーマ（フォールバック用）
const defaultFormSchema = z.object({
  date: z.string().min(1, { message: '日付を入力してください' }),
  class_name: z.string().optional(),
  student_id: z.string().min(1, { message: 'ID・番号（学籍番号など）を入力してください' }),
  grade: z.string().min(1, { message: '学年を選択してください' }),
  name: z.string().min(1, { message: '名前を入力してください' }),
  department: z.string().min(1, { message: '所属（学科・コース等）を入力してください' }),
  feedback: z.string().min(1, { message: 'レポート・感想を入力してください' }),
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
  const [enabledDefaultFields, setEnabledDefaultFields] = useState<string[]>([]);
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

  // 動的スキーマのrefを保持（resolverが常に最新スキーマを参照できるようにする）
  const dynamicSchemaRef = useRef(dynamicSchema);

  // スキーマrefを常に最新に保つ
  useEffect(() => {
    dynamicSchemaRef.current = dynamicSchema;
  }, [dynamicSchema]);

  // 動的フォームの初期化
  // resolverをラップし、常にrefから最新スキーマを読み取ることで、
  // フィールド削除後も古いスキーマでバリデーションされるバグを防止
  const form = useForm({
    resolver: async (values, context, options) => {
      const currentResolver = zodResolver(dynamicSchemaRef.current);
      return currentResolver(values, context, options);
    },
    defaultValues: createDefaultValues(customFields, enabledDefaultFields),
    mode: 'onChange',
  });

  // スキーマが変更された時にフォームを再初期化
  useEffect(() => {
    const newSchema = createDynamicSchema(customFields, enabledDefaultFields);
    setDynamicSchema(newSchema);
    dynamicSchemaRef.current = newSchema;
    const newDefaultValues = createDefaultValues(customFields, enabledDefaultFields);

    // 新しいスキーマに存在するフィールド名のセットを取得
    const validFieldNames = new Set(Object.keys(newDefaultValues));

    // 現在の値を保持しつつ、新しいデフォルト値をマージ
    // 削除されたフィールドの値は含めない（古いバリデーションエラーの原因になるため）
    const currentValues = form.getValues();
    const filteredCurrentValues: Record<string, any> = {};
    for (const key of Object.keys(currentValues)) {
      if (validFieldNames.has(key)) {
        filteredCurrentValues[key] = currentValues[key];
      }
    }
    const mergedValues = { ...newDefaultValues, ...filteredCurrentValues };

    // 講義名が既に設定されている場合は保持する
    if (targetCourse && filteredCurrentValues.class_name) {
      mergedValues.class_name = filteredCurrentValues.class_name;
    } else if (targetCourse && !filteredCurrentValues.class_name) {
      // targetCourseがあるが、フォームに講義名が設定されていない場合は設定
      mergedValues.class_name = targetCourse.courseName;
    }

    form.reset(mergedValues);
  }, [customFields, enabledDefaultFields, form, targetCourse]);

  // 全講義一覧を取得（出席フォーム用：認証なし）
  // QRコード経由(courseIdあり)の場合は取得をスキップ → バグ修正
  const fetchCourses = async () => {
    // QRコード経由のアクセスでは全講義取得不要（Rate Limit対策 + 情報漏洩防止）
    if (courseId) {
      setLoadingCourses(false);
      return;
    }
    try {
      // Supabase v2 APIを使用
      const data = await fetchJsonWithRetry('/api/v2/courses', {}, {
        maxRetries: 2,
        baseDelay: 500
      });
      setCourses(data.courses || []);
    } catch (error) {
      toast.error('講義一覧の取得に失敗しました');
    } finally {
      setLoadingCourses(false);
    }
  };

  // フォーム設定は fetchTargetCourse 内で v2 API から取得済み（custom_fields, enabled_default_fields）

  // 特定の講義情報を取得（Supabase v2 API使用）
  const fetchTargetCourse = useCallback(async () => {
    if (!courseId) return;

    try {
      // Supabase v2 APIを使用（courseCode で検索）
      const response = await fetchJsonWithRetry(`/api/v2/courses/${courseId}`, {}, {
        maxRetries: 2,
        baseDelay: 500
      });

      if (response.course) {
        const course = response.course;
        // Supabase版のフィールド名をフロントエンドの形式に変換
        const mappedCourse = {
          id: course.id,
          courseName: course.name,
          teacherName: course.teacher_name,
          locationSettings: course.location_settings,
        };
        setTargetCourse(mappedCourse);
        form.setValue('class_name', course.name);

        // テンプレート/カスタムフィールド情報があれば設定
        if (course.custom_fields && Array.isArray(course.custom_fields) && course.custom_fields.length > 0) {
          setCustomFields(course.custom_fields);
        }

        // enabled_default_fieldsの設定（course → template → フォールバック の優先順）
        let hasEnabledDefaultFields = false;
        if (course.enabled_default_fields && Array.isArray(course.enabled_default_fields)) {
          setEnabledDefaultFields(course.enabled_default_fields);
          hasEnabledDefaultFields = true;
        }

        // テンプレートからフィールド情報を取得
        if (response.template?.fields && Array.isArray(response.template.fields) && response.template.fields.length > 0) {
          setCustomFields(response.template.fields);
        }
        if (response.template?.enabled_default_fields) {
          setEnabledDefaultFields(response.template.enabled_default_fields);
          hasEnabledDefaultFields = true;
        }

        // courseにもtemplateにもenabled_default_fieldsがない場合は全デフォルトフィールドを使用（後方互換性）
        if (!hasEnabledDefaultFields) {
          setEnabledDefaultFields(['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback']);
        }

        // 位置情報設定を反映
        if (course.location_settings) {
          setCampusCenter(course.location_settings);
          LocationCacheManager.saveLocationSettings(course.location_settings);
        }
        setCourseDataLoaded(true);
      } else {
        toast.error('指定された講義が見つかりません');
        setCourseDataLoaded(true);
      }
    } catch (error) {
      toast.error('講義情報の取得中にエラーが発生しました');
      setCourseDataLoaded(true);
    }
  }, [courseId, form]);

  // 位置情報設定を取得する関数
  // 講義にlocation_settingsが設定されている場合のみ位置情報チェックを有効化
  const fetchLocationSettings = useCallback(async () => {
    if (isSubmittingForm) return;

    try {
      // 講義から取得済みのlocation_settingsがある場合はそれを使用
      if (targetCourse?.locationSettings) {
        setCampusCenter(targetCourse.locationSettings);
        LocationCacheManager.saveLocationSettings(targetCourse.locationSettings);
      }
      // location_settingsがない場合はcampusCenterをnullのままにする（位置情報チェック不要）
    } catch {
      // エラー時はcampusCenterをnullのままにする（位置情報チェック不要）
    }
  }, [targetCourse, isSubmittingForm]);

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
        setTimeUntilNextSubmission(Math.ceil(remainingTime));

        // タイマーを設定
        const timer = setInterval(() => {
          const now = Date.now();
          const elapsed = (now - lastTime) / (1000 * 60);
          const remaining = Math.max(0, Math.ceil(15 - elapsed));

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
    if (isInitialized) {
      if (courseId) {
        fetchTargetCourse();
      } else {
        // courseIdがない場合は講義データ取得不要 → デフォルトフィールドを全て有効にしてロード完了
        setEnabledDefaultFields(['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback']);
        setCourseDataLoaded(true);
      }
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
        setTimeUntilNextSubmission(Math.max(1, Math.ceil((cooldownPeriod - elapsedTime) / 1000 / 60)));
      }
    }, 60000);
    
    return () => clearInterval(timer);
  }, [timeUntilNextSubmission, courseId]);

  // 位置情報許可ボタンが押されたときに位置情報を取得
  const requestLocationPermission = useCallback(async () => {
    if (!campusCenter) return;

    setShowLocationModal(false);
    setLocationInfo({ status: 'loading', message: '位置情報を取得中...' });

    try {
      // キャッシュをクリアしてから新鮮な位置情報を取得（古い位置データでの誤判定を防止）
      LocationCacheManager.clearLocationCache();
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

      setLocationFetched(true);
    } catch (error) {
      setLocationInfo({
        status: 'error',
        message: `位置情報を取得できませんでした: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
      setShowLocationPermissionModal(true);
      setLocationFetched(true);
    }
  }, [campusCenter]);

  // 講義データ取得完了フラグ
  const [courseDataLoaded, setCourseDataLoaded] = useState(false);

  // campusCenterが設定されていない場合（位置情報不要）はモーダルをスキップ
  // ※講義データの取得が完了してから判定する（早期判定による誤スキップを防止）
  useEffect(() => {
    if (!courseDataLoaded) return; // 講義データ未取得の場合は判定しない
    if (!campusCenter && !locationFetched) {
      setShowLocationModal(false);
      setLocationInfo({
        status: 'success',
        message: '位置情報の確認は不要です',
        isOnCampus: true,
      });
      setLocationFetched(true);
    }
  }, [campusCenter, locationFetched, courseDataLoaded]);

  // 位置情報設定がある場合、自動的に位置情報を取得開始（モーダルをスキップ）
  useEffect(() => {
    if (campusCenter && !locationFetched && isInitialized) {
      setShowLocationModal(false);
      requestLocationPermission();
    }
  }, [campusCenter, locationFetched, isInitialized, requestLocationPermission]);

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
    setIsSubmitting(true); // ボタンローディング表示
    setIsSubmittingForm(true); // フォーム送信開始
    
    // 講義名の確認を条件付きに変更
    if (!courseId && !values.class_name) {
      setSubmitError('講義が選択されていません。');
      toast.error('講義を選択してください');
      setIsSubmitting(false);
      setIsSubmittingForm(false);
      return;
    }

    // 位置情報の検証（既に取得済みの情報を使用）
    if (campusCenter && locationInfo.status !== 'success') {
      setSubmitError(`${campusCenter.locationName || 'キャンパス'}の許可範囲外からは出席登録できません`);
      toast.error('許可範囲外からの出席登録は拒否されます');
      setIsSubmitting(false);
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
        setIsSubmitting(false);
        setIsSubmittingForm(false);
        return;
      }
    }
    
    const latitude = locationInfo.latitude || campusCenter?.latitude || 33.1751332;
    const longitude = locationInfo.longitude || campusCenter?.longitude || 131.6138803;

    // Supabase v2 API用のリクエストボディ
    const requestBody = {
      courseCode: courseId, // QRコードのコード
      courseId: targetCourse?.id, // Supabase内部ID
      student_id: values.student_id,
      name: values.name,
      grade: values.grade,
      department: values.department,
      feedback: values.feedback,
      latitude,
      longitude,
      customFields: (() => {
        // カスタムフィールドのデータを抽出
        const customData: Record<string, any> = {};
        customFields.forEach(field => {
          if (values[field.name] !== undefined) {
            customData[field.name] = values[field.name];
          }
        });
        return customData;
      })(),
    };

    // API送信 (Supabase v2 API) - 1回のみ送信
    try {
      const response = await fetch('/api/v2/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // 成功時のみクールダウン設定
        localStorage.setItem(storageKey, Date.now().toString());
        setLastSubmissionTime(Date.now());
        setTimeUntilNextSubmission(15);
        toast.success('出席を登録しました');
        router.replace('/attendance/complete');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setSubmitError(errorData.message || '出席登録に失敗しました。もう一度お試しください。');
        toast.error('出席登録に失敗しました');
        setIsSubmitting(false);
        setIsSubmittingForm(false);
      }
    } catch {
      setSubmitError('ネットワークエラーが発生しました。通信環境を確認してもう一度お試しください。');
      toast.error('通信エラーが発生しました');
      setIsSubmitting(false);
      setIsSubmittingForm(false);
    }
  };

  // フォーム有効性チェックの修正（416行目付近）
  const isFormValid = form.formState.isValid; // 講義名チェックを削除

  const isSubmitEnabled =
    isFormValid
    && (!campusCenter || locationInfo.isOnCampus === true)
    && timeUntilNextSubmission === 0;

  return (
    <>
      {/* 初期化エラー表示 */}
      <AnimatePresence>
        {initializationError && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-lg mx-auto px-4 pt-4"
          >
            <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/60 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-red-800">初期化エラー</h3>
                  <p className="text-sm text-red-600 mt-0.5 leading-relaxed">{initializationError}</p>
                  <button
                    onClick={() => {
                      setInitializationError(null);
                      setIsInitialized(false);
                    }}
                    className="mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2 transition-colors"
                  >
                    再試行
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 初期化中のローディング表示 */}
      {!isInitialized && !initializationError && (
        <div className="w-full max-w-lg mx-auto px-4 pt-16 flex flex-col items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">読み込み中...</p>
              <p className="text-xs text-slate-400 mt-1">しばらくお待ちください</p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="w-full max-w-lg mx-auto min-h-screen pb-32 sm:pb-8">
        {/* 初期化完了後のみフォームを表示 */}
        {isInitialized && (
          <>
            {/* 位置情報許可モーダル（位置情報設定がある場合のみ表示） */}
            <AnimatePresence>
              {showLocationModal && campusCenter && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
                >
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="bg-white rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 w-full sm:max-w-md shadow-2xl"
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                        <Shield className="h-7 w-7 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">位置情報の許可が必要です</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-2">
                        {campusCenter?.locationName || 'キャンパス'}内からの出席登録を確認するために、位置情報の利用許可が必要です。
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed mb-1">
                        位置情報はキャンパス内にいることの確認のみに使用されます。
                      </p>
                      {campusCenter && (
                        <p className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-3 py-1 mt-2 mb-6">
                          {campusCenter.locationName || 'キャンパス'}から半径{campusCenter.radius}km以内
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={requestLocationPermission}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl h-12 shadow-lg shadow-indigo-200/50 transition-all"
                    >
                      位置情報を許可して続ける
                    </Button>
                    <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-4 sm:hidden" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="px-5 pt-8 pb-2"
            >
              <motion.div variants={fadeInUp} className="flex flex-col items-center">
                <Image
                  src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                  alt="ざせきくん"
                  width={72}
                  height={72}
                  className="rounded-2xl shadow-lg shadow-indigo-100/50 mb-4"
                />
                <h2 className="text-xl font-bold text-slate-900 tracking-tight text-center">出席管理システム</h2>
                <p className="text-slate-500 text-center text-sm mt-1 mb-4 leading-relaxed">
                  必要項目を入力して、出席登録をしましょう
                </p>

                {/* 位置情報エラー時のみ表示 */}
                {campusCenter && locationInfo.status === 'error' && (
                  <motion.div
                    variants={scaleIn}
                    className="w-full max-w-sm bg-red-50/80 border border-red-200/60 rounded-xl p-3 text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-700">位置情報を取得できませんでした</span>
                    </div>
                    <p className="text-[11px] text-red-600/80 leading-relaxed mb-2">
                      出席登録には位置情報の許可が必要です。
                      <br />
                      ブラウザの設定から位置情報を許可してください。
                    </p>
                    <button
                      onClick={() => {
                        LocationCacheManager.clearLocationCache();
                        setLocationFetched(false);
                        setLocationInfo({ status: 'loading', message: '位置情報を再取得中...' });
                        requestLocationPermission();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      再取得する
                    </button>
                  </motion.div>
                )}
                {campusCenter && locationInfo.status === 'loading' && (
                  <motion.div variants={scaleIn} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    位置情報を取得中...
                  </motion.div>
                )}
              </motion.div>
            </motion.div>

            {/* Cooldown warning */}
            <AnimatePresence>
              {timeUntilNextSubmission > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 mt-3"
                >
                  <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-xl p-3 flex items-center gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-xs text-amber-700 leading-relaxed">
                      次回登録可能まであと約<span className="font-semibold">{timeUntilNextSubmission}分</span>です
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="px-5 mt-3"
                >
                  <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/60 rounded-xl p-3 flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center mt-0.5">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed flex-1">{submitError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form card */}
            <div className="px-4 mt-5">
              <motion.div
                variants={slideUp}
                initial="initial"
                animate="animate"
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-slate-200/50 border border-slate-200/60 overflow-hidden"
              >
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-5">
                    {/* 動的フィールドレンダリング */}
                    {(() => {
                      if (process.env.NODE_ENV === 'development') {
                        // console.log('Rendering dynamic fields...');
                      }

                      const allFields: CustomFormField[] = [
                        ...defaultFields.filter(field => enabledDefaultFields.includes(field.key)).map((field, index) => ({
                          id: field.key,
                          name: field.key,
                          label: field.label,
                          type: field.type,
                          required: true,
                          placeholder: '',
                          description: '',
                          options: [],
                          order: index
                        })),
                        ...customFields.sort((a, b) => (a.order || 0) - (b.order || 0))
                      ];

                      if (process.env.NODE_ENV === 'development') {
                        // console.log('allFields:', allFields);
                      }

                      if (allFields.length === 0) {
                        return (
                          <div className="text-center py-12">
                            <p className="text-sm text-slate-400">フォーム項目が設定されていません</p>
                          </div>
                        );
                      }

                      const fieldPairs = [];
                      for (let i = 0; i < allFields.length; i += 2) {
                        fieldPairs.push(allFields.slice(i, i + 2));
                      }

                      return (
                        <motion.div
                          variants={staggerContainer}
                          initial="initial"
                          animate="animate"
                        >
                          {fieldPairs.map((pair, pairIndex) => (
                            <motion.div
                              key={pairIndex}
                              variants={fadeInUp}
                              className={`grid grid-cols-1 ${pair.length === 2 && pair[0].type !== 'textarea' && pair[1]?.type !== 'textarea' ? 'md:grid-cols-2' : ''} gap-4 mb-4`}
                            >
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
                            </motion.div>
                          ))}
                        </motion.div>
                      );
                    })()}

                    {/* Desktop submit button (hidden on mobile) */}
                    <div className="hidden sm:block pt-2">
                      <motion.div
                        whileHover={{ scale: isSubmitEnabled ? 1.01 : 1 }}
                        whileTap={{ scale: isSubmitEnabled ? 0.97 : 1 }}
                      >
                        <Button
                          type="submit"
                          className={`w-full font-medium rounded-xl h-12 transition-all ${
                            timeUntilNextSubmission > 0
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none'
                              : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-200/50 disabled:opacity-50 disabled:shadow-none'
                          }`}
                          disabled={isSubmitting || !isSubmitEnabled || timeUntilNextSubmission > 0}
                        >
                          {isSubmitting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              送信中...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              出席を登録する
                            </span>
                          )}
                        </Button>
                      </motion.div>

                      {/* Validation hints */}
                      {!isFormValid ? (
                        <p className="text-xs text-slate-400 text-center mt-3">
                          全ての必須項目を入力してください
                        </p>
                      ) : timeUntilNextSubmission > 0 ? (
                        <p className="text-xs text-amber-500 text-center mt-3">
                          同一端末からの連続登録には15分の間隔が必要です
                        </p>
                      ) : (campusCenter && !locationInfo.isOnCampus) ? (
                        <p className="text-xs text-red-500 text-center mt-3">
                          {campusCenter?.locationName || 'キャンパス'}内（半径{campusCenter?.radius || 0.5}km以内）からのみ登録可能
                        </p>
                      ) : null}
                    </div>
                  </form>
                </Form>
              </motion.div>
            </div>

            {/* Footer links */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center gap-3 px-5 mt-6 mb-4"
            >
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <button
                  onClick={() => setShowLocationPermissionModal(true)}
                  className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
                >
                  <HelpCircle className="h-3 w-3" />
                  <span>位置情報の設定</span>
                </button>
                <span className="text-slate-200">|</span>
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
                >
                  <Settings className="h-3 w-3" />
                  <span>管理者の方はこちら</span>
                </button>
              </div>

            </motion.div>

            {/* Sticky bottom submit bar (mobile only) */}
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40">
              <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200/60 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-3">
                {/* Validation message above button */}
                {!isFormValid ? (
                  <p className="text-[11px] text-slate-400 text-center mb-2">
                    全ての必須項目を入力してください
                  </p>
                ) : timeUntilNextSubmission > 0 ? (
                  <p className="text-[11px] text-amber-500 text-center mb-2">
                    連続登録には15分の間隔が必要です
                  </p>
                ) : (campusCenter && !locationInfo.isOnCampus) ? (
                  <p className="text-[11px] text-red-500 text-center mb-2">
                    {campusCenter?.locationName || 'キャンパス'}内からのみ登録可能
                  </p>
                ) : null}

                <motion.div
                  whileTap={{ scale: isSubmitEnabled ? 0.97 : 1 }}
                >
                  <Button
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    className={`w-full font-semibold rounded-xl h-12 transition-all ${
                      timeUntilNextSubmission > 0
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-300/30 disabled:opacity-50 disabled:shadow-none'
                    }`}
                    disabled={isSubmitting || !isSubmitEnabled || timeUntilNextSubmission > 0}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        送信中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        出席を登録する
                      </span>
                    )}
                  </Button>
                </motion.div>
              </div>
            </div>

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