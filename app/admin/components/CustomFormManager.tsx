'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Save,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  RadioIcon,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Users,
  UserCircle,
  Award,
  Star,
  Target,
  Share2,
  HelpCircle,
  Lightbulb,
  UtensilsCrossed,
  Accessibility,
  MessageSquare,
  Check,
  X,
} from 'lucide-react';
import type { CustomFormField } from '@/app/types';
import { defaultFields, fieldTypeLabels, presetFields, presetCategoryLabels, presetToCustomField, type PresetField } from '@/lib/dynamicFormUtils';

// 講義作成用のスキーマ
const courseSchema = z.object({
  courseName: z.string().min(1, '講義名は必須です'),
  teacherName: z.string().min(1, '担当教員名は必須です'),
});

type CourseFormData = z.infer<typeof courseSchema>;

// 統合フィールド型
interface UnifiedFormField extends CustomFormField {
  isDefault: boolean;
  originalKey?: string;
  isEnabled: boolean;
}

// プリセットフィールドのアイコンマッピング
const presetIconMap: Record<string, React.ComponentType<{ className?: string; size?: string | number }>> = {
  Mail, Phone, Building, Briefcase, Users, UserCircle, Award, Star,
  Target, Share2, HelpCircle, Lightbulb, UtensilsCrossed, Accessibility, MessageSquare,
};

// フィールドタイプのアイコンマッピング
const fieldTypeIcons: Record<string, React.ComponentType<{ className?: string; size?: string | number }>> = {
  text: Type,
  textarea: FileText,
  number: Hash,
  date: Calendar,
  select: List,
  radio: RadioIcon,
  checkbox: CheckSquare,
};

interface CustomFormManagerProps {
  onCourseAdded?: () => void;
  onClose?: () => void;
}

