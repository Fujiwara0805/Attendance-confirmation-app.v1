'use client';

import { FormField as CustomFormField } from '@/app/types';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DynamicFormFieldsProps {
  formFields: CustomFormField[];
  control: any;
}

export default function DynamicFormFields({ formFields, control }: DynamicFormFieldsProps) {
  const renderField = (field: CustomFormField) => {
    switch (field.type) {
      case 'text':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={field.placeholder}
                    className="border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px' }}
                    {...formField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'textarea':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={field.placeholder}
                    className="resize-none border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px', minHeight: 'calc(1.5em * 4 + 1rem + 32px)' }}
                    {...formField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'select':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <Select
                  onValueChange={formField.onChange}
                  value={formField.value}
                >
                  <FormControl>
                    <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option, index) => (
                      <SelectItem key={index} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'date':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px' }}
                    {...formField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'number':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className="text-indigo-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={field.placeholder}
                    className="border-indigo-200 focus:border-indigo-400"
                    style={{ fontSize: '16px' }}
                    {...formField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      default:
        return null;
    }
  };

  // フィールドをorder順にソート
  const sortedFields = [...formFields].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {sortedFields.map((field, index) => {
        // 2列レイアウトの判定（テキストエリア以外で偶数個の場合）
        const isTextArea = field.type === 'textarea';
        const nextField = sortedFields[index + 1];
        const canPairWithNext = !isTextArea && nextField && nextField.type !== 'textarea';
        
        if (isTextArea) {
          // テキストエリアは単独で表示
          return (
            <div key={field.id}>
              {renderField(field)}
            </div>
          );
        } else if (canPairWithNext && index % 2 === 0) {
          // 2列レイアウト
          return (
            <div key={`${field.id}-${nextField.id}`} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField(field)}
              {renderField(nextField)}
            </div>
          );
        } else if (index > 0 && sortedFields[index - 1]?.type !== 'textarea' && index % 2 === 1) {
          // 前のフィールドと一緒に表示済み
          return null;
        } else {
          // 単独で表示
          return (
            <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField(field)}
              <div></div> {/* 空のスペース */}
            </div>
          );
        }
      })}
    </div>
  );
}
