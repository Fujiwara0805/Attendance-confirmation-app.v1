import { z } from 'zod';
import { CustomFormField, CustomFieldType } from '@/app/types';

/** enabled_default_fields の要素（後方互換: string | { key, required }） */
export type DefaultFieldEntry = string | { key: string; required: boolean };

/** enabled_default_fields を正規化して { key, required } の配列に変換 */
export function normalizeDefaultFields(entries: DefaultFieldEntry[]): { key: string; required: boolean }[] {
  return entries.map(entry =>
    typeof entry === 'string' ? { key: entry, required: true } : entry
  );
}

/** デフォルトフィールドのバリデーションメッセージ */
const defaultFieldMessages: Record<string, string> = {
  date: '日付を入力してください',
  student_id: 'ID・番号（学籍番号など）を入力してください',
  grade: '学年を選択してください',
  name: '名前を入力してください',
  department: '所属（学科・コース等）を入力してください',
  feedback: 'レポート・感想を入力してください',
};

// 動的Zodスキーマ生成
export function createDynamicSchema(fields: CustomFormField[], enabledDefaultFields: DefaultFieldEntry[] = []) {
  const schemaObject: Record<string, z.ZodTypeAny> = {};

  // デフォルトフィールドの追加（required 状態を反映）
  const normalized = normalizeDefaultFields(enabledDefaultFields);
  for (const { key, required } of normalized) {
    if (key === 'class_name') {
      schemaObject.class_name = z.string().optional();
    } else {
      schemaObject[key] = required
        ? z.string().min(1, { message: defaultFieldMessages[key] || `${key}を入力してください` })
        : z.string().optional();
    }
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
export function createDefaultValues(fields: CustomFormField[], enabledDefaultFields: DefaultFieldEntry[] = []) {
  const defaultValues: Record<string, any> = {};

  // デフォルトフィールドの初期値
  const normalized = normalizeDefaultFields(enabledDefaultFields);
  const enabledKeys = new Set(normalized.map(n => n.key));

  if (enabledKeys.has('date')) {
    defaultValues.date = new Date().toISOString().split('T')[0];
  }
  if (enabledKeys.has('class_name')) {
    defaultValues.class_name = '';
  }
  if (enabledKeys.has('student_id')) {
    defaultValues.student_id = '';
  }
  if (enabledKeys.has('grade')) {
    defaultValues.grade = '';
  }
  if (enabledKeys.has('name')) {
    defaultValues.name = '';
  }
  if (enabledKeys.has('department')) {
    defaultValues.department = '';
  }
  if (enabledKeys.has('feedback')) {
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
  { key: 'class_name', label: 'フォーム名', type: 'select' as CustomFieldType },
  { key: 'student_id', label: 'ID・番号（学籍番号など）', type: 'text' as CustomFieldType },
  { key: 'grade', label: '学年', type: 'text' as CustomFieldType },
  { key: 'name', label: '名前', type: 'text' as CustomFieldType },
  { key: 'department', label: '所属（学科・コース等）', type: 'text' as CustomFieldType },
  { key: 'feedback', label: 'レポート・感想', type: 'textarea' as CustomFieldType }
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
  // 招待フォーム向けプリセット
  {
    id: 'preset_reception_party',
    name: 'reception_party',
    label: '懇親会有無',
    type: 'radio',
    description: '懇親会への参加有無',
    category: 'event',
    icon: 'UtensilsCrossed',
    options: ['参加する', '参加しない'],
    required: false,
  },
  {
    id: 'preset_region',
    name: 'region',
    label: '地域/エリア',
    type: 'select',
    description: '都道府県・市町村を選択',
    category: 'basic',
    icon: 'MapPin',
    placeholder: '都道府県を選択してください',
    options: [
      '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
      '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
      '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
      '岐阜県', '静岡県', '愛知県', '三重県',
      '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
      '鳥取県', '島根県', '岡山県', '広島県', '山口県',
      '徳島県', '香川県', '愛媛県', '高知県',
      '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
    ],
    required: false,
  },
  {
    id: 'preset_pricing_plan',
    name: 'pricing_plan',
    label: '料金プラン',
    type: 'select',
    description: '料金プランの選択',
    category: 'event',
    icon: 'Star',
    options: ['一般 - ¥5,000', '学生 - ¥3,000', 'VIP - ¥10,000', '早期割引 - ¥4,000', '団体割引 - ¥3,500'],
    required: false,
  },
  {
    id: 'preset_payment_method',
    name: 'payment_method',
    label: '支払い方法',
    type: 'select',
    description: '支払い方法の選択',
    category: 'event',
    icon: 'Briefcase',
    options: ['現金', 'クレジットカード', '銀行振込', 'その他'],
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
