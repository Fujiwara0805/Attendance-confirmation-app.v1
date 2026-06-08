// /api/v2/invitation-responses - 招待フォーム回答の送信・一覧取得
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// POST: 招待フォーム回答を送信
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseCode,
      respondentName,
      respondentEmail,
      respondentPhone,
      customFields = {},
      selectedDate,
      selectedTimeSlotId,
      selectedTimeLabel,
    } = body;

    if (!courseCode || !respondentName || !selectedDate || !selectedTimeSlotId) {
      return NextResponse.json(
        { message: 'courseCode, respondentName, selectedDate, selectedTimeSlotId are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // コースを取得して招待フォームか確認
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, form_type, status')
      .eq('code', courseCode)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    if (course.form_type !== 'invitation') {
      return NextResponse.json({ message: 'This course is not an invitation form' }, { status: 400 });
    }

    if (course.status !== 'active') {
      return NextResponse.json({ message: 'This form is no longer active' }, { status: 400 });
    }

    // ユニークなレスポンスコードを生成して挿入する。
    // 旧実装は「コード生成 → SELECT で存在確認 → INSERT」の TOCTOU レースがあり、
    // 同時送信時に重複コード生成 → unique 制約で 500、もしくは重複コードが成立する恐れがあった。
    // ここでは DB の unique 制約を真実のソースとし、INSERT が 23505（重複）で失敗した場合のみ
    // コードを再生成してリトライする（存在確認の事前 SELECT を廃止）。
    let response: { id: string; response_code: string } | null = null;
    let lastInsertError: { code?: string; message?: string } | null = null;
    for (let attempts = 0; attempts < 10; attempts++) {
      const { data: codeData } = await supabase.rpc('generate_response_code');
      const responseCode = codeData as string;

      const { data, error: insertError } = await supabase
        .from('invitation_responses')
        .insert({
          course_id: course.id,
          response_code: responseCode,
          respondent_name: respondentName,
          respondent_email: respondentEmail || null,
          respondent_phone: respondentPhone || null,
          custom_data: customFields,
          selected_date: selectedDate,
          selected_time_slot_id: selectedTimeSlotId,
          selected_time_label: selectedTimeLabel || null,
        })
        .select('id, response_code')
        .single();

      if (!insertError) {
        response = data;
        break;
      }
      lastInsertError = insertError;
      // 23505 = unique 制約違反（コード衝突）。それ以外は即エラー返却。
      if (insertError.code !== '23505') break;
    }

    if (!response) {
      console.error('Error inserting invitation response:', lastInsertError);
      return NextResponse.json(
        { message: 'Failed to submit response', error: lastInsertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Response submitted successfully',
      responseId: response.id,
      responseCode: response.response_code,
      courseName: course.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in invitation response API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// GET: 特定コースの回答一覧（管理者用・認証必須）
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseCode = searchParams.get('courseCode');

    if (!courseCode) {
      return NextResponse.json({ message: 'courseCode is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // コースのオーナーチェック
    const { data: course } = await supabase
      .from('courses')
      .select('id, teacher_email')
      .eq('code', courseCode)
      .single();

    if (!course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    if (course.teacher_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 回答一覧を取得。PostgREST の既定行数上限による暗黙の打ち切りを避けるため、
    // range で1000件ずつ全件ページネーションする。
    const PAGE_SIZE = 1000;
    const responses: Record<string, any>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('invitation_responses')
        .select('*')
        .eq('course_id', course.id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        return NextResponse.json({ message: 'Failed to fetch responses', error: error.message }, { status: 500 });
      }
      if (!page || page.length === 0) break;
      responses.push(...(page as Record<string, any>[]));
      if (page.length < PAGE_SIZE) break;
    }

    return NextResponse.json({
      responses,
      total: responses.length,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching invitation responses:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
