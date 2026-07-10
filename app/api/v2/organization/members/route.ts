// /api/v2/organization/members - メンバー一覧・ロール変更・削除（脱退）
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { getOrganizationForUser, normalizeEmail } from '@/lib/organization';

// GET: メンバー一覧（組織の全メンバーが閲覧可能）
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

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, member_email, role, joined_at')
      .eq('organization_id', membership.organization.id)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Members fetch error:', error);
      return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      members: (data ?? []).map((m) => ({
        id: m.id,
        email: m.member_email,
        role: m.role,
        joinedAt: m.joined_at,
      })),
      role: membership.role,
    });
  } catch (error) {
    console.error('Members fetch error:', error);
    return NextResponse.json({ error: 'メンバー一覧の取得に失敗しました' }, { status: 500 });
  }
}

// PATCH: ロール変更（owner / admin。owner ロールの付け替えは owner のみ = オーナー譲渡）
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await getOrganizationForUser(user.email);
    if (!membership || membership.role === 'member') {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }

    const body = await req.json();
    const memberId = typeof body?.memberId === 'string' ? body.memberId : '';
    const newRole = body?.role;
    if (!memberId || !['owner', 'admin', 'member'].includes(newRole)) {
      return NextResponse.json({ error: 'リクエストが正しくありません' }, { status: 400 });
    }

    // owner への昇格（= オーナー譲渡）は現オーナーのみ
    if (newRole === 'owner' && membership.role !== 'owner') {
      return NextResponse.json({ error: 'オーナーの譲渡はオーナーのみ実行できます' }, { status: 403 });
    }

    const supabase = createServerClient();
    const orgId = membership.organization.id;

    const { data: target } = await supabase
      .from('organization_members')
      .select('id, member_email, role')
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .single();
    if (!target) {
      return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 });
    }

    // admin は owner のロールを変更できない
    if (target.role === 'owner' && membership.role !== 'owner') {
      return NextResponse.json({ error: 'オーナーのロールは変更できません' }, { status: 403 });
    }

    if (newRole === 'owner') {
      // オーナー譲渡: 対象を owner に、自分を admin に降格（owner は常に1人）
      const selfEmail = normalizeEmail(user.email);
      const { error: promoteError } = await supabase
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('id', target.id);
      if (promoteError) {
        console.error('Owner transfer error:', promoteError);
        return NextResponse.json({ error: 'オーナーの譲渡に失敗しました' }, { status: 500 });
      }
      await supabase
        .from('organization_members')
        .update({ role: 'admin' })
        .eq('organization_id', orgId)
        .eq('member_email', selfEmail);
      await supabase
        .from('organizations')
        .update({ owner_email: target.member_email, updated_at: new Date().toISOString() })
        .eq('id', orgId);
    } else {
      // 最後の owner を降格させない
      if (target.role === 'owner') {
        return NextResponse.json(
          { error: 'オーナーを降格するには、先に他のメンバーへオーナーを譲渡してください' },
          { status: 400 }
        );
      }
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', target.id);
      if (error) {
        console.error('Role update error:', error);
        return NextResponse.json({ error: 'ロールの変更に失敗しました' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'ロールの変更に失敗しました' }, { status: 500 });
  }
}

// DELETE: メンバー削除（owner / admin）または自分の脱退（?id=self）
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await getOrganizationForUser(user.email);
    if (!membership) {
      return NextResponse.json({ error: '組織に所属していません' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('id');
    if (!memberId) {
      return NextResponse.json({ error: 'メンバーIDを指定してください' }, { status: 400 });
    }

    const supabase = createServerClient();
    const orgId = membership.organization.id;
    const selfEmail = normalizeEmail(user.email);

    // 対象の解決（'self' は自分の脱退）
    let target: { id: string; member_email: string; role: string } | null = null;
    if (memberId === 'self') {
      const { data } = await supabase
        .from('organization_members')
        .select('id, member_email, role')
        .eq('organization_id', orgId)
        .eq('member_email', selfEmail)
        .single();
      target = data;
    } else {
      const { data } = await supabase
        .from('organization_members')
        .select('id, member_email, role')
        .eq('id', memberId)
        .eq('organization_id', orgId)
        .single();
      target = data;
    }

    if (!target) {
      return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 });
    }

    const isSelf = target.member_email === selfEmail;

    // owner は削除・脱退不可（先に譲渡か組織解散）
    if (target.role === 'owner') {
      return NextResponse.json(
        {
          error: isSelf
            ? 'オーナーは脱退できません。先にオーナーを譲渡するか、組織を解散してください'
            : 'オーナーは削除できません',
        },
        { status: 400 }
      );
    }

    // 他人の削除は owner / admin のみ
    if (!isSelf && membership.role === 'member') {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }
    // admin は admin を削除できない（owner のみ）
    if (!isSelf && target.role === 'admin' && membership.role !== 'owner') {
      return NextResponse.json({ error: '管理者の削除はオーナーのみ実行できます' }, { status: 403 });
    }

    const { error } = await supabase.from('organization_members').delete().eq('id', target.id);
    if (error) {
      console.error('Member delete error:', error);
      return NextResponse.json({ error: 'メンバーの削除に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true, left: isSelf });
  } catch (error) {
    console.error('Member delete error:', error);
    return NextResponse.json({ error: 'メンバーの削除に失敗しました' }, { status: 500 });
  }
}
