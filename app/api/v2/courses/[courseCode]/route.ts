// /api/v2/courses/[courseCode] - 個別講義の取得・更新・削除
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// GET: 講義詳細（公開 - QRコード経由のアクセス）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseCode: string }> }
) {
  try {
    const { courseCode } = await params;
    const supabase = createServerClient();

    const { data: course, error } = await supabase
      .from('courses')
      .select(`
        id, code, name, description, teacher_name, category,
        template_id, custom_fields, enabled_default_fields,
        location_settings, status, created_at,
        form_type, invitation_settings
      `)
      .eq('code', courseCode)
      .eq('status', 'active')
      .single();

    if (error || !course) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    // テンプレート情報も取得
    let template = null;
    if (course.template_id) {
      const { data } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', course.template_id)
        .single();
      template = data;
    }

    return NextResponse.json({ course, template }, { status: 200 });
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: 講義更新（認証必須・オーナーのみ）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseCode: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { courseCode } = await params;
    const body = await req.json();
    const supabase = createServerClient();

    // オーナーチェック
    const { data: existing } = await supabase
      .from('courses')
      .select('id, teacher_email')
      .eq('code', courseCode)
      .single();

    if (!existing) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    if (existing.teacher_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden: not the owner' }, { status: 403 });
    }

    // 更新可能なフィールドのみ抽出
    const updateData: Record<string, any> = {};
    const allowedFields = ['name', 'description', 'teacher_name', 'category', 'template_id',
      'custom_fields', 'enabled_default_fields', 'location_settings', 'status',
      'form_type', 'invitation_settings'];

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }
    updateData.updated_at = new Date().toISOString();

    const { data: course, error } = await supabase
      .from('courses')
      .update(updateData)
      .eq('code', courseCode)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ message: 'Failed to update', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ course }, { status: 200 });
  } catch (error) {
    console.error('Error updating course:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 講義削除（認証必須・オーナーのみ・物理削除）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseCode: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { courseCode } = await params;
    const supabase = createServerClient();

    // オーナーチェック
    const { data: existing } = await supabase
      .from('courses')
      .select('id, teacher_email')
      .eq('code', courseCode)
      .single();

    if (!existing) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    if (existing.teacher_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 関連データを先に削除
    await supabase.from('submission_cooldowns').delete().eq('course_id', existing.id);
    await supabase.from('attendance').delete().eq('course_id', existing.id);
    await supabase.from('invitation_responses').delete().eq('course_id', existing.id);

    // 講義を物理削除
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('code', courseCode);

    if (error) {
      return NextResponse.json({ message: 'Failed to delete', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Course deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting course:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
