// /api/v2/organization/invitations - 組織への招待の一覧・発行・取り消し（owner / admin）
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  ORG_INVITATION_EXPIRY_DAYS,
  countUsedSeats,
  normalizeEmail,
  requireOrgRole,
} from '@/lib/organization';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildInviteUrl(req: NextRequest, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  return `${baseUrl}/admin/organization/join?token=${token}`;
}

// GET: 未受諾の招待一覧
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await requireOrgRole(user.email, ['owner', 'admin']);
    if (!membership) {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('id, email, role, token, invited_by, expires_at, created_at')
      .eq('organization_id', membership.organization.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Invitations fetch error:', error);
      return NextResponse.json({ error: '招待一覧の取得に失敗しました' }, { status: 500 });
    }

    const now = Date.now();
    return NextResponse.json({
      invitations: (data ?? []).map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invited_by,
        expiresAt: inv.expires_at,
        expired: new Date(inv.expires_at).getTime() <= now,
        inviteUrl: buildInviteUrl(req, inv.token),
        createdAt: inv.created_at,
      })),
    });
  } catch (error) {
    console.error('Invitations fetch error:', error);
    return NextResponse.json({ error: '招待一覧の取得に失敗しました' }, { status: 500 });
  }
}

// POST: 招待を発行（招待リンクを返す。メール送信はせず、リンクを共有してもらう方式）
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await requireOrgRole(user.email, ['owner', 'admin']);
    if (!membership) {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }

    const body = await req.json();
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const role = body?.role === 'admin' ? 'admin' : 'member';

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
    }

    const org = membership.organization;
    const supabase = createServerClient();

    // 既にメンバー（この組織・他組織問わず）なら招待できない
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, organization_id')
      .eq('member_email', email)
      .maybeSingle();
    if (existingMember) {
      return NextResponse.json(
        {
          error:
            existingMember.organization_id === org.id
              ? 'このユーザーは既にメンバーです'
              : 'このユーザーは別の組織に所属しています',
        },
        { status: 409 }
      );
    }

    // アカウント上限チェック（使用アカウント = メンバー + 未受諾招待）
    const usedSeats = await countUsedSeats(org.id);
    if (usedSeats >= org.seat_limit) {
      return NextResponse.json(
        { error: 'アカウント数の上限に達しています。アカウントを追加購入するか、招待を取り消してください' },
        { status: 400 }
      );
    }

    // 同一メール宛の失効済み・未受諾の古い招待は消してから発行（部分 unique 制約対策）
    await supabase
      .from('organization_invitations')
      .delete()
      .eq('organization_id', org.id)
      .eq('email', email)
      .is('accepted_at', null);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + ORG_INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: invitation, error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: org.id,
        email,
        role,
        token,
        invited_by: normalizeEmail(user.email),
        expires_at: expiresAt,
      })
      .select('id, email, role, expires_at, created_at')
      .single();

    if (error || !invitation) {
      console.error('Invitation insert error:', error);
      return NextResponse.json({ error: '招待の発行に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          inviteUrl: buildInviteUrl(req, token),
        },
        message: '招待リンクを発行しました。リンクを招待相手に共有してください。',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Invitation create error:', error);
    return NextResponse.json({ error: '招待の発行に失敗しました' }, { status: 500 });
  }
}

// DELETE: 招待を取り消し（アカウントを解放）
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await requireOrgRole(user.email, ['owner', 'admin']);
    if (!membership) {
      return NextResponse.json({ error: 'この操作を行う権限がありません' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get('id');
    if (!invitationId) {
      return NextResponse.json({ error: '招待IDを指定してください' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', membership.organization.id)
      .is('accepted_at', null);

    if (error) {
      console.error('Invitation delete error:', error);
      return NextResponse.json({ error: '招待の取り消しに失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invitation delete error:', error);
    return NextResponse.json({ error: '招待の取り消しに失敗しました' }, { status: 500 });
  }
}
