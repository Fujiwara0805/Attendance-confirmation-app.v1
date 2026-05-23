'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { CustomModal } from '@/components/ui/custom-modal';
import { ChevronLeft, ChevronRight, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomFormField } from '@/app/types';
import {
  createDefaultValues,
  createDynamicSchema,
  defaultFields,
  normalizeDefaultFields,
  type DefaultFieldEntry,
} from '@/lib/dynamicFormUtils';
import DynamicFormField from '@/app/attendance/components/DynamicFormField';

interface ManualAttendanceCourse {
  id: string;
  code: string;
  courseName: string;
  teacherName: string;
  customFields?: CustomFormField[] | any[];
  enabledDefaultFields?: DefaultFieldEntry[];
}

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: ManualAttendanceCourse | null;
}

type EntryValues = Record<string, unknown>;

export default function ManualAttendanceModal({
  isOpen,
  onClose,
  course,
}: ManualAttendanceModalProps) {
  const customFields: CustomFormField[] = useMemo(
    () => (Array.isArray(course?.customFields) ? (course?.customFields as CustomFormField[]) : []),
    [course?.customFields]
  );
  const enabledDefaultFields: DefaultFieldEntry[] = useMemo(() => {
    const raw = course?.enabledDefaultFields;
    if (Array.isArray(raw) && raw.length > 0) return raw as DefaultFieldEntry[];
    return ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'];
  }, [course?.enabledDefaultFields]);

  const dynamicSchema = useMemo(
    () => createDynamicSchema(customFields, enabledDefaultFields),
    [customFields, enabledDefaultFields]
  );

  const buildEmptyEntry = useCallback((): EntryValues => {
    const values = createDefaultValues(customFields, enabledDefaultFields) as EntryValues;
    if (course?.courseName) values.class_name = course.courseName;
    if (!values.date) values.date = new Date().toISOString().split('T')[0];
    return values;
  }, [customFields, enabledDefaultFields, course?.courseName]);

  const form = useForm({
    resolver: zodResolver(dynamicSchema),
    defaultValues: buildEmptyEntry(),
    mode: 'onChange',
  });

  const [entries, setEntries] = useState<EntryValues[]>([buildEmptyEntry()]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = buildEmptyEntry();
      setEntries([initial]);
      setCurrentIndex(0);
      setDirection(1);
      form.reset(initial);
    }
  }, [isOpen, buildEmptyEntry, form]);

  const allFields: CustomFormField[] = useMemo(() => {
    const normalizedDefaults = normalizeDefaultFields(enabledDefaultFields);
    const enabledKeySet = new Set(normalizedDefaults.map((d) => d.key));
    const requiredMap = new Map(normalizedDefaults.map((d) => [d.key, d.required]));

    return [
      ...defaultFields
        .filter((field) => enabledKeySet.has(field.key))
        .map((field, index) => ({
          id: field.key,
          name: field.key,
          label: field.label,
          type: field.type,
          required: requiredMap.get(field.key) ?? true,
          placeholder: '',
          description: '',
          options: [],
          order: index,
        })),
      ...customFields.sort((a, b) => (a.order || 0) - (b.order || 0)),
    ];
  }, [customFields, enabledDefaultFields]);

  const fieldPairs = useMemo(() => {
    const pairs: CustomFormField[][] = [];
    for (let i = 0; i < allFields.length; i += 2) {
      pairs.push(allFields.slice(i, i + 2));
    }
    return pairs;
  }, [allFields]);

  const commitCurrent = useCallback(
    (values: EntryValues) => {
      setEntries((prev) => {
        const next = [...prev];
        next[currentIndex] = values;
        return next;
      });
    },
    [currentIndex]
  );

  const goTo = useCallback(
    (nextIndex: number, currentValues: EntryValues) => {
      commitCurrent(currentValues);
      setDirection(nextIndex > currentIndex ? 1 : -1);
      setCurrentIndex(nextIndex);
      const target = entries[nextIndex] ?? buildEmptyEntry();
      form.reset(target);
    },
    [commitCurrent, currentIndex, entries, form, buildEmptyEntry]
  );

  const handleAddEntry = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('入力中の項目を確認してから追加してください');
      return;
    }
    const currentValues = form.getValues() as EntryValues;
    const fresh = buildEmptyEntry();
    setEntries((prev) => {
      const next = [...prev];
      next[currentIndex] = currentValues;
      next.push(fresh);
      return next;
    });
    setDirection(1);
    setCurrentIndex((idx) => idx + 1);
    form.reset(fresh);
  }, [buildEmptyEntry, currentIndex, form]);

  const handleRemoveEntry = useCallback(() => {
    if (entries.length <= 1) return;
    setEntries((prev) => {
      const next = prev.filter((_, i) => i !== currentIndex);
      const nextIndex = Math.max(0, currentIndex - 1);
      form.reset(next[nextIndex]);
      setDirection(-1);
      setCurrentIndex(nextIndex);
      return next;
    });
  }, [currentIndex, entries.length, form]);

  const handlePrev = useCallback(async () => {
    if (currentIndex === 0) return;
    const isValid = await form.trigger();
    if (!isValid) {
      const proceed = window.confirm(
        '入力中の項目に不備があります。このまま前のページに移動しますか？（編集中の内容は保持されます）'
      );
      if (!proceed) return;
    }
    goTo(currentIndex - 1, form.getValues() as EntryValues);
  }, [currentIndex, form, goTo]);

  const handleNext = useCallback(async () => {
    if (currentIndex >= entries.length - 1) return;
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('入力中の項目を確認してから移動してください');
      return;
    }
    goTo(currentIndex + 1, form.getValues() as EntryValues);
  }, [currentIndex, entries.length, form, goTo]);

  const handleSubmit = useCallback(async () => {
    if (!course) return;
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('未入力の項目があります');
      return;
    }
    const currentValues = form.getValues() as EntryValues;
    const finalEntries = entries.map((entry, i) => (i === currentIndex ? currentValues : entry));

    setSubmitting(true);
    try {
      const payload = {
        courseCode: course.code,
        courseId: course.id,
        entries: finalEntries.map((values) => {
          const customData: Record<string, unknown> = {};
          customFields.forEach((field) => {
            if (values[field.name] !== undefined) {
              customData[field.name] = values[field.name];
            }
          });
          return {
            attended_at: (values.date as string) || new Date().toISOString().split('T')[0],
            student_id: (values.student_id as string) || '',
            name: (values.name as string) || '',
            grade:
              values.grade === undefined || values.grade === null ? '' : String(values.grade),
            department: (values.department as string) || '',
            feedback: (values.feedback as string) || '',
            customFields: customData,
          };
        }),
      };

      const response = await fetch('/api/v2/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || '手動入力の保存に失敗しました');
      }

      const insertedCount = body?.insertedCount ?? finalEntries.length;
      toast.success(`${insertedCount}件の出席データを登録しました`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '手動入力の保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }, [course, currentIndex, customFields, entries, form, onClose]);

  const totalEntries = entries.length;

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={course ? `手動入力: ${course.courseName}` : '手動入力'}
      description="電波の関係でフォーム送信できなかった学生の出席データを手動で登録します。位置情報・クーリングタイムは適用されません。「追加」で複数件をまとめて登録できます。"
      className="sm:max-w-[600px]"
    >
      <div className="space-y-4">
        {/* Pager */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0 || submitting}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-indigo-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="前のページ"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              {currentIndex + 1} / {totalEntries} 件目
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= totalEntries - 1 || submitting}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-indigo-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="次のページ"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRemoveEntry}
              disabled={totalEntries <= 1 || submitting}
              className="h-8 inline-flex items-center gap-1 rounded-md px-2 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="このページを削除"
            >
              <Trash2 className="h-3.5 w-3.5" />
              このページを削除
            </button>
            <button
              type="button"
              onClick={handleAddEntry}
              disabled={submitting}
              className="h-8 inline-flex items-center gap-1 rounded-md px-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors disabled:opacity-50"
              aria-label="新しいページを追加"
            >
              <Plus className="h-3.5 w-3.5" />
              追加
            </button>
          </div>
        </div>

        {/* Form pages with slide animation */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              initial={{ x: direction === 1 ? 60 : -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction === 1 ? -60 : 60, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
            >
              <Form {...form}>
                <form className="space-y-4">
                  {allFields.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">
                      入力可能な項目がありません
                    </p>
                  ) : (
                    fieldPairs.map((pair, pairIndex) => (
                      <div
                        key={pairIndex}
                        className={`grid grid-cols-1 ${
                          pair.length === 2 &&
                          pair[0].type !== 'textarea' &&
                          pair[1]?.type !== 'textarea'
                            ? 'md:grid-cols-2'
                            : ''
                        } gap-4`}
                      >
                        {pair.map((field) => (
                          <div
                            key={field.name}
                            className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                          >
                            <DynamicFormField
                              control={form.control}
                              field={field}
                              isClassNameField={field.name === 'class_name'}
                              targetCourse={
                                course
                                  ? {
                                      id: course.id,
                                      courseName: course.courseName,
                                      teacherName: course.teacherName,
                                    }
                                  : null
                              }
                              loadingCourses={false}
                            />
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </form>
              </Form>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="h-10 sm:w-auto"
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-10 sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                登録中...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Save className="h-4 w-4" />
                {totalEntries}件登録
              </span>
            )}
          </Button>
        </div>
      </div>
    </CustomModal>
  );
}
