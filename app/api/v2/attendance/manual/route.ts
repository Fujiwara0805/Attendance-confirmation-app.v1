// /api/v2/attendance/manual - 管理者による出席データ手動入力API（位置情報・クーリングタイムをスキップ。単件・一括登録対応）
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

interface ManualEntryInput {
  attended_at?: string;
  student_id?: string;
  name?: string;
  grade?: unknown;
  department?: string;
  feedback?: string;
  customFields?: Record<string, unknown>;
}

const parseGrade = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .normalize('NFKC')
    .replace(/[^\d-]/g, '')
    .trim();
  if (!normalized) return null;
  const n = Number.parseInt(normalized, 10);
  return Number.isFinite(n) ? n : null;
};

const resolveAttendedDate = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
};

const buildAttendanceRow = (
  courseId: string,
  entry: ManualEntryInput,
  enteredBy: string
) => {
  const customFields = entry.customFields ?? {};
  const resolvedStudentId = entry.student_id || (customFields as any)?.student_id || '';
  const resolvedName = entry.name || (customFields as any)?.name || '';
  const rawGrade = entry.grade ?? (customFields as any)?.grade;
  const resolvedDepartment = entry.department || (customFields as any)?.department || '';
  const resolvedFeedback = entry.feedback || (customFields as any)?.feedback || '';

  return {
    course_id: courseId,
    student_id: resolvedStudentId,
    student_name: resolvedName,
    grade: parseGrade(rawGrade),
    department: resolvedDepartment,
    feedback: resolvedFeedback,
    custom_data: { ...customFields, _manual_entry_by: enteredBy },
    latitude: null,
    longitude: null,
    is_on_campus: true,
    attended_at: resolveAttendedDate(entry.attended_at),
  };
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { courseCode, courseId, entries } = body as {
      courseCode?: string;
      courseId?: string;
      entries?: ManualEntryInput[];
    };

    const entryList: ManualEntryInput[] = Array.isArray(entries)
      ? entries
      : [
          {
            attended_at: body.attended_at,
            student_id: body.student_id,
            name: body.name,
            grade: body.grade,
            department: body.department,
            feedback: body.feedback,
            customFields: body.customFields ?? {},
          },
        ];

    if (entryList.length === 0) {
      return NextResponse.json({ message: '登録する出席データがありません' }, { status: 400 });
    }
    if (entryList.length > 100) {
      return NextResponse.json({ message: '一度に登録できるのは100件までです' }, { status: 400 });
    }

    if (!courseCode && !courseId) {
      return NextResponse.json({ message: 'courseCode or courseId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const courseQuery = supabase
      .from('courses')
      .select('id, name, teacher_email, status');
    const { data: course, error: courseError } = courseCode
      ? await courseQuery.eq('code', courseCode).single()
      : await courseQuery.eq('id', courseId).single();

    if (courseError || !course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    if (course.teacher_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const rows = entryList.map((entry) => buildAttendanceRow(course.id, entry, user.email!));

    const { data: inserted, error: insertError } = await supabase
      .from('attendance')
      .insert(rows)
      .select('id');

    if (insertError) {
      console.error('Error inserting manual attendance:', insertError);
      return NextResponse.json(
        { message: 'Failed to record attendance', error: insertError.message },
        { status: 500 }
      );
    }

    const insertedCount = inserted?.length ?? rows.length;

    return NextResponse.json(
      {
        message: `${insertedCount}件の出席データを手動入力で保存しました`,
        insertedCount,
        attendanceIds: inserted?.map((row) => row.id) ?? [],
        courseName: course.name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in manual attendance API:', error);
    return NextResponse.json(
      {
        message: 'Failed to process manual attendance',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
