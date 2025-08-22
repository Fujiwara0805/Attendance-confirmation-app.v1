export interface AttendanceFormData {
  studentId: string;
  name: string;
  year: string;
  department: string;
  feedback: string;
  date: string;
  lectureName: string;
  latitude: number;
  longitude: number;
}

export interface LocationBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[]; // select用
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  order: number; // 表示順序
}

export interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  spreadsheetId: string;
  defaultSheetName: string;
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
  // 新しく追加
  customFormFields?: FormField[];
  useDefaultForm?: boolean; // デフォルトフォームを使用するかどうか
}

// デフォルトフォーム項目の定義
export const DEFAULT_FORM_FIELDS: FormField[] = [
  {
    id: 'date',
    name: 'date',
    label: '日付',
    type: 'date',
    required: true,
    order: 1
  },
  {
    id: 'student_id',
    name: 'student_id',
    label: '学籍番号',
    type: 'text',
    required: true,
    placeholder: '例: A12345',
    order: 2
  },
  {
    id: 'grade',
    name: 'grade',
    label: '学年',
    type: 'select',
    required: true,
    placeholder: '学年を選択してください',
    options: ['1年', '2年', '3年', '4年'],
    order: 3
  },
  {
    id: 'name',
    name: 'name',
    label: '名前',
    type: 'text',
    required: true,
    placeholder: '例: 山田太郎',
    order: 4
  },
  {
    id: 'department',
    name: 'department',
    label: '学科・コース',
    type: 'text',
    required: true,
    placeholder: '例: 経済学部',
    order: 5
  },
  {
    id: 'feedback',
    name: 'feedback',
    label: '講義レポート',
    type: 'textarea',
    required: true,
    placeholder: '出題された問いに対してのレポートを入力してください',
    order: 6
  }
];

export interface GlobalSettings {
  // ... existing settings ...
  defaultLocationSettings: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
}