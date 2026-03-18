// /api/v2/courses - Supabase版 講義一覧・作成API
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { canCreateForm, getUserPlanInfo, PLAN_LIMITS } from '@/lib/subscription';

// GET: 講義一覧（公開 - 出席フォーム用）
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    let teacherEmail = searchParams.get('teacher_email');
    const category = searchParams.get('category');

    // "self" の場合はログインユーザーのメールを使用
    if (teacherEmail === 'self') {
      const user = await getCurrentUser();
      teacherEmail = user?.email || null;
    }

    let query = supabase
      .from('courses')
      .select('id, code, name, description, teacher_name, category, template_id, enabled_default_fields, custom_fields, location_settings, status, created_at, form_type, invitation_settings')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    // 管理者フィルタ（自分の講義のみ）
    if (teacherEmail) {
      query = query.eq('teacher_email', teacherEmail);
    }

    // カテゴリフィルタ
    if (category) {
      query = query.eq('category', category);
    }

    const { data: courses, error } = await query;

    if (error) {
      console.error('Error fetching courses:', error);
      return NextResponse.json({ message: 'Failed to fetch courses', error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      courses: courses || [],
      total: courses?.length || 0
    }, { status: 200 });
  } catch (error) {
    console.error('Error in courses API:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST: 講義作成（認証必須）
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, teacherName, category, templateId, customFields, enabledDefaultFields, locationSettings, formType, invitationSettings } = body;

    if (!name || !teacherName) {
      return NextResponse.json({ message: 'name and teacherName are required' }, { status: 400 });
    }

    // フォーム作成上限チェック
    const allowed = await canCreateForm(user.email);
    if (!allowed) {
      const planInfo = await getUserPlanInfo(user.email);
      return NextResponse.json({
        message: `フォーム作成上限（${PLAN_LIMITS[planInfo.subscription.plan].maxForms}個）に達しています。Proプランにアップグレードしてください。`,
        error: 'PLAN_LIMIT_EXCEEDED',
        usage: planInfo.usage,
        limits: planInfo.limits,
      }, { status: 403 });
    }

    const supabase = createServerClient();

    // ユニークなコードを生成
    let code: string;
    let attempts = 0;
    do {
      const { data } = await supabase.rpc('generate_course_code');
      code = data as string;
      // 重複チェック
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('code', code)
        .single();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        code,
        name,
        description: description || null,
        teacher_name: teacherName,
        teacher_email: user.email,
        category: category || 'lecture',
        template_id: templateId || null,
        custom_fields: customFields || [],
        enabled_default_fields: enabledDefaultFields || ['date', 'class_name', 'student_id', 'grade', 'name', 'department', 'feedback'],
        location_settings: locationSettings || null,
        form_type: formType || 'attendance',
        invitation_settings: invitationSettings || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating course:', error);
      return NextResponse.json({ message: 'Failed to create course', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Error in create course:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
