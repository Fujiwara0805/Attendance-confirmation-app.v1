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
  GripVertical,
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
  MapPin,
  Search,
  Navigation,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import type { CustomFormField } from '@/app/types';
import { defaultFields, fieldTypeLabels, presetFields, presetCategoryLabels, presetToCustomField, normalizeDefaultFields, type PresetField, type DefaultFieldEntry } from '@/lib/dynamicFormUtils';

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

interface EditingCourseData {
  code: string;
  courseName: string;
  teacherName: string;
  customFields?: any[];
  enabledDefaultFields?: string[];
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
}

interface CustomFormManagerProps {
  onCourseAdded?: () => void;
  onClose?: () => void;
  editingCourse?: EditingCourseData;
}

export default function CustomFormManager({ onCourseAdded, onClose, editingCourse }: CustomFormManagerProps) {
  const { toast } = useToast();
  const [allFields, setAllFields] = useState<UnifiedFormField[]>([]);
  const [savingCourse, setSavingCourse] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hasSubmissions, setHasSubmissions] = useState(false);

  // 位置情報設定
  const [enableLocation, setEnableLocation] = useState(false);
  const [locationMode, setLocationMode] = useState<'search' | 'gps'>('search');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [radius, setRadius] = useState(0.5);
  const [locationResolved, setLocationResolved] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Google Places Autocomplete
  const fetchPlaceSuggestions = React.useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.predictions?.length > 0) {
        setPlaceSuggestions(data.predictions.map((p: { description: string; place_id: string }) => ({
          description: p.description, place_id: p.place_id,
        })));
        setShowSuggestions(true);
      } else {
        setPlaceSuggestions([]);
        setShowSuggestions(false);
      }
    } catch { setPlaceSuggestions([]); }
  }, []);

  const selectPlace = React.useCallback(async (placeId: string, description: string) => {
    setShowSuggestions(false);
    setLocationError(null);
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
      if (!res.ok) throw new Error('詳細取得に失敗');
      const data = await res.json();
      if (data.result?.geometry?.location) {
        const loc = data.result.geometry.location;
        setLocationName(description);
        setLatitude(loc.lat);
        setLongitude(loc.lng);
        setLocationResolved(true);
      }
    } catch {
      setLocationError('場所の詳細取得に失敗しました。');
    }
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('このブラウザは位置情報をサポートしていません。');
      return;
    }
    setIsGettingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationName(`設定位置 (精度: ${Math.round(position.coords.accuracy)}m)`);
        setLocationResolved(true);
        setIsGettingLocation(false);
      },
      (error) => {
        setIsGettingLocation(false);
        const messages: Record<number, string> = {
          1: '位置情報の使用が拒否されました。ブラウザの設定を確認してください。',
          2: '位置情報が利用できません。',
          3: '位置情報の取得がタイムアウトしました。',
        };
        setLocationError(messages[error.code] || '位置情報の取得に失敗しました。');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 講義作成フォーム
  const courseForm = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      courseName: '',
      teacherName: '',
    },
  });

  // 編集時に出席データの存在チェック
  useEffect(() => {
    if (!editingCourse?.code) return;
    const checkSubmissions = async () => {
      try {
        const res = await fetch(`/api/v2/attendance/export?course_code=${editingCourse.code}&format=json`);
        if (!res.ok) return;
        const data = await res.json();
        setHasSubmissions((data.totalRecords || 0) > 0);
      } catch {
        // エラー時は編集を許可（安全側に倒す）
      }
    };
    checkSubmissions();
  }, [editingCourse?.code]);

  // 初期化時にデフォルトフィールドをセット
  useEffect(() => {
    const enabledDefaults = editingCourse?.enabledDefaultFields || [];
    const existingCustomFields = editingCourse?.customFields || [];

    const defaultFieldKeys = new Set(defaultFields.map(f => f.key));

    // customFieldsの中からデフォルトフィールドに該当するものを検出（新形式対応）
    const defaultFieldsInCustom = existingCustomFields.filter((cf: any) => defaultFieldKeys.has(cf.name));
    const nonDefaultCustomFields = existingCustomFields.filter((cf: any) => !defaultFieldKeys.has(cf.name));

    // 旧形式（enabledDefaultFields）の正規化
    const normalizedDefaults = normalizeDefaultFields(enabledDefaults as DefaultFieldEntry[]);
    const enabledFromOldFormat = new Set(normalizedDefaults.map(d => d.key));
    const requiredFromOldFormat = new Map(normalizedDefaults.map(d => [d.key, d.required]));

    // 新形式（customFields内のデフォルトフィールド）
    const enabledFromNewFormat = new Set(defaultFieldsInCustom.map((cf: any) => cf.name));
    const requiredFromNewFormat = new Map(defaultFieldsInCustom.map((cf: any) => [cf.name, cf.required ?? false]));

    // 両方をマージ（後方互換性を維持）
    const enabledKeysSet = new Set([...Array.from(enabledFromOldFormat), ...Array.from(enabledFromNewFormat)]);
    const requiredMap = new Map([...Array.from(requiredFromOldFormat), ...Array.from(requiredFromNewFormat)]);

    // デフォルトフィールドを初期化（編集時は有効状態・required状態を復元）
    const initialDefaultFields: UnifiedFormField[] = defaultFields.map((field, index) => ({
      id: `default_${field.key}`,
      name: field.key,
      label: field.label,
      type: field.type,
      required: requiredMap.get(field.key) ?? false,
      placeholder: '',
      description: '',
      options: field.key === 'grade' ? ['1', '2', '3', '4'] : [],
      order: index,
      isDefault: true,
      originalKey: field.key,
      isEnabled: enabledKeysSet.has(field.key),
    }));

    // 非デフォルトのカスタムフィールドのみ復元（編集時）
    const initialCustomFields: UnifiedFormField[] = nonDefaultCustomFields.map((cf: any, index: number) => ({
      id: cf.id || `custom_${Date.now()}_${index}`,
      name: cf.name,
      label: cf.label,
      type: cf.type || 'text',
      required: cf.required ?? true,
      placeholder: cf.placeholder || '',
      description: cf.description || '',
      options: cf.options || [],
      order: initialDefaultFields.filter(f => f.isEnabled).length + index,
      isDefault: false,
      isEnabled: true,
    }));

    setAllFields([...initialDefaultFields, ...initialCustomFields]);

    // 編集時はフォームと位置情報も復元
    if (editingCourse) {
      courseForm.setValue('courseName', editingCourse.courseName);
      courseForm.setValue('teacherName', editingCourse.teacherName);
      if (editingCourse.locationSettings) {
        setEnableLocation(true);
        setLocationName(editingCourse.locationSettings.locationName || '');
        setLatitude(editingCourse.locationSettings.latitude);
        setLongitude(editingCourse.locationSettings.longitude);
        setRadius(editingCourse.locationSettings.radius);
        setLocationResolved(true);
      }
    }
  }, [editingCourse]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 講義作成 / 更新
  const handleAddCustomCourse = async (data: CourseFormData) => {
    setSavingCourse(true);
    try {
      const enabledFields = allFields.filter(f => f.isEnabled);
      // すべての有効フィールドをcustomFieldsとして送信（デフォルトフィールドも含む）
      const customFields = enabledFields.map((f, index) => ({
        id: f.id,
        name: f.originalKey || f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder || '',
        description: f.description || '',
        options: f.options || [],
        order: index,
      }));
      // デフォルトフィールドもcustomFieldsに統合したため空配列を送信
      const enabledDefaultFields: any[] = [];

      const locationSettings = enableLocation ? {
        latitude,
        longitude,
        radius,
        locationName: locationName.trim() || undefined,
      } : null;

      let response: Response;

      if (editingCourse) {
        // 更新モード（PATCH）
        response = await fetch(`/api/v2/courses/${editingCourse.code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.courseName.trim(),
            teacher_name: data.teacherName.trim(),
            custom_fields: customFields,
            enabled_default_fields: enabledDefaultFields,
            location_settings: locationSettings,
          }),
        });
      } else {
        // 新規作成モード（POST）
        response = await fetch('/api/v2/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.courseName.trim(),
            teacherName: data.teacherName.trim(),
            customFields,
            enabledDefaultFields,
            locationSettings,
          }),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || (editingCourse ? 'フォームの更新に失敗しました' : '講義の追加に失敗しました'));
      }

      toast({
        title: editingCourse ? '更新しました' : '作成しました',
        description: editingCourse ? 'カスタムフォームを更新しました' : 'カスタムフォーム付き講義を追加しました',
      });

      if (!editingCourse) {
        courseForm.reset();
        setEnableLocation(false);
        setLocationName('');
        setLatitude(0);
        setLongitude(0);
        setRadius(0.5);
        setLocationResolved(false);
        setLocationError(null);

        // リセット（すべて無効状態に戻す）
        const resetFields: UnifiedFormField[] = defaultFields.map((field, index) => ({
          id: `default_${field.key}`,
          name: field.key,
          label: field.label,
          type: field.type,
          required: false,
          placeholder: '',
          description: '',
          options: field.key === 'grade' ? ['1', '2', '3', '4'] : [],
          order: index,
          isDefault: true,
          originalKey: field.key,
          isEnabled: false,
        }));
        setAllFields(resetFields);
      }

      onCourseAdded?.();
      onClose?.();
    } catch (error) {
      console.error('Error saving custom course:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : (editingCourse ? 'フォームの更新に失敗しました' : '講義の追加に失敗しました'),
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
      {/* 送信データ存在時の警告 */}
      {hasSubmissions && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            出席データが存在するため、フォーム項目の追加・削除・編集はできません。変更が必要な場合は、新しいフォームを作成してください。
          </p>
        </div>
      )}

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
                  className="flex items-center gap-1.5 h-11 px-2 rounded-md border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                >
                  {/* ドラッグハンドル */}
                  <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0 cursor-grab" />

                  {/* 項目名 */}
                  <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">{field.label}</span>

                  {/* 並び替え（上下矢印） */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveField(index, Math.max(0, index - 1))}
                      disabled={index === 0 || hasSubmissions}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(index, Math.min(enabledFields.length - 1, index + 1))}
                      disabled={index === enabledFields.length - 1 || hasSubmissions}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* 必須/任意 ドロップダウン */}
                  <select
                    value={field.required ? 'required' : 'optional'}
                    onChange={(e) => {
                      const newRequired = e.target.value === 'required';
                      if (newRequired !== field.required) toggleRequired(field.id);
                    }}
                    disabled={hasSubmissions}
                    className={`text-[10px] font-medium h-6 px-1 pr-4 rounded border appearance-none bg-no-repeat bg-[right_2px_center] bg-[length:10px] cursor-pointer outline-none transition-colors ${
                      field.required
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    } ${hasSubmissions ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="required">必須</option>
                    <option value="optional">任意</option>
                  </select>

                  {/* 削除 */}
                  <button
                    type="button"
                    onClick={() => handleDeleteField(field.id)}
                    disabled={hasSubmissions}
                    className={`p-0.5 rounded text-red-400 hover:text-red-600 transition-colors shrink-0 ${hasSubmissions ? 'opacity-20 cursor-not-allowed' : ''}`}
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
                    disabled={hasSubmissions}
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] bg-slate-50 text-slate-500 rounded border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors ${hasSubmissions ? 'opacity-50 cursor-not-allowed hover:bg-slate-50 hover:text-slate-500 hover:border-slate-200' : ''}`}
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
              disabled={hasSubmissions}
              className={`w-full h-10 text-sm border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 ${hasSubmissions ? 'opacity-50 cursor-not-allowed' : ''}`}
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

            {/* 位置情報設定トグル */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const next = !enableLocation;
                  setEnableLocation(next);
                  if (!next) {
                    setLocationResolved(false);
                    setLocationError(null);
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">位置情報制限を設定</span>
                  <span className="text-xs text-slate-400">（任意）</span>
                </div>
                {enableLocation ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {enableLocation && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 py-3 space-y-3 border-t border-slate-200"
                >
                  {/* モード切替タブ */}
                  <div className="flex rounded-lg bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => { setLocationMode('search'); setLocationResolved(false); setLocationError(null); setLocationName(''); setLatitude(0); setLongitude(0); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${locationMode === 'search' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Search className="h-3.5 w-3.5" />
                      場所を検索
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLocationMode('gps'); setLocationResolved(false); setLocationError(null); setPlaceSuggestions([]); setShowSuggestions(false); setLocationName(''); setLatitude(0); setLongitude(0); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${locationMode === 'gps' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      端末の現在地
                    </button>
                  </div>

                  {/* 場所検索モード */}
                  {locationMode === 'search' && (
                    <div className="space-y-1.5 relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="場所を検索（例: 大分大学）"
                          value={locationName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLocationName(val);
                            setLocationResolved(false);
                            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                            searchDebounceRef.current = setTimeout(() => fetchPlaceSuggestions(val), 300);
                          }}
                          onFocus={() => { if (placeSuggestions.length > 0) setShowSuggestions(true); }}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          className="h-9 text-sm pl-9"
                        />
                      </div>
                      {showSuggestions && placeSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {placeSuggestions.map((s) => (
                            <button
                              key={s.place_id}
                              type="button"
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex items-start gap-2 border-b border-slate-100 last:border-0 transition-colors"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectPlace(s.place_id, s.description)}
                            >
                              <MapPin className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                              <span className="text-slate-700">{s.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 現在地モード */}
                  {locationMode === 'gps' && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={getCurrentLocation}
                        disabled={isGettingLocation || locationResolved}
                        className="w-full h-10 text-sm border-dashed"
                      >
                        {isGettingLocation ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : locationResolved ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 mr-2" />
                        ) : (
                          <Navigation className="h-4 w-4 mr-2" />
                        )}
                        {isGettingLocation ? '位置情報を取得中...' : locationResolved ? '現在地を取得しました' : '現在地を取得する'}
                      </Button>
                      {!locationResolved && !isGettingLocation && (
                        <p className="text-xs text-slate-400 text-center">ブラウザの位置情報許可が必要です</p>
                      )}
                    </div>
                  )}

                  {/* ステータス表示 */}
                  {locationResolved && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>位置情報を設定しました{locationMode === 'search' && locationName ? `（${locationName}）` : ''}</span>
                    </div>
                  )}
                  {locationError && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{locationError}</p>
                  )}

                  {/* 許可範囲 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">許可範囲（km）</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={radius}
                      onChange={(e) => setRadius(parseFloat(e.target.value) || 0.5)}
                      className="h-9 text-sm"
                    />
                    <p className="text-xs text-slate-400">指定場所から半径{radius}km以内で出席可能</p>
                  </div>
                </motion.div>
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
                    {editingCourse ? '更新中...' : '作成中...'}
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    {editingCourse ? 'フォームを更新' : '講義を作成'}
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
