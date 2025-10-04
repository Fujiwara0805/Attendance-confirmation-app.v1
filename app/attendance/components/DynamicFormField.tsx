'use client';

import { Control, FieldValues, Path } from 'react-hook-form';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CustomFormField } from '@/app/types';

interface DynamicFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  field: CustomFormField;
  courses?: Array<{ id: string; courseName: string; teacherName: string }>;
  isClassNameField?: boolean;
  targetCourse?: { id: string; courseName: string; teacherName: string } | null;
  loadingCourses?: boolean;
}

export default function DynamicFormField<T extends FieldValues>({
  control,
  field,
  courses = [],
  isClassNameField = false,
  targetCourse = null,
  loadingCourses = false
}: DynamicFormFieldProps<T>) {
  const renderField = (fieldValue: any, onChange: (value: any) => void) => {
    switch (field.type) {
      case 'text':
        // 学籍番号フィールドの特別処理（英数字のみ許可）
        if (field.name === 'student_id') {
          return (
            <Input
              placeholder={field.placeholder || `${field.label}を入力してください`}
              className="border-indigo-200 focus:border-indigo-400"
              style={{ fontSize: '16px' }}
              pattern="[a-zA-Z0-9]*"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              value={fieldValue || ''}
              onChange={(e) => {
                // 英数字のみを許可（大文字小文字、数字）
                const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                onChange(value);
              }}
            />
          );
        }
        
        return (
          <Input
            placeholder={field.placeholder || `${field.label}を入力してください`}
            className="border-indigo-200 focus:border-indigo-400"
            style={{ fontSize: '16px' }}
            value={fieldValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder || `${field.label}を入力してください`}
            className="resize-none border-indigo-200 focus:border-indigo-400"
            style={{ 
              fontSize: '16px', 
              minHeight: 'calc(1.5em * 4 + 1rem + 32px)',
              WebkitAppearance: 'none'
            }}
            value={fieldValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder || `${field.label}を入力してください`}
            className="border-indigo-200 focus:border-indigo-400"
            style={{ fontSize: '16px' }}
            inputMode="numeric"
            pattern="[0-9]*"
            value={fieldValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            className="border-indigo-200 focus:border-indigo-300 w-full max-w-[180px] sm:max-w-[200px]"
            style={{ 
              fontSize: '16px',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield'
            }}
            value={fieldValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'select':
        // 講義名フィールドの特別処理
        if (isClassNameField) {
          return (
            <Select
              onValueChange={onChange}
              value={fieldValue || ''}
              disabled={targetCourse !== null}
            >
              <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
                <SelectValue placeholder={
                  loadingCourses ? "読み込み中..." : 
                  targetCourse ? targetCourse.courseName : field.placeholder || `${field.label}を選択してください`
                } />
              </SelectTrigger>
              <SelectContent>
                {loadingCourses ? (
                  <SelectItem value="loading" disabled>講義を読み込み中...</SelectItem>
                ) : courses.length === 0 ? (
                  <SelectItem value="no-courses" disabled>登録されている講義がありません</SelectItem>
                ) : (
                  courses.map((course) => (
                    <SelectItem key={course.id} value={course.courseName}>
                      {course.courseName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          );
        }

        // 学年フィールドの特別処理
        if (field.name === 'grade') {
          return (
            <Select onValueChange={onChange} value={fieldValue || ''}>
              <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
                <SelectValue placeholder="学年を選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1年</SelectItem>
                <SelectItem value="2">2年</SelectItem>
                <SelectItem value="3">3年</SelectItem>
                <SelectItem value="4">4年</SelectItem>
              </SelectContent>
            </Select>
          );
        }

        // 通常のセレクトフィールド
        return (
          <Select onValueChange={onChange} value={fieldValue || ''}>
            <SelectTrigger className="border-indigo-200 focus:border-indigo-400" style={{ fontSize: '16px' }}>
              <SelectValue placeholder={field.placeholder || `${field.label}を選択してください`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={fieldValue || ''} onValueChange={onChange} className="flex flex-wrap gap-4">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.name}-${option}`} />
                <Label htmlFor={`${field.name}-${option}`} className="text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={fieldValue || false}
              onCheckedChange={onChange}
            />
            <Label htmlFor={field.name} className="text-sm">
              {field.placeholder || field.label}
            </Label>
          </div>
        );

      default:
        return (
          <Input
            placeholder={field.placeholder || `${field.label}を入力してください`}
            className="border-indigo-200 focus:border-indigo-400"
            style={{ fontSize: '16px' }}
            value={fieldValue || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  return (
    <FormField
      control={control}
      name={field.name as Path<T>}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel className="text-indigo-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </FormLabel>
          <FormControl>
            {renderField(formField.value, formField.onChange)}
          </FormControl>
          {field.description && (
            <p className="text-xs text-gray-500 mt-1">{field.description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
