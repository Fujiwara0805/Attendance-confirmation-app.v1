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
  Settings
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
      title: '成功',
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
      title: '成功',
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
        title: '成功',
        description: 'デフォルトフィールドを無効化しました',
      });
    } else {
      // カスタムフィールドの場合は削除
      setAllFields(prev => prev.filter(field => field.id !== fieldId));
      toast({
        title: '成功',
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
        title: '成功',
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
        title: 'エラー',
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
        title: '成功',
        description: 'フォーム設定を保存しました',
      });

    } catch (error) {
      console.error('Error saving form config:', error);
      toast({
        title: 'エラー',
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
      <Card className="border-indigo-200">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-indigo-800">フォームフィールド管理</CardTitle>
              <CardDescription className="text-indigo-600">
                デフォルトフィールドの編集・削除と、カスタムフィールドの追加・並び替えができます
              </CardDescription>
            </div>
            <Dialog open={isFieldDialogOpen} onOpenChange={setIsFieldDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  フィールド追加
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingField ? 'フィールドを編集' : '新しいフィールドを追加'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={fieldForm.handleSubmit(editingField ? handleUpdateField : handleAddField)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">フィールド名</Label>
                      <Input 
                        {...fieldForm.register('name')} 
                        placeholder="field_name" 
                        disabled={editingField?.isDefault} // デフォルトフィールドの場合は無効化
                      />
                      {fieldForm.formState.errors.name && (
                        <p className="text-sm text-red-500">{fieldForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="label">表示ラベル</Label>
                      <Input {...fieldForm.register('label')} placeholder="フィールドラベル" />
                      {fieldForm.formState.errors.label && (
                        <p className="text-sm text-red-500">{fieldForm.formState.errors.label.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="type">フィールドタイプ</Label>
                    <Select onValueChange={handleFieldTypeChange} defaultValue={fieldForm.watch('type')}>
                      <SelectTrigger>
                        <SelectValue placeholder="フィールドタイプを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(fieldTypeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="placeholder">プレースホルダー</Label>
                    <Input {...fieldForm.register('placeholder')} placeholder="入力例を表示" />
                  </div>

                  <div>
                    <Label htmlFor="description">説明</Label>
                    <Textarea {...fieldForm.register('description')} placeholder="フィールドの説明" />
                  </div>

                  {/* セレクト・ラジオボタン用のオプション設定 */}
                  {(fieldForm.watch('type') === 'select' || fieldForm.watch('type') === 'radio') && (
                    <div>
                      <Label>選択肢</Label>
                      <div className="space-y-2">
                        {fieldOptions.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`選択肢 ${index + 1}`}
                              className="flex-1"
                            />
                            {fieldOptions.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeOption(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addOption}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          選択肢を追加
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <input type="checkbox" {...fieldForm.register('required')} />
                    <Label>必須項目にする</Label>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      キャンセル
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                      {editingField ? '更新' : '追加'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* 有効なフィールド */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">有効なフィールド</h3>
              <Badge variant="secondary">{enabledFields.length}個</Badge>
            </div>
            
            {enabledFields.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">有効なフィールドがありません</p>
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
                      className={`flex items-center justify-between p-4 border-2 rounded-lg transition-all duration-200 hover:shadow-md ${
                        field.isDefault 
                          ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50' 
                          : 'border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex flex-col space-y-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            className="h-6 w-6 p-0"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(index, Math.min(enabledFields.length - 1, index + 1))}
                            disabled={index === enabledFields.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <GripVertical className="h-5 w-5 text-gray-400" />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          field.isDefault ? 'bg-indigo-100' : 'bg-purple-100'
                        }`}>
                          {React.createElement(fieldTypeIcons[field.type as keyof typeof fieldTypeIcons], { 
                            size: 18, 
                            className: field.isDefault ? "text-indigo-600" : "text-purple-600"
                          })}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{field.label}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className={field.isDefault ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}>
                              {fieldTypeLabels[field.type]}
                            </Badge>
                            <Badge variant={field.isDefault ? 'default' : 'outline'}>
                              {field.isDefault ? 'デフォルト' : 'カスタム'}
                            </Badge>
                            {field.required && <Badge variant="destructive">必須</Badge>}
                            {field.options && field.options.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {field.options.length}個の選択肢
                              </Badge>
                            )}
                          </div>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditField(field)}
                          className={field.isDefault ? "text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100" : "text-purple-600 hover:text-purple-800 hover:bg-purple-100"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteField(field.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100"
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
                  <h3 className="text-lg font-medium text-gray-500">無効なフィールド</h3>
                  <Badge variant="outline">{disabledFields.length}個</Badge>
                </div>
                <div className="space-y-2">
                  {disabledFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 opacity-60"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                          {React.createElement(fieldTypeIcons[field.type as keyof typeof fieldTypeIcons], { 
                            size: 16, 
                            className: "text-gray-400"
                          })}
                        </div>
                        <div>
                          <p className="font-medium text-gray-600">{field.label}</p>
                          <Badge variant="outline" className="text-xs">無効</Badge>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleFieldEnabled(field.id)}
                        className="text-green-600 hover:text-green-800 hover:bg-green-100"
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

      {/* 講義作成フォーム */}
      <Card className="border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="text-green-800">カスタムフォーム付き講義を追加</CardTitle>
          <CardDescription className="text-green-600">
            上記で設定したフォーム構成を使用する講義を作成します
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={courseForm.handleSubmit(handleAddCustomCourse)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courseName">講義名 *</Label>
              <Input
                {...courseForm.register('courseName')}
                placeholder="例: カスタム経済学1"
                className="border-green-200 focus:border-green-400"
              />
              {courseForm.formState.errors.courseName && (
                <p className="text-sm text-red-500">{courseForm.formState.errors.courseName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacherName">担当教員名 *</Label>
              <Input
                {...courseForm.register('teacherName')}
                placeholder="例: 田中太郎"
                className="border-green-200 focus:border-green-400"
              />
              {courseForm.formState.errors.teacherName && (
                <p className="text-sm text-red-500">{courseForm.formState.errors.teacherName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="spreadsheetId">スプレッドシートID *</Label>
              <Input
                {...courseForm.register('spreadsheetId')}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="border-green-200 focus:border-green-400"
              />
              {courseForm.formState.errors.spreadsheetId && (
                <p className="text-sm text-red-500">{courseForm.formState.errors.spreadsheetId.message}</p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                type="submit" 
                disabled={savingCourse || enabledFields.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {savingCourse ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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

      {/* フォーム設定保存 */}
      <Card className="border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="text-blue-800">フォーム設定を保存</CardTitle>
          <CardDescription className="text-blue-600">
            現在のフォーム構成をテンプレートとして保存できます
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveFormConfig}
              disabled={loading || enabledFields.length === 0}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
    </div>
  );
}
