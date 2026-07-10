// /api/v2/organization/invitations/accept - 招待の受諾（招待リンクのトークンで参加）
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { countUsedSeats, normalizeEmail } from '@/lib/organization';

// GET: トークンの検証（受諾画面の表示用。組織名と招待先メールを返す）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: '招待トークンがありません' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: invitation } = await supabase
      .from('organization_invitations')
      .select('email, role, expires_at, accepted_at, organizations(name)')
      .eq('token', token)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 });
    }
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'この招待は既に使用されています' }, { status: 410 });
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'この招待は期限切れです。管理者に再発行を依頼してください' }, { status: 410 });
    }

    const orgName = (invitation.organizations as unknown as { name: string } | null)?.name ?? '';
    return NextResponse.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        organizationName: orgName,
        expiresAt: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Invitation verify error:', error);
    return NextResponse.json({ error: '招待の確認に失敗しました' }, { status: 500 });
  }
}

// POST: 招待を受諾して組織に参加
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!token) {
      return NextResponse.json({ error: '招待トークンがありません' }, { status: 400 });
    }

    const email = normalizeEmail(user.email);
    const supabase = createServerClient();

    const { data: invitation } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, email, role, expires_at, accepted_at, organizations(id, name, seat_limit)')
      .eq('token', token)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 });
    }
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'この招待は既に使用されています' }, { status: 410 });
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'この招待は期限切れです。管理者に再発行を依頼してください' }, { status: 410 });
    }
    // 招待先メールとログイン中ユーザーの一致を必須にする（リンクの横流しによる参加を防ぐ）
    if (normalizeEmail(invitation.email) !== email) {
      return NextResponse.json(
        { error: `この招待は ${invitation.email} 宛です。招待されたメールアドレスのアカウントでログインしてください` },
        { status: 403 }
      );
    }

    // 既に組織に所属していないか（1ユーザー=1組織）
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, organization_id')
      .eq('member_email', email)
      .maybeSingle();
    if (existingMember) {
      if (existingMember.organization_id === invitation.organization_id) {
        // 既にこの組織のメンバー。招待だけ消化して成功扱い
        await supabase
          .from('organization_invitations')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invitation.id);
        return NextResponse.json({ success: true, alreadyMember: true });
      }
      return NextResponse.json({ error: '既に別の組織に所属しています' }, { status: 409 });
    }

    // 受諾時点のシート再チェック。
    // 未受諾の招待自体が1シートを消費しているので、自分の招待分を除いて比較する
    const org = invitation.organizations as unknown as { id: string; name: string; seat_limit: number };
    const usedSeats = await countUsedSeats(invitation.organization_id);
    if (usedSeats - 1 >= org.seat_limit) {
      return NextResponse.json(
        { error: 'シート数の上限に達しています。管理者にシートの追加を依頼してください' },
        { status: 400 }
      );
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: invitation.organization_id,
      member_email: email,
      role: invitation.role,
    });
    if (memberError) {
      if (memberError.code === '23505') {
        return NextResponse.json({ error: '既に組織に所属しています' }, { status: 409 });
      }
      console.error('Member insert error:', memberError);
      return NextResponse.json({ error: '組織への参加に失敗しました' }, { status: 500 });
    }

    await supabase
      .from('organization_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      organization: { id: org.id, name: org.name },
    });
  } catch (error) {
    console.error('Invitation accept error:', error);
    return NextResponse.json({ error: '組織への参加に失敗しました' }, { status: 500 });
  }
}
