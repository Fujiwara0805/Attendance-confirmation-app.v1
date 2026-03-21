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
import { motion } from 'framer-motion';
import { MapPin, Calendar, Loader2, Send, AlertCircle, User, Mail, Phone, Info } from 'lucide-react';
import Image from 'next/image';
import type { CustomFormField as CustomFieldType, InvitationSettings, TimeSlot } from '@/app/types';
import { createDynamicSchema, createDefaultValues } from '@/lib/dynamicFormUtils';
import DynamicFormField from '@/app/attendance/components/DynamicFormField';
import DateSlotPicker from './DateSlotPicker';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

interface CourseData {
  id: string;
  code: string;
  name: string;
  description?: string;
  teacher_name: string;
  form_type: string;
  invitation_settings: InvitationSettings | null;
  custom_fields: CustomFieldType[];
  enabled_default_fields: string[];
}

export default function InvitationForm() {
  const router = useRouter();
  const params = useParams();
  const courseCode = params.code as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);

  // 日時選択
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<string | null>(null);
  const [selectedTimeLabel, setSelectedTimeLabel] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // 基本情報のスキーマ
  const baseSchema = z.object({
    respondentName: z.string().min(1, { message: 'お名前を入力してください' }),
    respondentEmail: z.string().email({ message: '有効なメールアドレスを入力してください' }).optional().or(z.literal('')),
    respondentPhone: z.string().optional(),
  });

  const [formSchema, setFormSchema] = useState<z.ZodObject<any>>(baseSchema);
  const [defaultValues, setDefaultValues] = useState<Record<string, any>>({
    respondentName: '',
    respondentEmail: '',
    respondentPhone: '',
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // コースデータ取得
  const fetchCourseData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJsonWithRetry(`/api/v2/courses/${courseCode}`);
      const course = data.course as CourseData;

      if (!course) {
        setError('フォームが見つかりません');
        return;
      }

      if (course.form_type !== 'invitation') {
        // 出席フォームの場合はリダイレクト
        router.replace(`/attendance/${courseCode}`);
        return;
      }

      setCourseData(course);

      // カスタムフィールドのスキーマを生成
      const customFields = course.custom_fields || [];
      if (customFields.length > 0) {
        const customSchema = createDynamicSchema(customFields, []);
        const mergedSchema = baseSchema.merge(customSchema);
        setFormSchema(mergedSchema);

        const customDefaults = createDefaultValues(customFields, []);
        setDefaultValues(prev => ({ ...prev, ...customDefaults }));
      }
    } catch (err) {
      setError('フォームの読み込みに失敗しました');
      console.error('Error fetching course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseCode, router]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // フォーム送信
  const onSubmit = async (data: any) => {
    if (!selectedDate || !selectedTimeSlotId) {
      setDateError('日時を選択してください');
      return;
    }
    setDateError(null);
    setSubmitting(true);

    try {
      const { respondentName, respondentEmail, respondentPhone, ...customFields } = data;

      const response = await fetch('/api/v2/invitation-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseCode,
          respondentName,
          respondentEmail: respondentEmail || undefined,
          respondentPhone: respondentPhone || undefined,
          customFields,
          selectedDate,
          selectedTimeSlotId,
          selectedTimeLabel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '送信に失敗しました');
      }

      const result = await response.json();

      // 完了ページへリダイレクト
      sessionStorage.setItem('invitation_response', JSON.stringify({
        responseCode: result.responseCode,
        respondentName,
        selectedTimeLabel,
        courseName: result.courseName,
      }));
      router.push('/invitation/complete');
    } catch (err) {
      console.error('Submit error:', err);
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateSelect = (date: string, timeSlot: TimeSlot) => {
    setSelectedDate(date);
    setSelectedTimeSlotId(timeSlot.id);
    setSelectedTimeLabel(timeSlot.label);
    setDateError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error && !courseData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">エラー</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!courseData) return null;

  const invitationSettings = courseData.invitation_settings;
  const customFields = courseData.custom_fields || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Image
              src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
              alt="ざせきくん"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-sm font-semibold text-slate-900">ざせきくん</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* イベント情報 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-xl font-bold text-slate-900 mb-2">{courseData.name}</h1>
          {invitationSettings?.eventDescription && (
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              {invitationSettings.eventDescription}
            </p>
          )}
          {invitationSettings?.eventLocation && (
            <div className="flex items-start gap-2 text-sm text-slate-500 mb-1">
              <MapPin className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <span>{invitationSettings.eventLocation}</span>
                {invitationSettings.eventLocationDetail && (
                  <span className="text-slate-400 ml-1">({invitationSettings.eventLocationDetail})</span>
                )}
              </div>
            </div>
          )}
          {invitationSettings?.eventNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 mt-3">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{invitationSettings.eventNotes}</p>
            </div>
          )}
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 日時選択 */}
            {invitationSettings && invitationSettings.dateSlots.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-slate-800">
                      参加日時を選択 <span className="text-red-500">*</span>
                    </h2>
                  </div>
                  <DateSlotPicker
                    dateSlots={invitationSettings.dateSlots}
                    selectedDate={selectedDate}
                    selectedTimeSlotId={selectedTimeSlotId}
                    onSelect={handleDateSelect}
                  />
                  {dateError && (
                    <p className="text-xs text-red-500 mt-2">{dateError}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* 参加者情報 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-500" />
                  参加者情報
                </h2>

                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-600">
                    お名前・メールアドレス・電話番号は参加者情報として事前に設定されています。
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="respondentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-indigo-700">
                        お名前 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="例: 田中太郎"
                          className="border-indigo-200 focus:border-indigo-400"
                          style={{ fontSize: '16px' }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="respondentEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-indigo-700">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          メールアドレス
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="example@email.com"
                          className="border-indigo-200 focus:border-indigo-400"
                          style={{ fontSize: '16px' }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="respondentPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-indigo-700">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          電話番号
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="090-1234-5678"
                          className="border-indigo-200 focus:border-indigo-400"
                          style={{ fontSize: '16px' }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            {/* カスタムフィールド */}
            {customFields.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                  {customFields.map((field) => (
                    <DynamicFormField
                      key={field.id}
                      control={form.control}
                      field={field}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 送信ボタン */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-base rounded-xl shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    参加を申し込む
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </Form>
      </main>
    </div>
  );
}
