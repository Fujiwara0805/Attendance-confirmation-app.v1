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

export interface Course {
  id: string;
  courseName: string;
  teacherName: string;
  locationSettings?: {
    latitude: number;
    longitude: number;
    radius: number; // km
    locationName?: string;
  };
}

export interface GlobalSettings {
  // ... existing settings ...
  defaultLocationSettings: {
    latitude: number;
    longitude: number;
    radius: number;
    locationName?: string;
  };
}

// カスタムフォーム設定用の型定義を追加
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox';

export interface CustomFormField {
  id: string;
  name: string; // フィールド名（英語、内部用）
  label: string; // 表示ラベル（日本語）
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  options?: string[]; // select, radio, checkbox用
  defaultValue?: string;
  order: number; // 表示順序
}

export interface CustomFormTemplate {
  id: string;
  name: string; // テンプレート名
  description?: string;
  fields: CustomFormField[];
  isDefault: boolean; // デフォルトテンプレートかどうか
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseFormConfig {
  courseId: string;
  templateId?: string; // 使用するテンプレートID
  customFields: CustomFormField[]; // 講義固有のカスタムフィールド
  enabledDefaultFields: (string | { key: string; required: boolean })[]; // 有効化されたデフォルトフィールドのリスト
}

// 招待状フォーム関連の型定義
export type FormType = 'attendance' | 'invitation';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  capacity?: number;
}

export interface DateSlot {
  id: string;
  date: string;
  label: string;
  timeSlots: TimeSlot[];
}

export interface InvitationSettings {
  eventLocation?: string;
  eventLocationDetail?: string;
  eventDescription?: string;
  eventNotes?: string;
  dateSlots: DateSlot[];
}

export interface InvitationResponse {
  id: string;
  courseId: string;
  responseCode: string;
  respondentName: string;
  respondentEmail?: string;
  respondentPhone?: string;
  customData: Record<string, any>;
  selectedDate: string;
  selectedTimeSlotId: string;
  selectedTimeLabel?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  createdAt: string;
}