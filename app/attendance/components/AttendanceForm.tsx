'use client';

import { useState, useEffect } from 'react';
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
import { MapPin, AlertTriangle, CheckCircle, GraduationCap } from 'lucide-react';
import Image from 'next/image';

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

// フォームのバリデーションスキーマ
const formSchema = z.object({
  date: z.string().min(1, { message: '日付を入力してください' }),
  class_name: z.string().optional(), // 特定講義の場合は自動設定されるため任意
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
  const [lastSubmissionTime, setLastSubmissionTime] = useState<number | null>(null);
  const [timeUntilNextSubmission, setTimeUntilNextSubmission] = useState<number>(0);

  const [campusCenter, setCampusCenter] = useState<{
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  } | null>(null);

  // フォームの初期化
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      class_name: '',
      student_id: '',
      grade: '',
      name: '',
      department: '',
      feedback: '',
    },
    mode: 'onChange',
  });

  // 全講義一覧を取得
  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/admin/courses');
      if (response.ok) {
        const data = await response.json();
        setCourses(data.courses || []);
      } else {
        console.error('Failed to fetch courses');
        toast.error('講義一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('講義一覧の取得中にエラーが発生しました');
    } finally {
      setLoadingCourses(false);
    }
  };

  // 特定の講義情報を取得
  const fetchTargetCourse = async () => {
    if (!courseId) return;

    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (response.ok) {
        const data = await response.json();
        setTargetCourse(data.course);
        // フォームに講義名を自動設定
        form.setValue('class_name', data.course.courseName);
      } else {
        console.error('Target course not found');
        toast.error('指定された講義が見つかりません');
      }
    } catch (error) {
      console.error('Error fetching target course:', error);
      toast.error('講義情報の取得中にエラーが発生しました');
    }
  };

  // 位置情報設定を取得する関数を修正
  const fetchLocationSettings = async () => {
    try {
      let locationSettings = null;

      // 特定講義の位置情報設定を優先
      if (targetCourse?.locationSettings) {
        locationSettings = targetCourse.locationSettings;
      } else {
        // グローバル設定を取得 - 正しいAPIエンドポイントを使用
        const response = await fetch('/api/admin/location-settings');
        if (response.ok) {
          const data = await response.json();
          locationSettings = data.defaultLocationSettings;
        } else {
          console.error('位置情報設定の取得に失敗:', response.status, response.statusText);
        }
      }

      if (locationSettings) {
        console.log('取得した位置情報設定:', locationSettings);
        setCampusCenter(locationSettings);
      } else {
        // フォールバック: デフォルト値
        console.log('位置情報設定が見つからないため、デフォルト値を使用');
        setCampusCenter({
          latitude: 33.1751332,
          longitude: 131.6138803,
          radius: 0.5,
          locationName: 'デフォルトキャンパス'
        });
      }
    } catch (error) {
      console.error('位置情報設定の取得に失敗:', error);
      // フォールバック値を設定
      setCampusCenter({
        latitude: 33.1751332,
        longitude: 131.6138803,
        radius: 0.5,
        locationName: 'デフォルトキャンパス'
      });
    }
  };

  // コンポーネントマウント時の処理を修正
  useEffect(() => {
    // 全講義一覧を取得
    fetchCourses();
    
    // 特定の講義情報を取得（courseIdがある場合）
    if (courseId) {
      fetchTargetCourse().then(() => {
        // 講義情報取得後に位置情報設定を取得
        fetchLocationSettings();
      });
    } else {
      // 講義指定がない場合はすぐに位置情報設定を取得
      fetchLocationSettings();
    }

    // 前回の登録時刻を取得
    const storageKey = courseId ? `lastAttendanceSubmission_${courseId}` : 'lastAttendanceSubmission';
    const storedTime = localStorage.getItem(storageKey);
    if (storedTime) {
      const parsedTime = parseInt(storedTime, 10);
      setLastSubmissionTime(parsedTime);
      
      const cooldownPeriod = 15 * 60 * 1000;
      const currentTime = Date.now();
      const elapsedTime = currentTime - parsedTime;
      
      if (elapsedTime < cooldownPeriod) {
        setTimeUntilNextSubmission(Math.ceil((cooldownPeriod - elapsedTime) / 1000 / 60));
      }
    }
  }, [courseId]);

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
    if (!showLocationModal && campusCenter) {
      const getLocation = async () => {
        try {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                const distance = calculateDistance(
                  lat, lng,
                  campusCenter.latitude, campusCenter.longitude
                );
                
                const isOnCampus = distance <= campusCenter.radius;
                
                setLocationInfo({
                  status: isOnCampus ? 'success' : 'outside',
                  message: isOnCampus 
                    ? `${campusCenter.locationName || 'キャンパス'}内から出席登録を行っています` 
                    : `${campusCenter.locationName || 'キャンパス'}の外から出席登録を行っています`,
                  latitude: lat,
                  longitude: lng,
                  distance,
                  isOnCampus
                });
                
                console.log('位置情報:', { latitude: lat, longitude: lng, distance, isOnCampus });
              },
              (error) => {
                console.error('位置情報エラー:', error);
                setLocationInfo({
                  status: 'error',
                  message: `位置情報を取得できませんでした: ${error.message}`,
                });
              },
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000
              }
            );
          } else {
            setLocationInfo({
              status: 'error',
              message: 'お使いのブラウザは位置情報をサポートしていません',
            });
          }
        } catch (error) {
          console.error('位置情報例外:', error);
          setLocationInfo({
            status: 'error',
            message: '位置情報の取得中にエラーが発生しました',
          });
        }
      };
      
      getLocation();
    }
  }, [showLocationModal, campusCenter]);

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
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitError(null);
    
    // 講義名の確認を条件付きに変更
    if (!courseId && !values.class_name) {
      setSubmitError('講義が選択されていません。');
      toast.error('講義を選択してください');
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
          date: values.date,
          class_name: values.class_name,
          student_id: values.student_id,
          grade: parseInt(values.grade),
          name: values.name,
          department: values.department,
          feedback: values.feedback,
          latitude,
          longitude,
          courseId: targetCourse?.id, // 講義IDも送信（ある場合）
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '出席登録に失敗しました');
      }

      console.log('登録成功');
      
      localStorage.setItem(storageKey, Date.now().toString());
      setLastSubmissionTime(Date.now());
      setTimeUntilNextSubmission(15);
      
      toast.success('出席を登録しました');
      router.push('/attendance/complete');
    } catch (error: any) {
      console.error('出席登録エラー:', error);
      setSubmitError(error?.message || '出席登録に失敗しました');
      toast.error('出席登録に失敗しました。もう一度お試しください。');
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
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-100">
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
        <p className="text-gray-600 text-center text-sm max-w-sm">
          レポートを提出して、出席登録をしましょう。
        </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">日付</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="border-indigo-200 focus:border-indigo-400"
                      style={{ fontSize: '16px' }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="class_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">講義名</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={targetCourse !== null} // 特定講義の場合は無効化
                  >
                    <FormControl>
                      <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
                        <SelectValue placeholder={
                          loadingCourses ? "読み込み中..." : 
                          targetCourse ? targetCourse.courseName : ""
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingCourses ? (
                        <SelectItem value="loading" disabled>講義を読み込み中...</SelectItem>
                      ) : courses.length === 0 ? (
                        <SelectItem value="no-courses" disabled>登録されている講義がありません</SelectItem>
                      ) : (
                        courses.map((course) => (
                          <SelectItem key={course.id} value={course.courseName}>
                            {course.courseName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="student_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">学籍番号</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: A12345"
                      className="border-indigo-200 focus:border-indigo-400"
                      style={{ fontSize: '16px' }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">学年</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
                        <SelectValue placeholder="学年を選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1">1年</SelectItem>
                      <SelectItem value="2">2年</SelectItem>
                      <SelectItem value="3">3年</SelectItem>
                      <SelectItem value="4">4年</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">名前</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: 山田太郎"
                      className="border-indigo-200 focus:border-indigo-400"
                      style={{ fontSize: '16px' }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-indigo-700">学科・コース</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: 経済学部"
                      className="border-indigo-200 focus:border-indigo-400"
                      style={{ fontSize: '16px' }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="feedback"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">講義レポート</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="出題された問いに対してのレポートを入力してください"
                    className="resize-none border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px', minHeight: 'calc(1.5em * 4 + 1rem + 32px)' }}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
    </div>
  );
}