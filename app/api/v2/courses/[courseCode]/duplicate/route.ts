import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { canCreateForm, getUserPlanInfo, PLAN_LIMITS } from '@/lib/subscription';

// POST: フォーム（講義/招待）を複製する（作成者のみ）
// カスタム項目・位置情報設定・クールダウン・招待設定を引き継ぎ、回答データは引き継がない。
export async function POST(
  _req: NextRequest,
  { params }: { params: { courseCode: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: source } = await supabase
      .from('courses')
      .select(
        'name, description, teacher_name, teacher_email, category, template_id, custom_fields, enabled_default_fields, location_settings, form_type, invitation_settings, cooldown_minutes'
      )
      .eq('code', params.courseCode)
      .single();

    if (!source || source.teacher_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

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

    // ユニークなコードを生成（既存POSTと同じ手順）
    let code: string;
    let attempts = 0;
    do {
      const { data } = await supabase.rpc('generate_course_code');
      code = data as string;
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
        name: `${source.name}のコピー`,
        description: source.description,
        teacher_name: source.teacher_name,
        teacher_email: user.email,
        category: source.category,
        template_id: source.template_id,
        custom_fields: source.custom_fields || [],
        enabled_default_fields: source.enabled_default_fields,
        location_settings: source.location_settings,
        form_type: source.form_type,
        invitation_settings: source.invitation_settings,
        cooldown_minutes: source.cooldown_minutes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating course:', error);
      return NextResponse.json({ message: 'Failed to duplicate course', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error('Error in duplicate course:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
