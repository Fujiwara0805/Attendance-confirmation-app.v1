import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 開発環境でのデバッグ情報
if (process.env.NODE_ENV !== 'production') {
  console.log('Supabase URL存在:', !!supabaseUrl);
  console.log('Supabase Key存在:', !!supabaseKey);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// 出席管理に関する型定義
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
}

export type Attendance = {
  id: string;
  user_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
  created_at: string;
}

export type Class = {
  id: string;
  name: string;
  teacher_id: string;
  schedule: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export type ClassEnrollment = {
  id: string;
  class_id: string;
  user_id: string;
  created_at: string;
} 