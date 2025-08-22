'use client';

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  GripVertical,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  RadioIcon,
  FileText,
  Loader2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  X,
  Settings,
  AlertCircle,
  CheckCircle2,
  Info,
  BookOpen,
  User
} from 'lucide-react';
import type { CustomFormField } from '@/app/types';
import { defaultFields, fieldTypeLabels } from '@/lib/dynamicFormUtils';

// フィールド作成用のスキーマ
const fieldSchema = z.object({
  name: z.string().min(1, 'フィールド名は必須です'),
  label: z.string().min(1, 'ラベルは必須です'),
  type: z.enum(['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox']),
  required: z.boolean(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
});

// 講義作成用のスキーマ
const courseSchema = z.object({
  courseName: z.string().min(1, '講義名は必須です'),
  teacherName: z.string().min(1, '担当教員名は必須です'),
  spreadsheetId: z.string().min(1, 'スプレッドシートIDは必須です'),
});

type FieldFormData = z.infer<typeof fieldSchema>;
type CourseFormData = z.infer<typeof courseSchema>;

// 統合フィールド型（デフォルトとカスタムを統合）
interface UnifiedFormField extends CustomFormField {
  isDefault: boolean;
  originalKey?: string; // デフォルトフィールドの場合の元のキー
  isEnabled: boolean; // フィールドが有効かどうか
}

// フィールドタイプのアイコンマッピング
const fieldTypeIcons = {
  text: Type,
  textarea: FileText,
  number: Hash,
  date: Calendar,
  select: List,
  radio: RadioIcon,
  checkbox: CheckSquare
};

// フローティングラベル付き入力コンポーネント
const FloatingLabelInput = ({ 
  label, 
  error, 
  success, 
  icon: Icon, 
  required = false,
  ...props 
}: {
  label: string;
  error?: string;
  success?: boolean;
  icon?: React.ComponentType<any>;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setHasValue(e.target.value !== '');
    props.onBlur?.(e);
  };

  const isActive = isFocused || hasValue || props.value;

  return (
    <div className="floating-label-container">
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 z-10">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setHasValue(e.target.value !== '');
            props.onChange?.(e);
          }}
          className={`
            modern-input w-full
            ${Icon ? 'pl-12' : 'pl-4'}
            ${error ? 'input-error' : success ? 'input-success' : ''}
            ${isActive ? 'pt-6 pb-2' : 'py-3'}
          `}
          placeholder=""
        />
        <label 
          className={`floating-label ${isActive ? 'active' : ''} ${Icon ? 'left-12' : 'left-4'}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>
      
      {error && (
        <div className="error-message">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {success && !error && (
        <div className="text-green-600 text-sm mt-1 flex items-center">
          <CheckCircle2 className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>入力内容が正しく設定されました</span>
        </div>
      )}
    </div>
  );
};

// フローティングラベル付きテキストエリア
const FloatingLabelTextarea = ({ 
  label, 
  error, 
  icon: Icon, 
  required = false,
  ...props 
}: {
  label: string;
  error?: string;
  icon?: React.ComponentType<any>;
  required?: boolean;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    setHasValue(e.target.value !== '');
    props.onBlur?.(e);
  };

  const isActive = isFocused || hasValue || props.value;

  return (
    <div className="floating-label-container">
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-4 text-slate-400 z-10">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <textarea
          {...props}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setHasValue(e.target.value !== '');
            props.onChange?.(e);
          }}
          className={`
            modern-textarea w-full
            ${Icon ? 'pl-12' : 'pl-4'}
            ${error ? 'input-error' : ''}
            ${isActive ? 'pt-6 pb-4' : 'py-4'}
          `}
          placeholder=""
        />
        <label 
          className={`floating-label ${isActive ? 'active' : ''} ${Icon ? 'left-12' : 'left-4'}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>
      
      {error && (
        <div className="error-message">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

interface CustomFormManagerProps {
  onCourseAdded?: () => void;
  onClose?: () => void; // モーダル閉じる関数を追加
}

export default function CustomFormManager({ onCourseAdded, onClose }: CustomFormManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [allFields, setAllFields] = useState<UnifiedFormField[]>([]);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [editingField, setEditingField] = useState<UnifiedFormField | null>(null);
  const [fieldOptions, setFieldOptions] = useState<string[]>(['']);

  // フィールド作成フォーム
  const fieldForm = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      name: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      description: ''
    }
  });

  // 講義作成フォーム
  const courseForm = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      courseName: '',
      teacherName: '',
      spreadsheetId: ''
    }
  });

  // 初期化時にデフォルトフィールドを統合リストに追加
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
      isEnabled: true
    }));

    setAllFields(initialFields);
  }, []);

  // フィールドタイプが変更された時の処理
  const handleFieldTypeChange = (value: string) => {
    fieldForm.setValue('type', value as any);
    if (value === 'select' || value === 'radio') {
      setFieldOptions(['']);
    } else {
      setFieldOptions([]);
    }
  };

  // オプション追加
  const addOption = () => {
    setFieldOptions(prev => [...prev, '']);
  };

  // オプション削除
  const removeOption = (index: number) => {
    setFieldOptions(prev => prev.filter((_, i) => i !== index));
  };

  // オプション更新
  const updateOption = (index: number, value: string) => {
    setFieldOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  // フィールドの有効/無効切り替え
  const toggleFieldEnabled = (fieldId: string) => {
    setAllFields(prev => prev.map(field => 
      field.id === fieldId 
        ? { ...field, isEnabled: !field.isEnabled }
        : field
    ));
  };

  // フィールドの並び替え
  const moveField = (fromIndex: number, toIndex: number) => {
    const enabledFields = allFields.filter(f => f.isEnabled);
    const newFields = [...enabledFields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    
    // orderを再設定
    const updatedEnabledFields = newFields.map((field, index) => ({
      ...field,
      order: index
    }));

    // 無効なフィールドも含めて更新
    const disabledFields = allFields.filter(f => !f.isEnabled);
    const allUpdatedFields = [...updatedEnabledFields, ...disabledFields];
    
    setAllFields(allUpdatedFields);
  };

  // 新しいカスタムフィールドの追加
  const handleAddField = (data: FieldFormData) => {
    const validOptions = fieldOptions.filter(opt => opt.trim() !== '');
    const enabledFields = allFields.filter(f => f.isEnabled);
    
    const newField: UnifiedFormField = {
      id: `custom_${Date.now()}`,
      name: data.name,
      label: data.label,
      type: data.type,
      required: data.required,
      placeholder: data.placeholder || '',
      description: data.description || '',
      options: validOptions,
      order: enabledFields.length,
      isDefault: false,
      isEnabled: true
    };

    setAllFields(prev => [...prev, newField]);
    setIsFieldDialogOpen(false);
    fieldForm.reset();
    setFieldOptions(['']);
    
    toast({
      title: '✨ 成功',
      description: 'フィールドを追加しました',
    });
  };

  // フィールドの編集
  const handleEditField = (field: UnifiedFormField) => {
    setEditingField(field);
    fieldForm.reset({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
      description: field.description
    });
    setFieldOptions(field.options && field.options.length > 0 ? field.options : ['']);
    setIsFieldDialogOpen(true);
  };

  // フィールドの更新
  const handleUpdateField = (data: FieldFormData) => {
    if (!editingField) return;

    const validOptions = fieldOptions.filter(opt => opt.trim() !== '');
    
    const updatedField: UnifiedFormField = {
      ...editingField,
      name: editingField.isDefault ? editingField.name : data.name, // デフォルトフィールドの場合はnameを変更しない
      label: data.label,
      type: data.type,
      required: data.required,
      placeholder: data.placeholder || '',
      description: data.description || '',
      options: validOptions
    };

    setAllFields(prev => prev.map(field => 
      field.id === editingField.id ? updatedField : field
    ));
    
    setIsFieldDialogOpen(false);
    setEditingField(null);
    fieldForm.reset();
    setFieldOptions(['']);
    
    toast({
      title: '✨ 成功',
      description: 'フィールドを更新しました',
    });
  };

  // フィールドの削除
  const handleDeleteField = (fieldId: string) => {
    const field = allFields.find(f => f.id === fieldId);
    
    if (field?.isDefault) {
      // デフォルトフィールドの場合は無効化
      toggleFieldEnabled(fieldId);
      toast({
        title: '✨ 成功',
        description: 'デフォルトフィールドを無効化しました',
      });
    } else {
      // カスタムフィールドの場合は削除
      setAllFields(prev => prev.filter(field => field.id !== fieldId));
      toast({
        title: '✨ 成功',
        description: 'カスタムフィールドを削除しました',
      });
    }
  };

  // ダイアログを閉じる時の処理
  const handleCloseDialog = () => {
    setIsFieldDialogOpen(false);
    setEditingField(null);
    fieldForm.reset();
    setFieldOptions(['']);
  };

  // カスタムフォーム付き講義の追加
  const handleAddCustomCourse = async (data: CourseFormData) => {
    setSavingCourse(true);
    try {
      // 講義を追加
      const courseResponse = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: data.courseName.trim(),
          teacherName: data.teacherName.trim(),
          spreadsheetId: data.spreadsheetId.trim(),
          isCustomForm: true
        }),
      });

      if (!courseResponse.ok) {
        const errorData = await courseResponse.json();
        throw new Error(errorData.message || '講義の追加に失敗しました');
      }

      const courseData = await courseResponse.json();
      const courseId = courseData.course.id;

      // 有効なフィールドのみを抽出
      const enabledFields = allFields.filter(f => f.isEnabled);
      const customFields = enabledFields.filter(f => !f.isDefault);
      const enabledDefaultFields = enabledFields
        .filter(f => f.isDefault)
        .map(f => f.originalKey || f.name);

      // カスタムフォーム設定を保存
      const formConfigResponse = await fetch(`/api/admin/courses/${courseId}/form-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customFields,
          enabledDefaultFields
        }),
      });

      if (!formConfigResponse.ok) {
        throw new Error('フォーム設定の保存に失敗しました');
      }

      toast({
        title: '🎉 成功',
        description: 'カスタムフォーム付き講義を追加しました',
      });

      // フォームをリセット
      courseForm.reset();
      
      // フィールドをデフォルト状態に戻す
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
        isEnabled: true
      }));
      setAllFields(resetFields);

      // 親コンポーネントに講義追加を通知
      if (onCourseAdded) {
        onCourseAdded();
      }

      // モーダルを閉じる
      if (onClose) {
        onClose();
      }

    } catch (error) {
      console.error('Error adding custom course:', error);
      toast({
        title: '❌ エラー',
        description: error instanceof Error ? error.message : 'カスタム講義の追加に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setSavingCourse(false);
    }
  };

  // フォーム設定のみを保存（講義追加なし）
  const handleSaveFormConfig = async () => {
    try {
      setLoading(true);
      
      // 有効なフィールドのみを抽出
      const enabledFields = allFields.filter(f => f.isEnabled);
      const customFields = enabledFields.filter(f => !f.isDefault);
      const enabledDefaultFields = enabledFields
        .filter(f => f.isDefault)
        .map(f => f.originalKey || f.name);

      // テンプレートとして保存
      const templateResponse = await fetch('/api/admin/custom-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `カスタムテンプレート_${Date.now()}`,
          description: 'カスタムフォームテンプレート',
          fields: customFields,
          enabledDefaultFields,
          isDefault: false
        }),
      });

      if (!templateResponse.ok) {
        throw new Error('フォーム設定の保存に失敗しました');
      }

      toast({
        title: '✨ 成功',
        description: 'フォーム設定を保存しました',
      });

    } catch (error) {
      console.error('Error saving form config:', error);
      toast({
        title: '❌ エラー',
        description: 'フォーム設定の保存に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 有効なフィールドを取得
  const enabledFields = allFields.filter(f => f.isEnabled).sort((a, b) => a.order - b.order);
  const disabledFields = allFields.filter(f => !f.isEnabled);

  return (
    <div className="space-y-6">
      {/* フィールド管理 */}
      <Card className="border-indigo-200 card-hover">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="text-lg sm:text-xl text-gradient">フォームフィールド管理</CardTitle>
              <CardDescription className="text-sm sm:text-base text-indigo-600 mt-2">
                デフォルトフィールドの編集・削除と、<br />カスタムフィールドの追加・並び替えができます
              </CardDescription>
            </div>
            <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
              <DialogTrigger asChild>
                <Button className="modern-button-primary w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  フィールド追加
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-auto sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                  <DialogTitle className="text-xl text-gradient flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    {editingField ? 'フィールドを編集' : '新しいフィールドを追加'}
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    フォームで使用するフィールドの詳細を設定してください
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={fieldForm.handleSubmit(editingField ? handleUpdateField : handleAddField)} className="space-y-6 form-field-enter">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FloatingLabelInput
                      {...fieldForm.register('name')}
                      label="フィールド名"
                      placeholder="field_name"
                      disabled={editingField?.isDefault}
                      error={fieldForm.formState.errors.name?.message}
                      icon={Type}
                      required
                    />
                    
                    <FloatingLabelInput
                      {...fieldForm.register('label')}
                      label="表示ラベル"
                      placeholder="フィールドラベル"
                      error={fieldForm.formState.errors.label?.message}
                      icon={FileText}
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      フィールドタイプ <span className="text-red-500">*</span>
                    </Label>
                    <Select onValueChange={handleFieldTypeChange} defaultValue={fieldForm.watch('type')}>
                      <SelectTrigger className="modern-select">
                        <SelectValue placeholder="フィールドタイプを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(fieldTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-base">
                            <div className="flex items-center space-x-2">
                              {React.createElement(fieldTypeIcons[key as keyof typeof fieldTypeIcons], { 
                                className: "h-4 w-4" 
                              })}
                              <span>{label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <FloatingLabelInput
                    {...fieldForm.register('placeholder')}
                    label="プレースホルダー"
                    placeholder="入力例を表示"
                    icon={Info}
                  />

                  <FloatingLabelTextarea
                    {...fieldForm.register('description')}
                    label="説明"
                    placeholder="フィールドの説明"
                    icon={FileText}
                    rows={3}
                  />

                  {/* セレクト・ラジオボタン用のオプション設定 */}
                  {(fieldForm.watch('type') === 'select' || fieldForm.watch('type') === 'radio') && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <Label className="text-sm font-medium text-slate-700">選択肢</Label>
                      <div className="space-y-3">
                        <AnimatePresence>
                          {fieldOptions.map((option, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="flex items-center gap-3"
                            >
                              <div className="flex-1">
                                <FloatingLabelInput
                                  value={option}
                                  onChange={(e) => updateOption(index, e.target.value)}
                                  label={`選択肢 ${index + 1}`}
                                  placeholder={`選択肢 ${index + 1}`}
                                />
                              </div>
                              {fieldOptions.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeOption(index)}
                                  className="modern-button-secondary min-h-[48px] min-w-[48px]"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addOption}
                          className="modern-button-secondary w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          選択肢を追加
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl">
                    <input 
                      type="checkbox" 
                      {...fieldForm.register('required')} 
                      className="modern-checkbox"
                    />
                    <Label className="text-sm font-medium text-slate-700">必須項目にする</Label>
                  </div>

                  <DialogFooter className="flex flex-col-reverse space-y-2 space-y-reverse sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-3 pt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleCloseDialog}
                      className="modern-button-secondary w-full sm:w-auto"
                    >
                      キャンセル
                    </Button>
                    <Button 
                      type="submit" 
                      className="modern-button-primary w-full sm:w-auto"
                    >
                      {editingField ? (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          更新
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          追加
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6">
          {/* 有効なフィールド */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">有効なフィールド</h3>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                {enabledFields.length}個
              </Badge>
            </div>
            
            {enabledFields.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-10 w-10 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">有効なフィールドがありません</p>
                <p className="text-sm text-slate-500 mt-1">「フィールド追加」ボタンから新しいフィールドを追加してください</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {enabledFields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`
                        flex flex-col sm:flex-row sm:items-center justify-between 
                        p-4 border-2 rounded-xl transition-all duration-300 
                        hover:shadow-lg hover:-translate-y-0.5 space-y-3 sm:space-y-0
                        ${field.isDefault 
                          ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50' 
                          : 'border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex flex-col space-y-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            className="h-8 w-8 p-0 hover:bg-white/50 transition-colors"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, Math.min(enabledFields.length - 1, index + 1))}
                            disabled={index === enabledFields.length - 1}
                            className="h-8 w-8 p-0 hover:bg-white/50 transition-colors"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className={`
                          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm
                          ${field.isDefault ? 'bg-indigo-100' : 'bg-purple-100'}
                        `}>
                          {React.createElement(fieldTypeIcons[field.type as keyof typeof fieldTypeIcons], { 
                            size: 20, 
                            className: field.isDefault ? "text-indigo-600" : "text-purple-600"
                          })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{field.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className={`text-xs ${field.isDefault ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                              {fieldTypeLabels[field.type]}
                            </Badge>
                            <Badge variant={field.isDefault ? 'default' : 'outline'} className="text-xs">
                              {field.isDefault ? 'デフォルト' : 'カスタム'}
                            </Badge>
                            {field.required && <Badge variant="destructive" className="text-xs">必須</Badge>}
                            {field.options && field.options.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {field.options.length}個の選択肢
                              </Badge>
                            )}
                          </div>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{field.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2 flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditField(field)}
                          className={`
                            modern-button-secondary min-h-[44px] min-w-[44px]
                            ${field.isDefault ? "text-indigo-600 hover:bg-indigo-100" : "text-purple-600 hover:bg-purple-100"}
                          `}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteField(field.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 min-h-[44px] min-w-[44px] modern-button-secondary"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* 無効なフィールド */}
            {disabledFields.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-500">無効なフィールド</h3>
                  <Badge variant="outline">{disabledFields.length}個</Badge>
                </div>
                <div className="space-y-2">
                  {disabledFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50/80 opacity-60"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                          {React.createElement(fieldTypeIcons[field.type as keyof typeof fieldTypeIcons], { 
                            size: 18, 
                            className: "text-gray-400"
                          })}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-600 text-sm truncate">{field.label}</p>
                          <Badge variant="outline" className="text-xs mt-1">無効</Badge>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleFieldEnabled(field.id)}
                        className="text-green-600 hover:text-green-800 hover:bg-green-100 modern-button-secondary flex-shrink-0"
                      >
                        有効化
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* フォーム設定保存 */}
      <Card className="border-blue-200 card-hover">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-gradient">フォーム設定を保存</CardTitle>
          <CardDescription className="text-sm sm:text-base text-blue-600 mt-1">
            現在のフォーム構成をテンプレートとして保存できます
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveFormConfig}
              disabled={loading || enabledFields.length === 0}
              variant="outline"
              className="modern-button-secondary w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  フォーム設定を保存
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 講義作成フォーム */}
      <Card className="border-green-200 card-hover">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-gradient">カスタムフォーム付き講義を追加</CardTitle>
          <CardDescription className="text-sm sm:text-base text-green-600 mt-1">
            上記で設定したフォーム構成を使用する講義を作成します
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={courseForm.handleSubmit(handleAddCustomCourse)} className="space-y-6">
            <FloatingLabelInput
              {...courseForm.register('courseName')}
              label="講義名"
              placeholder="例: カスタム経済学1"
              error={courseForm.formState.errors.courseName?.message}
              icon={BookOpen}
              required
            />

            <FloatingLabelInput
              {...courseForm.register('teacherName')}
              label="担当教員名"
              placeholder="例: 田中太郎"
              error={courseForm.formState.errors.teacherName?.message}
              icon={User}
              required
            />

            <FloatingLabelInput
              {...courseForm.register('spreadsheetId')}
              label="スプレッドシートID"
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              error={courseForm.formState.errors.spreadsheetId?.message}
              icon={FileText}
              required
            />

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={savingCourse || enabledFields.length === 0}
                className="modern-button-primary w-full sm:w-auto"
              >
                {savingCourse ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    追加中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    カスタム講義を追加
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
