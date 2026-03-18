// /api/v2/invitation-responses/[responseCode]/checkin - チェックイン実行
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// PATCH: チェックイン実行
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ responseCode: string }> }
) {
  try {
    const { responseCode } = await params;
    const supabase = createServerClient();

    // 回答を取得
    const { data: existing, error: fetchError } = await supabase
      .from('invitation_responses')
      .select('id, checked_in_at, respondent_name')
      .eq('response_code', responseCode)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ message: 'Response not found' }, { status: 404 });
    }

    // 既にチェックイン済みの場合
    if (existing.checked_in_at) {
      return NextResponse.json({
        message: 'Already checked in',
        alreadyCheckedIn: true,
        checkedInAt: existing.checked_in_at,
        respondentName: existing.respondent_name,
      }, { status: 200 });
    }

    // チェックイン実行
    const body = await req.json().catch(() => ({}));
    const { data: updated, error: updateError } = await supabase
      .from('invitation_responses')
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: body.checkedInBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq('response_code', responseCode)
      .select('id, respondent_name, checked_in_at')
      .single();

    if (updateError) {
      console.error('Error checking in:', updateError);
      return NextResponse.json(
        { message: 'Failed to check in', error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Checked in successfully',
      alreadyCheckedIn: false,
      respondentName: updated.respondent_name,
      checkedInAt: updated.checked_in_at,
    }, { status: 200 });
  } catch (error) {
    console.error('Error in checkin API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
