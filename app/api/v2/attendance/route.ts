// /api/v2/attendance - Supabase版 出席登録API
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// デバイスフィンガープリント生成（IP + User-Agent ベース）
function generateDeviceFingerprint(req: NextRequest): string {
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
      customFields = {},  // カスタムフィールドのデータ {fieldName: value}
    } = body;

    // 必須フィールドの検証
    if (!student_id || !name) {
      return NextResponse.json({ message: 'student_id and name are required' }, { status: 400 });
    }

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
        .select('id, name, location_settings, status')
        .eq('code', courseCode)
        .single();
      if (error || !data) {
        return NextResponse.json({ message: 'Course not found' }, { status: 404 });
      }
      course = data;
    } else {
      const { data, error } = await supabase
        .from('courses')
        .select('id, name, location_settings, status')
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

    // クールダウンチェック（サーバーサイド）
    const deviceFingerprint = generateDeviceFingerprint(req);
    const { data: cooldownOk } = await supabase.rpc('check_cooldown', {
      p_course_id: course.id,
      p_device_fingerprint: deviceFingerprint,
      p_cooldown_minutes: 15
    });

    if (cooldownOk === false) {
      return NextResponse.json({
        message: '同一端末からの出席登録は15分間隔を空ける必要があります。',
        error: 'Cooldown active'
      }, { status: 429 });
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

    // 出席データ挿入
    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .insert({
        course_id: course.id,
        student_id,
        student_name: name,
        grade: grade ? parseInt(grade) : null,
        department: department || null,
        feedback: feedback || null,
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
