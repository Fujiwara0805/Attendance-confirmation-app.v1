import { z } from 'zod';
import { CustomFormField, FieldType } from '@/app/types';

// 動的Zodスキーマ生成
export function createDynamicSchema(fields: CustomFormField[], enabledDefaultFields: string[] = []) {
  const schemaObject: Record<string, z.ZodTypeAny> = {};

  // デフォルトフィールドの追加
  if (enabledDefaultFields.includes('date')) {
    schemaObject.date = z.string().min(1, { message: '日付を入力してください' });
  }
  if (enabledDefaultFields.includes('class_name')) {
    schemaObject.class_name = z.string().optional();
  }
  if (enabledDefaultFields.includes('student_id')) {
    schemaObject.student_id = z.string().min(1, { message: '学籍番号を入力してください' });
  }
  if (enabledDefaultFields.includes('grade')) {
    schemaObject.grade = z.string().min(1, { message: '学年を選択してください' });
  }
  if (enabledDefaultFields.includes('name')) {
    schemaObject.name = z.string().min(1, { message: '名前を入力してください' });
  }
  if (enabledDefaultFields.includes('department')) {
    schemaObject.department = z.string().min(1, { message: '学科・コースを入力してください' });
  }
  if (enabledDefaultFields.includes('feedback')) {
    schemaObject.feedback = z.string().min(1, { message: '講義レポートを入力してください' });
  }

  // カスタムフィールドの追加
  fields.forEach((field) => {
    let zodField: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'textarea':
        zodField = field.required 
          ? z.string().min(1, { message: `${field.label}を入力してください` })
          : z.string().optional();
        break;
      
      case 'number':
        zodField = field.required
          ? z.string().min(1, { message: `${field.label}を入力してください` }).transform((val) => Number(val))
          : z.string().optional().transform((val) => val ? Number(val) : undefined);
        break;
      
      case 'date':
        zodField = field.required
          ? z.string().min(1, { message: `${field.label}を選択してください` })
          : z.string().optional();
        break;
      
      case 'select':
      case 'radio':
        zodField = field.required
          ? z.string().min(1, { message: `${field.label}を選択してください` })
          : z.string().optional();
        break;
      
      case 'checkbox':
        zodField = field.required
          ? z.boolean().refine((val) => val === true, { message: `${field.label}をチェックしてください` })
          : z.boolean().optional();
        break;
      
      default:
        zodField = z.string().optional();
    }

    schemaObject[field.name] = zodField;
  });

  return z.object(schemaObject);
}

// デフォルト値生成
export function createDefaultValues(fields: CustomFormField[], enabledDefaultFields: string[] = []) {
  const defaultValues: Record<string, any> = {};

  // デフォルトフィールドの初期値
  if (enabledDefaultFields.includes('date')) {
    defaultValues.date = new Date().toISOString().split('T')[0];
  }
  if (enabledDefaultFields.includes('class_name')) {
    defaultValues.class_name = '';
  }
  if (enabledDefaultFields.includes('student_id')) {
    defaultValues.student_id = '';
  }
  if (enabledDefaultFields.includes('grade')) {
    defaultValues.grade = '';
  }
  if (enabledDefaultFields.includes('name')) {
    defaultValues.name = '';
  }
  if (enabledDefaultFields.includes('department')) {
    defaultValues.department = '';
  }
  if (enabledDefaultFields.includes('feedback')) {
    defaultValues.feedback = '';
  }

  // カスタムフィールドの初期値
  fields.forEach((field) => {
    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'date':
      case 'select':
      case 'radio':
        defaultValues[field.name] = field.defaultValue || '';
        break;
      case 'number':
        defaultValues[field.name] = field.defaultValue || '';
        break;
      case 'checkbox':
        defaultValues[field.name] = field.defaultValue === 'true' || field.defaultValue === true;
        break;
      default:
        defaultValues[field.name] = '';
    }
  });

  return defaultValues;
}

// フィールドタイプの日本語ラベル
export const fieldTypeLabels: Record<FieldType, string> = {
  text: 'テキスト',
  textarea: 'テキストエリア',
  number: '数値',
  date: '日付',
  select: 'セレクト',
  radio: 'ラジオボタン',
  checkbox: 'チェックボックス'
};

// デフォルトフィールドの定義
export const defaultFields = [
  { key: 'date', label: '日付', type: 'date' as FieldType },
  { key: 'class_name', label: '講義名', type: 'select' as FieldType },
  { key: 'student_id', label: '学籍番号', type: 'text' as FieldType },
  { key: 'grade', label: '学年', type: 'select' as FieldType },
  { key: 'name', label: '名前', type: 'text' as FieldType },
  { key: 'department', label: '学科・コース', type: 'text' as FieldType },
  { key: 'feedback', label: '講義レポート', type: 'textarea' as FieldType }
];
