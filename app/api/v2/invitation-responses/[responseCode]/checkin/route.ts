// /api/v2/invitation-responses/[responseCode]/checkin - チェックイン実行
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/** イベント開始時間の何分前から受付を許可するか */
const EARLY_CHECKIN_MINUTES = 60;

/**
 * selected_time_label（例: "12:00 - 13:00"）をパースして
 * { startHour, startMin, endHour, endMin } を返す
 */
function parseTimeLabel(label: string): { startHour: number; startMin: number; endHour: number; endMin: number } | null {
  // "HH:MM - HH:MM" or "HH:MM〜HH:MM" のパターンに対応
  const match = label.match(/(\d{1,2}):(\d{2})\s*[-−–〜~]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1], 10),
    startMin: parseInt(match[2], 10),
    endHour: parseInt(match[3], 10),
    endMin: parseInt(match[4], 10),
  };
}

// PATCH: チェックイン実行
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ responseCode: string }> }
) {
  try {
    const { responseCode } = await params;
    const supabase = createServerClient();

    // 回答を取得（日付・時間情報も含める）
    const { data: existing, error: fetchError } = await supabase
      .from('invitation_responses')
      .select('id, checked_in_at, respondent_name, selected_date, selected_time_label')
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

    // ── 日付・時間帯の照合チェック ──
    const now = new Date();
    // 日本時間(JST = UTC+9)で日付を計算
    const jstOffset = 9 * 60; // minutes
    const jstDate = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
    const currentHour = jstDate.getHours();
    const currentMin = jstDate.getMinutes();

    // 1. 日付チェック: 申し込み日と当日が一致するか
    if (existing.selected_date && existing.selected_date !== todayStr) {
      return NextResponse.json({
        message: '受付可能な日付ではありません。申し込みの日付をご確認ください。',
        code: 'DATE_MISMATCH',
        selectedDate: existing.selected_date,
        selectedTimeLabel: existing.selected_time_label,
        today: todayStr,
      }, { status: 403 });
    }

    // 2. 時間帯チェック: 申し込みの時間帯内であるか
    if (existing.selected_time_label) {
      const timeRange = parseTimeLabel(existing.selected_time_label);
      if (timeRange) {
        const currentMinutes = currentHour * 60 + currentMin;
        const startMinutes = timeRange.startHour * 60 + timeRange.startMin;
        const earlyStartMinutes = Math.max(0, startMinutes - EARLY_CHECKIN_MINUTES);
        const endMinutes = timeRange.endHour * 60 + timeRange.endMin;

        if (currentMinutes < earlyStartMinutes || currentMinutes > endMinutes) {
          const earlyStartH = String(Math.floor(earlyStartMinutes / 60)).padStart(2, '0');
          const earlyStartM = String(earlyStartMinutes % 60).padStart(2, '0');
          return NextResponse.json({
            message: `受付可能な時間帯ではありません。受付時間は ${earlyStartH}:${earlyStartM} 〜 ${existing.selected_time_label.split(/[-−–〜~]/)[1]?.trim() || ''} です。`,
            code: 'TIME_MISMATCH',
            selectedDate: existing.selected_date,
            selectedTimeLabel: existing.selected_time_label,
            currentTime: `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`,
          }, { status: 403 });
        }
      }
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
