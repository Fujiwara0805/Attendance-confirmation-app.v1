-- 招待状フォームシステム用マイグレーション
-- 1a. coursesテーブルにform_typeとinvitation_settingsカラム追加
ALTER TABLE courses ADD COLUMN IF NOT EXISTS form_type TEXT NOT NULL DEFAULT 'attendance'
  CHECK (form_type IN ('attendance', 'invitation'));
ALTER TABLE courses ADD COLUMN IF NOT EXISTS invitation_settings JSONB DEFAULT NULL;

-- 1b. invitation_responsesテーブル新規作成
CREATE TABLE IF NOT EXISTS invitation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  response_code TEXT NOT NULL UNIQUE,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  respondent_phone TEXT,
  custom_data JSONB DEFAULT '{}',
  selected_date TEXT NOT NULL,
  selected_time_slot_id TEXT NOT NULL,
  selected_time_label TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NULL,
  checked_in_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitation_responses_course_id ON invitation_responses(course_id);
CREATE INDEX IF NOT EXISTS idx_invitation_responses_response_code ON invitation_responses(response_code);

-- 1c. generate_response_code RPC関数作成
CREATE OR REPLACE FUNCTION generate_response_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
