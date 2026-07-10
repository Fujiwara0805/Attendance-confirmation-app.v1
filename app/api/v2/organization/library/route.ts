// /api/v2/organization/library - 組織内共有ライブラリ（他メンバーのフォーム・ルーム一覧）
// 一覧は「複製して使う」ための最小フィールドのみ返す。
// location_settings / custom_fields / invitation_settings 等の詳細設定と、
// 出席データ・投票・質問（取得データ）は所有者本人しか閲覧できない（既存認可のまま）。
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { getOrganizationForUser, isOrgEntitled, normalizeEmail } from '@/lib/organization';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await getOrganizationForUser(user.email);
    if (!membership) {
      return NextResponse.json({ error: '組織に所属していません' }, { status: 404 });
    }
    if (!isOrgEntitled(membership.organization)) {
      return NextResponse.json(
        { error: '組織プランが有効ではありません。契約後に共有ライブラリを利用できます', code: 'ORG_NOT_ENTITLED' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const selfEmail = normalizeEmail(user.email);

    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('member_email')
      .eq('organization_id', membership.organization.id);
    if (membersError) {
      console.error('Library members fetch error:', membersError);
      return NextResponse.json({ error: '共有ライブラリの取得に失敗しました' }, { status: 500 });
    }

    const otherEmails = (members ?? [])
      .map((m) => m.member_email as string)
      .filter((email) => email !== selfEmail);

    if (otherEmails.length === 0) {
      return NextResponse.json({ courses: [], rooms: [], memberCount: 1 });
    }

    const [coursesRes, roomsRes] = await Promise.all([
      supabase
        .from('courses')
        .select('code, name, description, category, form_type, status, created_at, teacher_name, teacher_email')
        .in('teacher_email', otherEmails)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('rooms')
        .select('id, code, title, created_at, host_id')
        .in('host_id', otherEmails)
        .order('created_at', { ascending: false }),
    ]);

    if (coursesRes.error || roomsRes.error) {
      console.error('Library fetch error:', coursesRes.error || roomsRes.error);
      return NextResponse.json({ error: '共有ライブラリの取得に失敗しました' }, { status: 500 });
    }

    // ルームごとのワーク（投票カード）数
    const roomIds = (roomsRes.data ?? []).map((r) => r.id as string);
    const pollCounts = new Map<string, number>();
    if (roomIds.length > 0) {
      const { data: polls } = await supabase
        .from('polls')
        .select('room_id')
        .in('room_id', roomIds);
      for (const poll of polls ?? []) {
        pollCounts.set(poll.room_id, (pollCounts.get(poll.room_id) ?? 0) + 1);
      }
    }

    return NextResponse.json({
      courses: (coursesRes.data ?? []).map((c) => ({
        code: c.code,
        name: c.name,
        description: c.description,
        category: c.category,
        formType: c.form_type,
        createdAt: c.created_at,
        ownerName: c.teacher_name,
        ownerEmail: c.teacher_email,
      })),
      rooms: (roomsRes.data ?? []).map((r) => ({
        code: r.code,
        title: r.title,
        createdAt: r.created_at,
        ownerEmail: r.host_id,
        pollCount: pollCounts.get(r.id) ?? 0,
      })),
      memberCount: (members ?? []).length,
    });
  } catch (error) {
    console.error('Organization library error:', error);
    return NextResponse.json({ error: '共有ライブラリの取得に失敗しました' }, { status: 500 });
  }
}