export default function CustomFormManager({ onCourseAdded, onClose }: CustomFormManagerProps) {
  const { toast } = useToast();
  const [allFields, setAllFields] = useState<UnifiedFormField[]>([]);
  const [savingCourse, setSavingCourse] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // 講義作成フォーム
  const courseForm = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      courseName: '',
      teacherName: '',
    },
  });

  // 初期化時にデフォルトフィールドをセット（すべて無効状態からスタート）
  useEffect(() => {
    const initialFields: UnifiedFormField[] = defaultFields.map((field, index) => ({
      id: `default_${field.key}`,
      name: field.key,
      label: field.label,
      type: field.type,
      required: true,
      placeholder: '',
      description: '',
      options: field.key === 'grade' ? ['1', '2', '3', '4'] : [],
      order: index,
      isDefault: true,
      originalKey: field.key,
      isEnabled: false,
    }));
    setAllFields(initialFields);
  }, []);

  // フィールドの有効/無効切り替え
  const toggleFieldEnabled = (fieldId: string) => {
    setAllFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, isEnabled: !field.isEnabled } : field
      )
    );
  };

  // フィールドの並び替え
  const moveField = (fromIndex: number, toIndex: number) => {
    const enabledFields = allFields.filter(f => f.isEnabled);
    const newFields = [...enabledFields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);

    const updatedEnabledFields = newFields.map((field, index) => ({ ...field, order: index }));
    const disabledFields = allFields.filter(f => !f.isEnabled);
    setAllFields([...updatedEnabledFields, ...disabledFields]);
  };

  // プリセットフィールドが既に追加済みか
  const isPresetAdded = (preset: PresetField) => {
    return allFields.some(f => f.name === preset.name);
  };

  // プリセットフィールドを追加
  const addPresetField = (preset: PresetField) => {
    if (isPresetAdded(preset)) return;

    const enabledFields = allFields.filter(f => f.isEnabled);
    const customField = presetToCustomField(preset, enabledFields.length);

    const newField: UnifiedFormField = {
      ...customField,
      isDefault: false,
      isEnabled: true,
    };

    setAllFields(prev => [...prev, newField]);
    toast({
      title: '追加しました',
      description: `「${preset.label}」をフォームに追加しました`,
    });
  };

  // カスタムフィールドの削除
  const handleDeleteField = (fieldId: string) => {
    const field = allFields.find(f => f.id === fieldId);
    if (field?.isDefault) {
      toggleFieldEnabled(fieldId);
    } else {
      setAllFields(prev => prev.filter(f => f.id !== fieldId));
      toast({
        title: '削除しました',
        description: 'フィールドを削除しました',
      });
    }
  };

  // 必須フラグの切り替え
  const toggleRequired = (fieldId: string) => {
    setAllFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    );
  };

  // 講義作成
  const handleAddCustomCourse = async (data: CourseFormData) => {
    setSavingCourse(true);
    try {
      const enabledFields = allFields.filter(f => f.isEnabled);
      const customFields = enabledFields.filter(f => !f.isDefault);
      const enabledDefaultFields = enabledFields
        .filter(f => f.isDefault)
        .map(f => f.originalKey || f.name);

      const response = await fetch('/api/v2/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.courseName.trim(),
          teacherName: data.teacherName.trim(),
          customFields,
          enabledDefaultFields,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || '講義の追加に失敗しました');
      }

      toast({
        title: '作成しました',
        description: 'カスタムフォーム付き講義を追加しました',
      });

      courseForm.reset();

      // リセット（すべて無効状態に戻す）
      const resetFields: UnifiedFormField[] = defaultFields.map((field, index) => ({
        id: `default_${field.key}`,
        name: field.key,
        label: field.label,
        type: field.type,
        required: true,
        placeholder: '',
        description: '',
        options: field.key === 'grade' ? ['1', '2', '3', '4'] : [],
        order: index,
        isDefault: true,
        originalKey: field.key,
        isEnabled: false,
      }));
      setAllFields(resetFields);

      onCourseAdded?.();
      onClose?.();
    } catch (error) {
      console.error('Error adding custom course:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '講義の追加に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setSavingCourse(false);
    }
  };

  const enabledFields = allFields.filter(f => f.isEnabled).sort((a, b) => a.order - b.order);
  const disabledFields = allFields.filter(f => !f.isEnabled);

  // フィルタされたプリセット
  const filteredPresets = selectedCategory === 'all'
    ? presetFields
    : presetFields.filter(p => p.category === selectedCategory);

  return (
    <div className="space-y-5">
      {/* 現在のフォーム構成 */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">フォーム項目</CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">
              {enabledFields.length}項目
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            <AnimatePresence>
              {enabledFields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-1.5 h-9 px-2 rounded-md border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                >
                  {/* 並び替え */}
                  <div className="flex flex-col shrink-0 -space-y-1">
                    <button
                      type="button"
                      onClick={() => moveField(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ArrowUp className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, Math.min(enabledFields.length - 1, index + 1))}
                      disabled={index === enabledFields.length - 1}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                    >
                      <ArrowDown className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {/* 項目名 + 必須ラベル（縦並び） */}
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-slate-700 truncate leading-tight">{field.label}</span>
                    <span className={`text-[9px] leading-tight ${field.required ? 'text-red-500' : 'text-slate-400'}`}>
                      {field.required ? '必須' : '任意'}
                    </span>
                  </div>

                  {/* 必須トグル */}
                  <Switch
                    checked={field.required}
                    onCheckedChange={() => toggleRequired(field.id)}
                    className="scale-[0.65] origin-right data-[state=checked]:bg-red-500 shrink-0"
                  />

                  {/* 削除 */}
                  <button
                    type="button"
                    onClick={() => handleDeleteField(field.id)}
                    className="p-0.5 rounded text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    {field.isDefault ? <X className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* 無効化したデフォルトフィールド */}
          {disabledFields.length > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1.5">追加可能な項目</p>
              <div className="flex flex-wrap gap-1">
                {disabledFields.map(field => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => toggleFieldEnabled(field.id)}
                    className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] bg-slate-50 text-slate-500 rounded border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 項目追加ボタン */}
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPresetPicker(!showPresetPicker)}
              className="w-full h-10 text-sm border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50"
            >
              <Plus className="h-4 w-4 mr-2" />
              {showPresetPicker ? '項目選択を閉じる' : '項目を追加する'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* プリセットフィールドピッカー */}
      <AnimatePresence>
        {showPresetPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-indigo-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">追加できる項目</CardTitle>
                <p className="text-xs text-slate-500 mt-1">タップして項目をフォームに追加します</p>
              </CardHeader>
              <CardContent className="pt-0">
                {/* カテゴリフィルター */}
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    すべて
                  </button>
                  {Object.entries(presetCategoryLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedCategory(key)}
                      className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                        selectedCategory === key
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* プリセット一覧 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredPresets.map(preset => {
                    const isAdded = isPresetAdded(preset);
                    const IconComponent = presetIconMap[preset.icon] || MessageSquare;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => !isAdded && addPresetField(preset)}
                        disabled={isAdded}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isAdded
                            ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-sm active:scale-[0.98]'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isAdded ? 'bg-emerald-100' : 'bg-slate-100'
                        }`}>
                          {isAdded ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <IconComponent className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isAdded ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {preset.label}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{preset.description}</p>
                        </div>
                        {!isAdded && (
                          <Plus className="h-4 w-4 text-slate-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 講義作成フォーム */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">講義情報</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={courseForm.handleSubmit(handleAddCustomCourse)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">講義名 *</Label>
              <Input
                {...courseForm.register('courseName')}
                placeholder="例: 経済学入門"
                className="h-9 text-sm"
              />
              {courseForm.formState.errors.courseName && (
                <p className="text-xs text-red-500">{courseForm.formState.errors.courseName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">担当教員名 *</Label>
              <Input
                {...courseForm.register('teacherName')}
                placeholder="例: 田中太郎"
                className="h-9 text-sm"
              />
              {courseForm.formState.errors.teacherName && (
                <p className="text-xs text-red-500">{courseForm.formState.errors.teacherName.message}</p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose} className="h-9 w-full sm:w-auto">
                  キャンセル
                </Button>
              )}
              <Button
                type="submit"
                disabled={savingCourse || enabledFields.length === 0}
                className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {savingCourse ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    作成中...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    講義を作成
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
