import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';


export const supabase = createClient(supabaseUrl, supabaseKey);

// 出席管理に関する型定義
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

