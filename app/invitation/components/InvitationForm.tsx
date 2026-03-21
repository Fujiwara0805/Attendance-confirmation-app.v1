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
import { Calendar, Loader2, Send, AlertCircle, User, Mail, Phone } from 'lucide-react';
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

/** Extract a short venue name from a full Japanese address */
function extractVenueName(location: string, locationDetail?: string): string {
  if (locationDetail) return locationDetail;
  // Try to extract the last meaningful part (building/venue name)
  // Japanese addresses typically end with the venue name
  // Pattern: 都道府県 市区町村 ... ビル名/会場名
  const parts = location.split(/[\s　]+/);
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return location;
}

function getGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

// Stagger animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

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
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/30 to-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
          <p className="text-sm text-amber-800/60 tracking-wide font-light">招待状を準備しています...</p>
        </motion.div>
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
  const eventLocation = invitationSettings?.eventLocation;
  const venueName = eventLocation
    ? extractVenueName(eventLocation, invitationSettings?.eventLocationDetail)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-orange-50/20 to-stone-50">

      {/* Hero Section with Unsplash Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative w-full h-[340px] sm:h-[400px] overflow-hidden"
      >
        <Image
          src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80&auto=format&fit=crop"
          alt="Invitation"
          fill
          className="object-cover"
          priority
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />

        {/* Event title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <p className="text-amber-200/90 text-xs tracking-[0.3em] uppercase font-medium mb-2">
              INVITATION
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-wide">
              {courseData.name}
            </h1>
          </motion.div>
        </div>
      </motion.div>

      <main className="max-w-lg mx-auto px-4 sm:px-6 -mt-6 relative z-10 pb-12">

        {/* Event Details Card - Invitation Card Style */}
        <motion.div
          custom={0}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-2xl shadow-lg shadow-amber-900/5 border border-amber-100/60 p-6 mb-5"
        >
          {/* Decorative top line with title */}
          <p className="text-center text-sm text-amber-600 tracking-[0.15em] font-medium mb-5">
            ーーー招待カードーーー
          </p>

          <div className="space-y-3 text-sm text-stone-700 leading-relaxed">
            {/* イベント名 */}
            <p>
              <span className="font-semibold text-stone-800">イベント名：</span>
              {courseData.name}
            </p>

            {/* 開催地 */}
            {eventLocation && venueName && (
              <p>
                <span className="font-semibold text-stone-800">開催地：</span>
                <a
                  href={getGoogleMapsUrl(eventLocation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-500 underline underline-offset-2 transition-colors"
                >
                  {venueName}
                </a>
              </p>
            )}

            {/* イベント概要 */}
            {invitationSettings?.eventDescription && (
              <p>
                <span className="font-semibold text-stone-800">イベント概要：</span>
                {invitationSettings.eventDescription}
              </p>
            )}
          </div>

          {/* 注意事項・備考欄 */}
          {invitationSettings?.eventNotes && (
            <div className="mt-5 pt-4 border-t border-amber-100/40">
              <p className="text-sm text-stone-700 leading-relaxed">
                <span className="font-semibold text-stone-800">注意事項・備考欄：</span>
                <span className="whitespace-pre-wrap">{invitationSettings.eventNotes}</span>
              </p>
            </div>
          )}

          {/* Decorative bottom line */}
          <p className="text-center text-sm text-amber-600 tracking-[0.15em] font-medium mt-5">
            ーーーーーーーーーーー
          </p>
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Date/Time Selection */}
            {invitationSettings && invitationSettings.dateSlots.length > 0 && (
              <motion.div
                custom={1}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                <div className="bg-white rounded-2xl shadow-lg shadow-amber-900/5 border border-amber-100/60 p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
                      <Calendar className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-sm font-semibold text-stone-800 tracking-wide">
                      ご希望の日時 <span className="text-red-400 text-xs">*</span>
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

            {/* Participant Info */}
            <motion.div
              custom={2}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <div className="bg-white rounded-2xl shadow-lg shadow-amber-900/5 border border-amber-100/60 p-6 space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold text-stone-800 tracking-wide">
                    ご参加者情報
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="respondentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-stone-700 text-xs font-medium tracking-wide">
                        お名前 <span className="text-red-400">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="例: 田中太郎"
                          className="border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl bg-stone-50/50 h-11"
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
                      <FormLabel className="text-stone-700 text-xs font-medium tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-amber-500" />
                          メールアドレス
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="example@email.com"
                          className="border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl bg-stone-50/50 h-11"
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
                      <FormLabel className="text-stone-700 text-xs font-medium tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-amber-500" />
                          電話番号
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="090-1234-5678"
                          className="border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl bg-stone-50/50 h-11"
                          style={{ fontSize: '16px' }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <motion.div
                custom={3}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                <div className="bg-white rounded-2xl shadow-lg shadow-amber-900/5 border border-amber-100/60 p-6 space-y-5">
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

            {/* Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.div
              custom={4}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-13 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-base rounded-2xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 border-0"
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

            {/* Footer branding with logo */}
            <motion.div
              custom={5}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center pt-5 pb-2 gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <Image
                  src="https://res.cloudinary.com/dz9trbwma/image/upload/f_auto,q_auto,w_200/v1753971383/%E3%81%95%E3%82%99%E3%81%9B%E3%81%8D%E3%81%8F%E3%82%93%E3%81%AE%E3%81%8F%E3%81%A4%E3%82%8D%E3%81%8D%E3%82%99%E3%82%BF%E3%82%A4%E3%83%A0_-_%E7%B7%A8%E9%9B%86%E6%B8%88%E3%81%BF_ikidyx.png"
                  alt="ざせきくん"
                  width={16}
                  height={16}
                  className="rounded-full"
                />
                <span className="text-[11px] font-medium text-stone-400">ざせきくん</span>
              </div>
              <p className="text-[10px] text-stone-300 tracking-wider">
                Powered by ざせきくん
              </p>
            </motion.div>
          </form>
        </Form>
      </main>
    </div>
  );
}
