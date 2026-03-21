'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  FileText,
  ArrowUp,
  ArrowDown,
  GripVertical,
  X,
  Check,
  MessageSquare,
} from 'lucide-react';
import type { CustomFormField, DateSlot, TimeSlot, InvitationSettings } from '@/app/types';
import { presetFields, presetCategoryLabels, presetToCustomField, type PresetField } from '@/lib/dynamicFormUtils';

// プリセットフィールドのアイコンマッピング（CustomFormManagerと同じ）
import {
  Mail, Phone, Building, Briefcase, Users, UserCircle, Award, Star,
  Target, Share2, HelpCircle, Lightbulb, UtensilsCrossed, Accessibility,
} from 'lucide-react';

const presetIconMap: Record<string, React.ComponentType<{ className?: string; size?: string | number }>> = {
  Mail, Phone, Building, Briefcase, Users, UserCircle, Award, Star,
  Target, Share2, HelpCircle, Lightbulb, UtensilsCrossed, Accessibility, MessageSquare, MapPin,
};

const invitationSchema = z.object({
  eventName: z.string().min(1, 'イベント名は必須です'),
  teacherName: z.string().min(1, '担当者名は必須です'),
  eventLocation: z.string().optional(),
  eventLocationDetail: z.string().optional(),
  eventDescription: z.string().optional(),
  eventNotes: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface EditingInvitationData {
  code: string;
  eventName: string;
  teacherName: string;
  invitationSettings?: InvitationSettings;
  customFields?: CustomFormField[];
}

interface InvitationFormManagerProps {
  onCourseAdded?: () => void;
  onClose?: () => void;
  editingInvitation?: EditingInvitationData;
}

export default function InvitationFormManager({ onCourseAdded, onClose, editingInvitation }: InvitationFormManagerProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // 日時スロット
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([]);
  const [newDate, setNewDate] = useState('');

  // カスタムフィールド
  const [customFields, setCustomFields] = useState<CustomFormField[]>([]);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Place API (Google Places Autocomplete)
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{ description: string; place_id: string }>>([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const placeSearchDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      eventName: '',
      teacherName: '',
      eventLocation: '',
      eventLocationDetail: '',
      eventDescription: '',
      eventNotes: '',
    },
  });

  const fetchPlaceSuggestions = React.useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2) {
      setPlaceSuggestions([]);
      setShowPlaceSuggestions(false);
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
        setShowPlaceSuggestions(true);
      } else {
        setPlaceSuggestions([]);
        setShowPlaceSuggestions(false);
      }
    } catch { setPlaceSuggestions([]); }
  }, []);

  const selectPlace = React.useCallback(async (placeId: string, description: string) => {
    setShowPlaceSuggestions(false);
    form.setValue('eventLocation', description);
  }, [form]);

  const handleLocationInputChange = (value: string) => {
    form.setValue('eventLocation', value);
    if (placeSearchDebounceRef.current) clearTimeout(placeSearchDebounceRef.current);
    placeSearchDebounceRef.current = setTimeout(() => fetchPlaceSuggestions(value), 300);
  };

  // 編集時の初期化
  useEffect(() => {
    if (editingInvitation) {
      form.setValue('eventName', editingInvitation.eventName);
      form.setValue('teacherName', editingInvitation.teacherName);
      if (editingInvitation.invitationSettings) {
        form.setValue('eventLocation', editingInvitation.invitationSettings.eventLocation || '');
        form.setValue('eventLocationDetail', editingInvitation.invitationSettings.eventLocationDetail || '');
        form.setValue('eventDescription', editingInvitation.invitationSettings.eventDescription || '');
        form.setValue('eventNotes', editingInvitation.invitationSettings.eventNotes || '');
        setDateSlots(editingInvitation.invitationSettings.dateSlots || []);
      }
      if (editingInvitation.customFields) {
        setCustomFields(editingInvitation.customFields);
      }
    }
  }, [editingInvitation]); // eslint-disable-line react-hooks/exhaustive-deps

  // 日付スロット追加
  const addDateSlot = () => {
    if (!newDate) return;
    const existing = dateSlots.find(d => d.date === newDate);
    if (existing) {
      toast({ title: 'この日付は既に追加されています', variant: 'destructive' });
      return;
    }

    const d = new Date(newDate + 'T00:00:00');
    const label = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });

    setDateSlots(prev => [...prev, {
      id: `date_${Date.now()}`,
      date: newDate,
      label,
      timeSlots: [],
    }]);
    setNewDate('');
  };

  // 日付スロット削除
  const removeDateSlot = (dateId: string) => {
    setDateSlots(prev => prev.filter(d => d.id !== dateId));
  };

  // 時間帯追加
  const addTimeSlot = (dateId: string) => {
    setDateSlots(prev => prev.map(d => {
      if (d.id !== dateId) return d;
      const newSlot: TimeSlot = {
        id: `time_${Date.now()}`,
        startTime: '10:00',
        endTime: '12:00',
        label: '10:00 - 12:00',
      };
      return { ...d, timeSlots: [...d.timeSlots, newSlot] };
    }));
  };

  // 時間帯更新
  const updateTimeSlot = (dateId: string, slotId: string, field: 'startTime' | 'endTime', value: string) => {
    setDateSlots(prev => prev.map(d => {
      if (d.id !== dateId) return d;
      return {
        ...d,
        timeSlots: d.timeSlots.map(s => {
          if (s.id !== slotId) return s;
          const updated = { ...s, [field]: value };
          updated.label = `${updated.startTime} - ${updated.endTime}`;
          return updated;
        }),
      };
    }));
  };

  // 時間帯削除
  const removeTimeSlot = (dateId: string, slotId: string) => {
    setDateSlots(prev => prev.map(d => {
      if (d.id !== dateId) return d;
      return { ...d, timeSlots: d.timeSlots.filter(s => s.id !== slotId) };
    }));
  };

  // プリセットフィールド追加
  const isPresetAdded = (preset: PresetField) => customFields.some(f => f.name === preset.name);

  const addPresetField = (preset: PresetField) => {
    if (isPresetAdded(preset)) return;
    const field = presetToCustomField(preset, customFields.length);
    setCustomFields(prev => [...prev, field]);
    toast({ title: '追加しました', description: `「${preset.label}」をフォームに追加しました` });
  };

  // カスタムフィールド削除
  const removeCustomField = (fieldId: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== fieldId));
  };

  // カスタムフィールド並び替え
  const moveCustomField = (fromIndex: number, toIndex: number) => {
    const newFields = [...customFields];
    const [moved] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, moved);
    setCustomFields(newFields.map((f, i) => ({ ...f, order: i })));
  };

  // 必須切り替え
  const toggleRequired = (fieldId: string) => {
    setCustomFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, required: !f.required } : f
    ));
  };

  // フィルタされたプリセット
  const filteredPresets = selectedCategory === 'all'
    ? presetFields
    : presetFields.filter(p => p.category === selectedCategory);

  // 保存
  const handleSave = async (data: InvitationFormData) => {
    if (dateSlots.length === 0) {
      toast({ title: '日時を追加してください', description: '少なくとも1つの開催日時を設定してください', variant: 'destructive' });
      return;
    }

    const hasTimeSlots = dateSlots.some(d => d.timeSlots.length > 0);
    if (!hasTimeSlots) {
      toast({ title: '時間帯を追加してください', description: '各日付に少なくとも1つの時間帯を設定してください', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const invitationSettings: InvitationSettings = {
        eventLocation: data.eventLocation || undefined,
        eventLocationDetail: data.eventLocationDetail || undefined,
        eventDescription: data.eventDescription || undefined,
        eventNotes: data.eventNotes || undefined,
        dateSlots,
      };

      let response: Response;

      if (editingInvitation) {
        response = await fetch(`/api/v2/courses/${editingInvitation.code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.eventName.trim(),
            teacher_name: data.teacherName.trim(),
            invitation_settings: invitationSettings,
            custom_fields: customFields,
            enabled_default_fields: [],
          }),
        });
      } else {
        response = await fetch('/api/v2/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.eventName.trim(),
            teacherName: data.teacherName.trim(),
            formType: 'invitation',
            invitationSettings,
            customFields,
            enabledDefaultFields: [],
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '保存に失敗しました');
      }

      toast({
        title: editingInvitation ? '更新しました' : '作成しました',
        description: editingInvitation ? '招待状フォームを更新しました' : '招待状フォームを作成しました',
      });

      onCourseAdded?.();
      onClose?.();
    } catch (error) {
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '保存に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* イベント情報 */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">イベント情報</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">イベント名 *</Label>
            <Input
              {...form.register('eventName')}
              placeholder="例: テクノロジーカンファレンス 2026"
              className="h-9 text-sm"
            />
            {form.formState.errors.eventName && (
              <p className="text-xs text-red-500">{form.formState.errors.eventName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">担当者名 *</Label>
            <Input
              {...form.register('teacherName')}
              placeholder="例: 田中太郎"
              className="h-9 text-sm"
            />
            {form.formState.errors.teacherName && (
              <p className="text-xs text-red-500">{form.formState.errors.teacherName.message}</p>
            )}
          </div>

          <div className="space-y-1.5 relative">
            <Label className="text-xs font-medium text-slate-600">開催場所</Label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={form.watch('eventLocation') || ''}
                onChange={(e) => handleLocationInputChange(e.target.value)}
                onFocus={() => { if (placeSuggestions.length > 0) setShowPlaceSuggestions(true); }}
                onBlur={() => setTimeout(() => setShowPlaceSuggestions(false), 200)}
                placeholder="例: 大分大学 講堂"
                className="h-9 text-sm pl-8"
              />
            </div>
            {showPlaceSuggestions && placeSuggestions.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                {placeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.place_id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPlace(suggestion.place_id, suggestion.description)}
                  >
                    <MapPin className="h-3 w-3 inline mr-1.5 text-slate-400" />
                    {suggestion.description}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">場所の詳細</Label>
            <Input
              {...form.register('eventLocationDetail')}
              placeholder="３階・講演会場"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">イベント概要</Label>
            <Textarea
              {...form.register('eventDescription')}
              placeholder="イベントの説明を入力してください"
              className="text-sm resize-none"
              rows={7}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">備考・注意事項</Label>
            <Textarea
              {...form.register('eventNotes')}
              placeholder="参加者へのお知らせや注意事項を入力してください"
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 日時設定 */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              開催日時
            </CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">
              {dateSlots.length}日
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* 日付追加 */}
          <div className="flex gap-2 mb-4">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 text-sm flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addDateSlot}
              disabled={!newDate}
              className="h-9 px-3 text-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              追加
            </Button>
          </div>

          {/* 日付一覧 */}
          <div className="space-y-3">
            <AnimatePresence>
              {dateSlots.map((dateSlot) => (
                <motion.div
                  key={dateSlot.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* 日付ヘッダー */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">{dateSlot.label}</span>
                      <span className="text-xs text-slate-400">({dateSlot.date})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => addTimeSlot(dateSlot.id)}
                        className="p-1 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                        title="時間帯を追加"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDateSlot(dateSlot.id)}
                        className="p-1 rounded text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 時間帯一覧 */}
                  {dateSlot.timeSlots.length > 0 && (
                    <div className="px-3 py-2 space-y-2">
                      {dateSlot.timeSlots.map((timeSlot) => (
                        <div key={timeSlot.id} className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                          <Input
                            type="time"
                            value={timeSlot.startTime}
                            onChange={(e) => updateTimeSlot(dateSlot.id, timeSlot.id, 'startTime', e.target.value)}
                            className="h-7 text-xs w-24"
                          />
                          <span className="text-xs text-slate-400">〜</span>
                          <Input
                            type="time"
                            value={timeSlot.endTime}
                            onChange={(e) => updateTimeSlot(dateSlot.id, timeSlot.id, 'endTime', e.target.value)}
                            className="h-7 text-xs w-24"
                          />
                          <button
                            type="button"
                            onClick={() => removeTimeSlot(dateSlot.id, timeSlot.id)}
                            className="p-0.5 rounded text-red-400 hover:text-red-600 transition-colors ml-auto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {dateSlot.timeSlots.length === 0 && (
                    <div className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => addTimeSlot(dateSlot.id)}
                        className="w-full py-2 text-xs text-slate-400 border border-dashed border-slate-200 rounded-md hover:text-indigo-500 hover:border-indigo-200 transition-colors"
                      >
                        <Plus className="h-3 w-3 inline mr-1" />
                        時間帯を追加
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {dateSlots.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">
                開催日を追加してください
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* カスタムフィールド */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">追加フォーム項目</CardTitle>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs">
              {customFields.length}項目
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            氏名・メール・電話番号は標準で含まれます。追加の項目を設定できます。
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {/* 追加済みフィールド一覧 */}
          <div className="space-y-1.5">
            <AnimatePresence>
              {customFields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-1.5 h-11 px-2 rounded-md border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                >
                  <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">{field.label}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveCustomField(index, Math.max(0, index - 1))}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-colors"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCustomField(index, Math.min(customFields.length - 1, index + 1))}
                      disabled={index === customFields.length - 1}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-colors"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <select
                    value={field.required ? 'required' : 'optional'}
                    onChange={(e) => {
                      if ((e.target.value === 'required') !== field.required) toggleRequired(field.id);
                    }}
                    className={`text-[10px] font-medium h-6 px-1 pr-4 rounded border appearance-none bg-no-repeat bg-[right_2px_center] bg-[length:10px] cursor-pointer outline-none transition-colors ${
                      field.required ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="required">必須</option>
                    <option value="optional">任意</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCustomField(field.id)}
                    className="p-0.5 rounded text-red-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

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
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                      selectedCategory === 'all' ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
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
                        selectedCategory === key ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
                          isAdded ? 'border-emerald-200 bg-emerald-50/50 cursor-default' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-sm active:scale-[0.98]'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAdded ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                          {isAdded ? <Check className="h-4 w-4 text-emerald-600" /> : <IconComponent className="h-4 w-4 text-slate-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isAdded ? 'text-emerald-700' : 'text-slate-700'}`}>{preset.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{preset.description}</p>
                        </div>
                        {!isAdded && <Plus className="h-4 w-4 text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 保存ボタン */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} className="h-9 w-full sm:w-auto">
            キャンセル
          </Button>
        )}
        <Button
          type="button"
          onClick={form.handleSubmit(handleSave)}
          disabled={saving}
          className="h-9 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              {editingInvitation ? '更新中...' : '作成中...'}
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {editingInvitation ? '招待フォームを更新' : '招待フォームを作成'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
