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

/* ── SVG ornamental corner (gold flourish) ── */
const GoldCorner = ({ className }: { className?: string }) => (
  <svg className={className} width="40" height="40" viewBox="0 0 40 40" fill="none">
    <path d="M0 0 C0 0 8 0 12 4 C16 8 16 12 20 16 C24 12 24 8 28 4 C32 0 40 0 40 0" stroke="#c9a96e" strokeWidth="1" fill="none" />
    <path d="M0 0 C0 0 0 8 4 12 C8 16 12 16 16 20 C12 24 8 24 4 28 C0 32 0 40 0 40" stroke="#c9a96e" strokeWidth="1" fill="none" />
    <circle cx="4" cy="4" r="1.5" fill="#c9a96e" />
  </svg>
);

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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full border-2 border-[#c9a96e]/30 border-t-[#c9a96e] animate-spin" />
          <p className="text-sm text-[#0f1629]/50 tracking-[0.2em] font-light">招待状を準備しています...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !courseData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
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
  const eventLocationDetail = invitationSettings?.eventLocationDetail;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative w-full h-[300px] sm:h-[360px] overflow-hidden"
      >
        <Image
          src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200&q=80&auto=format&fit=crop"
          alt="Invitation"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient: dark at top/middle for readable text, fades to page bg at very bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-slate-50" />

        {/* Event title overlay */}
        <div className="absolute bottom-14 left-0 right-0 px-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center"
          >
            <p className="text-[#c9a96e] text-[10px] tracking-[0.4em] uppercase font-medium mb-3">
              ─── Invitation ───
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-wide drop-shadow-lg">
              {courseData.name}
            </h1>
          </motion.div>
        </div>
      </motion.div>

      <main className="max-w-lg mx-auto px-4 sm:px-6 pt-6 pb-12 relative z-10">

        {/* ═══════ Invitation Card ═══════ */}
        <motion.div
          custom={0}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="relative mb-6"
        >
          {/* Navy card with gold border */}
          <div className="relative bg-[#141d35] rounded-xl border border-[#c9a96e]/30 overflow-hidden shadow-2xl shadow-black/40">
            {/* Gold top line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent" />

            {/* Corner ornaments */}
            <GoldCorner className="absolute top-1 left-1" />
            <GoldCorner className="absolute top-1 right-1 -scale-x-100" />
            <GoldCorner className="absolute bottom-1 left-1 -scale-y-100" />
            <GoldCorner className="absolute bottom-1 right-1 scale-x-[-1] scale-y-[-1]" />

            <div className="px-7 py-8 sm:px-8 sm:py-10">
              {/* Card title */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9a96e]/60" />
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2Z" fill="#c9a96e" />
                  </svg>
                  <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9a96e]/60" />
                </div>
                <p className="text-base text-[#c9a96e] tracking-[0.2em] font-semibold">招待カード</p>
              </div>

              {/* Card content - labeled items */}
              <div className="space-y-5">
                {/* イベント名 */}
                <div>
                  <p className="text-xs text-[#c9a96e] tracking-[0.15em] font-medium mb-1.5">イベント名</p>
                  <p className="text-lg font-bold text-white/95 leading-relaxed">
                    {courseData.name}
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#c9a96e]/20 to-transparent" />

                {/* 開催地 */}
                <div>
                  <p className="text-xs text-[#c9a96e] tracking-[0.15em] font-medium mb-1.5">開催地</p>
                  {eventLocation ? (
                    <>
                      <a
                        href={getGoogleMapsUrl(eventLocation)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-[#c9a96e] hover:text-[#d4b87a] transition-colors leading-relaxed"
                      >
                        {eventLocation}
                      </a>
                      {eventLocationDetail && (
                        <p className="text-sm text-white/50 mt-1">
                          （{eventLocationDetail}）
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-base text-white/40">未定</p>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#c9a96e]/20 to-transparent" />

                {/* 概要 */}
                <div>
                  <p className="text-xs text-[#c9a96e] tracking-[0.15em] font-medium mb-1.5">概要</p>
                  <p className="text-base text-white/75 leading-relaxed whitespace-pre-wrap">
                    {invitationSettings?.eventDescription || '─'}
                  </p>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-[#c9a96e]/20 to-transparent" />

                {/* 備考・注意喚起 */}
                <div>
                  <p className="text-xs text-[#c9a96e] tracking-[0.15em] font-medium mb-1.5">備考・注意喚起</p>
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                    {invitationSettings?.eventNotes || '─'}
                  </p>
                </div>
              </div>

              {/* Ornamental footer */}
              <div className="text-center mt-7">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9a96e]/60" />
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2Z" fill="#c9a96e" />
                  </svg>
                  <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9a96e]/60" />
                </div>
              </div>
            </div>

            {/* Gold bottom line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent" />
          </div>
        </motion.div>

        {/* ═══════ Form Section ═══════ */}
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
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#0f1629] flex items-center justify-center">
                      <Calendar className="h-3.5 w-3.5 text-[#c9a96e]" />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-800 tracking-wide">
                      ご希望の日時 <span className="text-red-500 text-xs">*</span>
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#0f1629] flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-[#c9a96e]" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-800 tracking-wide">
                    ご参加者情報
                  </h2>
                </div>

                <FormField
                  control={form.control}
                  name="respondentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 text-xs font-medium tracking-wide">
                        お名前 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="例: 田中太郎"
                          className="border-slate-200 bg-slate-50/50 focus:border-[#c9a96e]/50 focus:ring-[#c9a96e]/10 rounded-lg h-11"
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
                      <FormLabel className="text-slate-700 text-xs font-medium tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-[#c9a96e]" />
                          メールアドレス
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="example@email.com"
                          className="border-slate-200 bg-slate-50/50 focus:border-[#c9a96e]/50 focus:ring-[#c9a96e]/10 rounded-lg h-11"
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
                      <FormLabel className="text-slate-700 text-xs font-medium tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-[#c9a96e]" />
                          電話番号
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="090-1234-5678"
                          className="border-slate-200 bg-slate-50/50 focus:border-[#c9a96e]/50 focus:ring-[#c9a96e]/10 rounded-lg h-11"
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
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
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
                className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2.5"
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
                className="w-full h-13 bg-gradient-to-r from-[#0f1629] to-[#1a2744] hover:from-[#1a2744] hover:to-[#253556] text-[#c9a96e] font-bold text-base rounded-xl shadow-lg shadow-[#0f1629]/30 hover:shadow-[#0f1629]/40 transition-all duration-300 border border-[#c9a96e]/30 tracking-wide"
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

            {/* Footer branding */}
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
                <span className="text-[11px] font-medium text-slate-400">ざせきくん</span>
              </div>
              <p className="text-[10px] text-slate-300 tracking-wider">
                Powered by ざせきくん
              </p>
            </motion.div>
          </form>
        </Form>
      </main>
    </div>
  );
}
