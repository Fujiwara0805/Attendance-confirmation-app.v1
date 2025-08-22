'use client';

import { useState } from 'react';
import { FormField } from '@/app/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, GripVertical, Plus, X } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';

interface FormFieldEditorProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export default function FormFieldEditor({ fields, onChange }: FormFieldEditorProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  // 項目を追加
  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      name: `field_${Date.now()}`,
      label: '新しい項目',
      type: 'text',
      required: false,
      order: fields.length + 1,
      placeholder: ''
    };
    onChange([...fields, newField]);
    setEditingField(newField.id);
  };

  // 項目を削除
  const removeField = (fieldId: string) => {
    onChange(fields.filter(field => field.id !== fieldId));
  };

  // 項目を更新
  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    onChange(fields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  // 並び替え
  const handleReorder = (newFields: FormField[]) => {
    const reorderedFields = newFields.map((field, index) => ({
      ...field,
      order: index + 1
    }));
    onChange(reorderedFields);
  };

  // 選択肢を追加
  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newOptions = [...(field.options || []), '新しい選択肢'];
      updateField(fieldId, { options: newOptions });
    }
  };

  // 選択肢を削除
  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      const newOptions = field.options.filter((_, index) => index !== optionIndex);
      updateField(fieldId, { options: newOptions });
    }
  };

  // 選択肢を更新
  const updateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && field.options) {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      updateField(fieldId, { options: newOptions });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">フォーム項目設定</h3>
        <Button onClick={addField} size="sm" className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          項目を追加
        </Button>
      </div>

      <Reorder.Group
        axis="y"
        values={fields}
        onReorder={handleReorder}
        className="space-y-3"
      >
        {fields.map((field) => (
          <Reorder.Item key={field.id} value={field}>
            <Card className="cursor-move">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <CardTitle className="text-sm">{field.label}</CardTitle>
                    <Badge variant={field.required ? "default" : "secondary"}>
                      {field.required ? "必須" : "任意"}
                    </Badge>
                    <Badge variant="outline">{field.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField(editingField === field.id ? null : field.id)}
                    >
                      {editingField === field.id ? '完了' : '編集'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {editingField === field.id && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>項目名</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder="項目名を入力"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>フィールド名</Label>
                      <Input
                        value={field.name}
                        onChange={(e) => updateField(field.id, { name: e.target.value })}
                        placeholder="field_name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>項目タイプ</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: FormField['type']) => updateField(field.id, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">テキスト</SelectItem>
                          <SelectItem value="textarea">テキストエリア</SelectItem>
                          <SelectItem value="select">セレクト</SelectItem>
                          <SelectItem value="date">日付</SelectItem>
                          <SelectItem value="number">数値</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>プレースホルダー</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="例: 名前を入力してください"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                    />
                    <Label>必須項目にする</Label>
                  </div>

                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>選択肢</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(field.id)}
                        >
                          選択肢を追加
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {field.options?.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(field.id, index, e.target.value)}
                              placeholder="選択肢を入力"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(field.id, index)}
                              className="text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(field.type === 'text' || field.type === 'textarea') && (
                    <div className="space-y-4">
                      <Label>バリデーション設定</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm">最小文字数</Label>
                          <Input
                            type="number"
                            value={field.validation?.minLength || ''}
                            onChange={(e) => updateField(field.id, {
                              validation: {
                                ...field.validation,
                                minLength: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">最大文字数</Label>
                          <Input
                            type="number"
                            value={field.validation?.maxLength || ''}
                            onChange={(e) => updateField(field.id, {
                              validation: {
                                ...field.validation,
                                maxLength: e.target.value ? parseInt(e.target.value) : undefined
                              }
                            })}
                            placeholder="無制限"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {fields.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>フォーム項目がありません</p>
          <Button onClick={addField} className="mt-2">
            最初の項目を追加
          </Button>
        </div>
      )}
    </div>
  );
}
