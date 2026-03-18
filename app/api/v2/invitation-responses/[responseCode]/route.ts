// /api/v2/invitation-responses/[responseCode] - 個別回答の取得
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET: 個別回答取得（チェックインページ用・公開）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ responseCode: string }> }
) {
  try {
    const { responseCode } = await params;
    const supabase = createServerClient();

    const { data: response, error } = await supabase
      .from('invitation_responses')
      .select(`
        id, response_code, respondent_name, respondent_email,
        selected_date, selected_time_slot_id, selected_time_label,
        checked_in_at, checked_in_by, custom_data, created_at,
        course_id
      `)
      .eq('response_code', responseCode)
      .single();

    if (error || !response) {
      return NextResponse.json({ message: 'Response not found' }, { status: 404 });
    }

    // コース名も取得
    const { data: course } = await supabase
      .from('courses')
      .select('name, invitation_settings')
      .eq('id', response.course_id)
      .single();

    return NextResponse.json({
      response,
      courseName: course?.name || '',
      invitationSettings: course?.invitation_settings || null,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching invitation response:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
