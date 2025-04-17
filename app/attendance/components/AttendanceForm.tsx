'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';

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
import { MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

// フォームのバリデーションスキーマ
const formSchema = z.object({
  date: z.string().min(1, { message: '日付を入力してください' }),
  class_name: z.string().min(1, { message: '講義名を入力してください' }),
  student_id: z.string().min(1, { message: '学籍番号を入力してください' }),
  grade: z.string().min(1, { message: '学年を選択してください' }),
  name: z.string().min(1, { message: '名前を入力してください' }),
  department: z.string().min(1, { message: '学科・コースを入力してください' }),
  feedback: z.string().min(1, { message: '講義レポートを入力してください' }),
});

// 大分大学旦野原キャンパスの位置情報
const CAMPUS_CENTER = {
  latitude: 33.1751332, // 現在地の緯度を使用
  longitude: 131.6138803, // 現在地の経度を使用
  radius: 0.5, // キャンパス半径（km）
};

export default function AttendanceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  // フォームの初期化
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0], // 今日の日付をデフォルト値に
      class_name: '',
      student_id: '',
      grade: '',
      name: '',
      department: '',
      feedback: '',
    },
    mode: 'onChange', // リアルタイムバリデーション
  });

  // コンポーネントマウント時に前回の登録時刻を取得
  useEffect(() => {
    const storedTime = localStorage.getItem('lastAttendanceSubmission');
    if (storedTime) {
      const parsedTime = parseInt(storedTime, 10);
      setLastSubmissionTime(parsedTime);
      
      // 残り時間の計算
      const cooldownPeriod = 15 * 60 * 1000; // 15分（ミリ秒）
      const currentTime = Date.now();
      const elapsedTime = currentTime - parsedTime;
      
      if (elapsedTime < cooldownPeriod) {
        setTimeUntilNextSubmission(Math.ceil((cooldownPeriod - elapsedTime) / 1000 / 60));
      }
    }
  }, []);

  // 残り時間のカウントダウン処理
  useEffect(() => {
    if (timeUntilNextSubmission <= 0) return;
    
    const timer = setInterval(() => {
      const storedTime = localStorage.getItem('lastAttendanceSubmission');
      if (!storedTime) {
        clearInterval(timer);
        return;
      }
      
      const parsedTime = parseInt(storedTime, 10);
      const cooldownPeriod = 15 * 60 * 1000; // 15分（ミリ秒）
      const currentTime = Date.now();
      const elapsedTime = currentTime - parsedTime;
      
      if (elapsedTime >= cooldownPeriod) {
        setTimeUntilNextSubmission(0);
        clearInterval(timer);
      } else {
        setTimeUntilNextSubmission(Math.ceil((cooldownPeriod - elapsedTime) / 1000 / 60));
      }
    }, 60000); // 1分ごとに更新
    
    return () => clearInterval(timer);
  }, [timeUntilNextSubmission]);

  // 位置情報を取得
  useEffect(() => {
    // モーダルが閉じられた後に位置情報を取得するよう変更
    if (!showLocationModal) {
      const getLocation = async () => {
        try {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // キャンパスとの距離を計算（Haversine公式）
                const distance = calculateDistance(
                  lat, lng,
                  CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude
                );
                
                const isOnCampus = distance <= CAMPUS_CENTER.radius;
                
                setLocationInfo({
                  status: isOnCampus ? 'success' : 'outside',
                  message: isOnCampus 
                    ? 'キャンパス内から出席登録を行っています' 
                    : 'キャンパスの外から出席登録を行っています',
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
                enableHighAccuracy: true, // 高精度モードを有効化
                maximumAge: 0,           // キャッシュを使わず常に新しい位置情報を取得
                timeout: 10000           // タイムアウト時間を延長（ミリ秒）
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
  }, [showLocationModal]);

  // 2点間の距離を計算（Haversine公式）
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // 地球の半径（km）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // km単位の距離
  }

  // フォーム送信処理
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setSubmitError(null);
    
    // 前回の登録から15分経過していないかチェック
    const lastSubmissionTimeStored = localStorage.getItem('lastAttendanceSubmission');
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

      // 位置情報を取得
      let latitude = locationInfo.latitude || 33.1751332; // デフォルト値
      let longitude = locationInfo.longitude || 131.6138803; // デフォルト値

      // Supabaseにデータを送信
      const { data, error } = await supabase
        .from('attendance_records')
        .insert({
          date: values.date,
          class_name: values.class_name,
          student_id: values.student_id,
          grade: parseInt(values.grade),
          name: values.name,
          department: values.department,
          feedback: values.feedback,
          latitude,
          longitude,
        })
        .select();

      if (error) {
        console.error('Supabaseエラー:', error);
        throw new Error(`データ挿入エラー: ${error.message}`);
      }

      console.log('登録成功:', data);
      
      // 成功時に現在時刻をローカルストレージに保存
      localStorage.setItem('lastAttendanceSubmission', Date.now().toString());
      setLastSubmissionTime(Date.now());
      setTimeUntilNextSubmission(15); // 15分に設定
      
      // 成功メッセージ
      toast.success('出席を登録しました');
      
      // 出席完了画面に遷移
      router.push('/attendance/complete');
    } catch (error: any) {
      console.error('出席登録エラー:', error);
      setSubmitError(error?.message || '出席登録に失敗しました');
      toast.error('出席登録に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 全てのフィールドが入力されているか確認
  const isFormValid = form.formState.isValid;
  const isSubmitEnabled = 
    (process.env.NODE_ENV === 'development' 
      ? isFormValid // 開発環境では位置情報チェックをスキップ
      : isFormValid && (locationInfo.isOnCampus === true)) // 本番環境ではキャンパス内のみ許可
    && timeUntilNextSubmission === 0; // 15分経過していれば登録可能

  return (
    <div
      className="w-full max-w-md mx-auto p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-100"
    >
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-indigo-700 mb-4">位置情報の許可が必要です</h3>
            <p className="mb-4">
              出席管理システムでは、大分大学旦野原キャンパス内からの出席登録を確認するために、位置情報の利用許可が必要です。
            </p>
            <p className="mb-6 text-sm text-gray-600">
              次の画面で「許可」を選択してください。位置情報はキャンパス内にいることの確認のみに使用され、他の目的では利用されません。
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

      <h2 className="text-2xl font-bold mb-2 text-center text-indigo-700">出席登録</h2>
      
      {timeUntilNextSubmission > 0 && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-md flex items-center gap-2">
          <AlertTriangle size={20} />
          <span className="text-sm">
            同一端末からの連続登録はできません。次回登録可能まであと約{timeUntilNextSubmission}分です。
          </span>
        </div>
      )}

      <div className={`mb-6 p-3 rounded-md flex items-center gap-2 ${
        locationInfo.status === 'loading' ? 'bg-gray-100 text-gray-600' :
        locationInfo.status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
        locationInfo.status === 'outside' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
        'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {locationInfo.status === 'loading' && (
          <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent" />
        )}
        {locationInfo.status === 'success' && <CheckCircle size={20} />}
        {locationInfo.status === 'outside' && <AlertTriangle size={20} />}
        {locationInfo.status === 'error' && <AlertTriangle size={20} />}
        
        <span className="text-sm">{locationInfo.message}</span>
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
                    <Input type="date" className="border-indigo-200 focus:border-indigo-400" {...field} />
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
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="border-indigo-200 focus:border-indigo-400">
                        <SelectValue placeholder="講義を選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="地域経営論Ⅰ">地域経営論Ⅰ</SelectItem>
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
                    <Input placeholder="例: A12345" className="border-indigo-200 focus:border-indigo-400" {...field} />
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
                      <SelectTrigger className="border-indigo-200 focus:border-indigo-400">
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
                    <Input placeholder="例: 山田太郎" className="border-indigo-200 focus:border-indigo-400" {...field} />
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
                    <Input placeholder="例: 経済学部" className="border-indigo-200 focus:border-indigo-400" {...field} />
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
            <p className="text-sm text-amber-600 text-center">全ての必須項目を入力してください</p>
          ) : timeUntilNextSubmission > 0 ? (
            <p className="text-sm text-amber-600 text-center">同一端末からの連続登録には15分の間隔が必要です</p>
          ) : (!locationInfo.isOnCampus && process.env.NODE_ENV === 'production') ? (
            <p className="text-sm text-red-600 text-center">大分大学キャンパス内からのみ出席登録が可能です</p>
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