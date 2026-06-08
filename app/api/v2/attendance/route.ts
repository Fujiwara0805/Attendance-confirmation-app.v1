// /api/v2/attendance - Supabase版 出席登録API
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// デバイスフィンガープリント生成。
// クライアントが永続デバイストークンを送ってきた場合はそれを使う（端末ごとに一意）。
// これにより、同一グローバルIP＋同一UAの参加者が大量にいても衝突せず、クールダウンの誤判定を防ぐ。
// トークンが無い古いクライアントのみ従来どおり IP + User-Agent にフォールバックする。
function generateDeviceFingerprint(req: NextRequest, deviceToken?: string | null): string {
  const token = typeof deviceToken === 'string' ? deviceToken.trim() : '';
  if (token) {
    return crypto.createHash('sha256').update(`token:${token}`).digest('hex').substring(0, 32);
  }
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').substring(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseCode,    // QRコードから取得した講義コード
      courseId,      // 講義ID（直接指定の場合）
      student_id,
      name,
      grade,
      department,
      feedback,
      latitude,
      longitude,
      deviceToken,   // 端末ごとに永続化したトークン（クールダウン判定用）
      customFields = {},  // カスタムフィールドのデータ {fieldName: value}
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ message: 'Location data is required' }, { status: 400 });
    }

    if (!courseCode && !courseId) {
      return NextResponse.json({ message: 'courseCode or courseId is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 講義を特定
    let course: any;
    if (courseCode) {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, location_settings, status, cooldown_minutes')
        .eq('code', courseCode)
        .single();
      if (error || !data) {
        return NextResponse.json({ message: 'Course not found' }, { status: 404 });
      }
      course = data;
    } else {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, location_settings, status, cooldown_minutes')
        .eq('id', courseId)
        .single();
      if (error || !data) {
        return NextResponse.json({ message: 'Course not found' }, { status: 404 });
      }
      course = data;
    }

    if (course.status !== 'active') {
      return NextResponse.json({ message: 'This course is no longer active' }, { status: 400 });
    }

    // クールダウンチェック（サーバーサイド）- 講義ごとの cooldown_minutes を使用
    const cooldownMinutes = Number.isFinite(course.cooldown_minutes)
      ? Math.max(0, Math.min(1440, Number(course.cooldown_minutes)))
      : 15;
    const deviceFingerprint = generateDeviceFingerprint(req, deviceToken);
    if (cooldownMinutes > 0) {
      const { data: cooldownOk } = await supabase.rpc('check_cooldown', {
        p_course_id: course.id,
        p_device_fingerprint: deviceFingerprint,
        p_cooldown_minutes: cooldownMinutes
      });

      if (cooldownOk === false) {
        return NextResponse.json({
          message: `同一端末からの出席登録は${cooldownMinutes}分間隔を空ける必要があります。`,
          error: 'Cooldown active'
        }, { status: 429 });
      }
    }

    // 位置情報の検証
    let isOnCampus = true;
    if (course.location_settings) {
      const settings = course.location_settings;
      const distance = calculateDistance(
        latitude, longitude,
        settings.latitude, settings.longitude
      );
      isOnCampus = distance <= settings.radius;
    }

    // customFieldsからデフォルトフィールド相当の値をフォールバック取得（NOT NULL制約対応: 空文字列をデフォルトに）
    const resolvedStudentId = student_id || customFields?.student_id || '';
    const resolvedName = name || customFields?.name || '';
    const rawGrade = grade ?? customFields?.grade;
    const resolvedDepartment = department || customFields?.department || '';
    const resolvedFeedback = feedback || customFields?.feedback || '';

    // 学年は半角/全角・"年"接尾辞・前後空白を許容して堅牢に整数化
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
    const resolvedGrade = parseGrade(rawGrade);

    if (rawGrade !== undefined && rawGrade !== null && String(rawGrade).trim() !== '' && resolvedGrade === null) {
      console.warn('[attendance] 不正な grade 値を受信したため null として保存します:', rawGrade);
    }

    // 出席データ挿入
    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .insert({
        course_id: course.id,
        student_id: resolvedStudentId,
        student_name: resolvedName,
        grade: resolvedGrade,
        department: resolvedDepartment,
        feedback: resolvedFeedback,
        custom_data: customFields,
        latitude,
        longitude,
        is_on_campus: isOnCampus,
        attended_at: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting attendance:', insertError);
      return NextResponse.json({ message: 'Failed to record attendance', error: insertError.message }, { status: 500 });
    }

    // クールダウン記録を更新/挿入
    await supabase
      .from('submission_cooldowns')
      .upsert({
        course_id: course.id,
        device_fingerprint: deviceFingerprint,
        submitted_at: new Date().toISOString()
      }, {
        onConflict: 'course_id,device_fingerprint'
      });

    return NextResponse.json({
      message: 'Attendance recorded successfully!',
      attendanceId: attendance.id,
      courseName: course.name,
      isOnCampus,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in attendance API:', error);
    return NextResponse.json({
      message: 'Failed to process attendance',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Haversine公式で距離計算
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
