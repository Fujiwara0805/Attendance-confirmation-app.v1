import { z } from 'zod';
import { CustomFormField, CustomFieldType } from '@/app/types';

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
        defaultValues[field.name] = field.defaultValue === 'true' || field.defaultValue === 'true';
        break;
      default:
        defaultValues[field.name] = '';
    }
  });

  return defaultValues;
}

// フィールドタイプの日本語ラベル
export const fieldTypeLabels: Record<CustomFieldType, string> = {
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
  { key: 'date', label: '日付', type: 'date' as CustomFieldType },
  { key: 'class_name', label: '講義名', type: 'select' as CustomFieldType },
  { key: 'student_id', label: '学籍番号', type: 'text' as CustomFieldType },
  { key: 'grade', label: '学年', type: 'select' as CustomFieldType },
  { key: 'name', label: '名前', type: 'text' as CustomFieldType },
  { key: 'department', label: '学科・コース', type: 'text' as CustomFieldType },
  { key: 'feedback', label: '講義レポート', type: 'textarea' as CustomFieldType }
];

// プリセットフィールド定義（ユーザーが選択して追加できる汎用項目）
export interface PresetField {
  id: string;
  name: string;
  label: string;
  type: CustomFieldType;
  description: string;
  category: 'basic' | 'contact' | 'survey' | 'event';
  icon: string; // lucide icon name
  placeholder?: string;
  options?: string[];
  required: boolean;
}

export const presetFields: PresetField[] = [
  // 基本情報カテゴリ
  {
    id: 'preset_email',
    name: 'email',
    label: 'メールアドレス',
    type: 'text',
    description: '連絡先メールアドレス',
    category: 'basic',
    icon: 'Mail',
    placeholder: 'example@email.com',
    required: false,
  },
  {
    id: 'preset_phone',
    name: 'phone',
    label: '電話番号',
    type: 'text',
    description: '連絡先電話番号',
    category: 'basic',
    icon: 'Phone',
    placeholder: '090-1234-5678',
    required: false,
  },
  {
    id: 'preset_affiliation',
    name: 'affiliation',
    label: '所属',
    type: 'text',
    description: '所属組織・団体名',
    category: 'basic',
    icon: 'Building',
    placeholder: '例: 経済学部',
    required: false,
  },
  {
    id: 'preset_company',
    name: 'company',
    label: '会社名・団体名',
    type: 'text',
    description: '勤務先・所属団体',
    category: 'basic',
    icon: 'Briefcase',
    placeholder: '例: 株式会社○○',
    required: false,
  },
  // 連絡先・属性カテゴリ
  {
    id: 'preset_age_range',
    name: 'age_range',
    label: '年齢層',
    type: 'select',
    description: '回答者の年齢層',
    category: 'contact',
    icon: 'Users',
    options: ['10代', '20代', '30代', '40代', '50代', '60代以上'],
    required: false,
  },
  {
    id: 'preset_gender',
    name: 'gender',
    label: '性別',
    type: 'radio',
    description: '性別を選択',
    category: 'contact',
    icon: 'UserCircle',
    options: ['男性', '女性', 'その他', '回答しない'],
    required: false,
  },
  {
    id: 'preset_experience',
    name: 'experience_level',
    label: '経験レベル',
    type: 'radio',
    description: 'テーマに対する経験度',
    category: 'contact',
    icon: 'Award',
    options: ['初心者', '中級者', '上級者'],
    required: false,
  },
  // アンケートカテゴリ
  {
    id: 'preset_satisfaction',
    name: 'satisfaction',
    label: '満足度',
    type: 'radio',
    description: '5段階の満足度評価',
    category: 'survey',
    icon: 'Star',
    options: ['1 - 不満', '2 - やや不満', '3 - 普通', '4 - 満足', '5 - とても満足'],
    required: false,
  },
  {
    id: 'preset_purpose',
    name: 'purpose',
    label: '参加目的',
    type: 'select',
    description: '参加の動機・目的',
    category: 'survey',
    icon: 'Target',
    options: ['学習', '業務', '興味・関心', 'スキルアップ', 'その他'],
    required: false,
  },
  {
    id: 'preset_referral',
    name: 'referral_source',
    label: '参加経緯',
    type: 'select',
    description: 'イベントを知ったきっかけ',
    category: 'survey',
    icon: 'Share2',
    options: ['SNS', '友人・知人', 'ウェブサイト', 'チラシ・ポスター', '教員の紹介', 'その他'],
    required: false,
  },
  {
    id: 'preset_questions',
    name: 'questions_for_speaker',
    label: '質問事項',
    type: 'textarea',
    description: '講師・発表者への質問',
    category: 'survey',
    icon: 'HelpCircle',
    placeholder: '質問があればご記入ください',
    required: false,
  },
  {
    id: 'preset_improvement',
    name: 'improvement_suggestion',
    label: '改善提案',
    type: 'textarea',
    description: '改善点やリクエスト',
    category: 'survey',
    icon: 'Lightbulb',
    placeholder: '改善点があればご記入ください',
    required: false,
  },
  // イベント・その他カテゴリ
  {
    id: 'preset_dietary',
    name: 'dietary_restrictions',
    label: '食事制限・アレルギー',
    type: 'text',
    description: '対面イベント用の食事配慮',
    category: 'event',
    icon: 'UtensilsCrossed',
    placeholder: '例: 卵アレルギー',
    required: false,
  },
  {
    id: 'preset_accessibility',
    name: 'accessibility_needs',
    label: '配慮事項',
    type: 'textarea',
    description: 'バリアフリー等の配慮',
    category: 'event',
    icon: 'Accessibility',
    placeholder: '必要な配慮があればご記入ください',
    required: false,
  },
  {
    id: 'preset_free_comment',
    name: 'free_comment',
    label: '自由記述',
    type: 'textarea',
    description: '自由に記述できるフィールド',
    category: 'survey',
    icon: 'MessageSquare',
    placeholder: 'ご自由にご記入ください',
    required: false,
  },
];

// カテゴリの日本語ラベル
export const presetCategoryLabels: Record<string, string> = {
  basic: '基本情報',
  contact: '属性',
  survey: 'アンケート',
  event: 'イベント',
};

// プリセットフィールドをCustomFormFieldに変換
export function presetToCustomField(preset: PresetField, order: number): CustomFormField {
  return {
    id: `custom_${preset.name}_${Date.now()}`,
    name: preset.name,
    label: preset.label,
    type: preset.type,
    required: preset.required,
    placeholder: preset.placeholder,
    description: preset.description,
    options: preset.options,
    order,
  };
}
