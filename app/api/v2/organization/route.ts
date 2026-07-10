// /api/v2/organization - 組織（エンタープライズ）情報の取得・作成・更新・解散
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import {
  BLOCKED_AUTO_JOIN_DOMAINS,
  countUsedSeats,
  getOrganizationForUser,
  isOrgEntitled,
  normalizeEmail,
  requireOrgRole,
  type Organization,
  type OrgRole,
} from '@/lib/organization';

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

async function buildOrganizationResponse(org: Organization, role: OrgRole) {
  const supabase = createServerClient();
  const [usedSeats, domainsRes] = await Promise.all([
    countUsedSeats(org.id),
    supabase.from('organization_domains').select('domain').eq('organization_id', org.id),
  ]);

  return {
    organization: {
      id: org.id,
      name: org.name,
      ownerEmail: org.owner_email,
      seatLimit: org.seat_limit,
      subscriptionStatus: org.subscription_status,
      billingType: org.billing_type,
      currentPeriodEnd: org.current_period_end,
      entitled: isOrgEntitled(org),
      createdAt: org.created_at,
    },
    role,
    usedSeats,
    domains: (domainsRes.data ?? []).map((d) => d.domain as string),
  };
}

// GET: 自分の所属組織を取得（未所属なら organization: null）
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await getOrganizationForUser(user.email);
    if (!membership) {
      return NextResponse.json({ organization: null });
    }

    return NextResponse.json(
      await buildOrganizationResponse(membership.organization, membership.role)
    );
  } catch (error) {
    console.error('Organization fetch error:', error);
    return NextResponse.json({ error: '組織情報の取得に失敗しました' }, { status: 500 });
  }
}

// POST: 組織を作成（セルフサーブ。作成者が owner になる）
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) {
      return NextResponse.json({ error: '組織名は1〜100文字で入力してください' }, { status: 400 });
    }

    const existing = await getOrganizationForUser(user.email);
    if (existing) {
      return NextResponse.json({ error: '既に組織に所属しています' }, { status: 409 });
    }

    const email = normalizeEmail(user.email);
    const supabase = createServerClient();

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, owner_email: email })
      .select('*')
      .single();

    if (orgError || !org) {
      console.error('Organization insert error:', orgError);
      return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 });
    }

    const { error: memberError } = await supabase.from('organization_members').insert({
      organization_id: org.id,
      member_email: email,
      role: 'owner',
    });

    if (memberError) {
      // メンバー登録に失敗したら組織ごと巻き戻す（宙に浮いた組織を残さない）
      await supabase.from('organizations').delete().eq('id', org.id);
      if (memberError.code === '23505') {
        return NextResponse.json({ error: '既に組織に所属しています' }, { status: 409 });
      }
      console.error('Organization owner insert error:', memberError);
      return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 });
    }

    return NextResponse.json(
      await buildOrganizationResponse(org as Organization, 'owner'),
      { status: 201 }
    );
  } catch (error) {
    console.error('Organization create error:', error);
    return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 });
  }
}

// PATCH: 組織名・許可ドメインの更新（owner / admin）
export async function PATCH(req: NextRequest) {
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
    const supabase = createServerClient();
    const orgId = membership.organization.id;

    if (body?.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 100) {
        return NextResponse.json({ error: '組織名は1〜100文字で入力してください' }, { status: 400 });
      }
      const { error } = await supabase
        .from('organizations')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', orgId);
      if (error) {
        console.error('Organization name update error:', error);
        return NextResponse.json({ error: '組織名の更新に失敗しました' }, { status: 500 });
      }
    }

    if (body?.domains !== undefined) {
      if (!Array.isArray(body.domains) || body.domains.length > 10) {
        return NextResponse.json({ error: 'ドメインは10件まで指定できます' }, { status: 400 });
      }
      const domains: string[] = Array.from(
        new Set(
          body.domains.map((d: unknown) => (typeof d === 'string' ? d.toLowerCase().trim() : ''))
        )
      ).filter(Boolean) as string[];

      for (const domain of domains) {
        if (!DOMAIN_PATTERN.test(domain)) {
          return NextResponse.json(
            { error: `ドメインの形式が正しくありません: ${domain}` },
            { status: 400 }
          );
        }
        if (BLOCKED_AUTO_JOIN_DOMAINS.has(domain)) {
          return NextResponse.json(
            { error: `フリーメールのドメインは登録できません: ${domain}` },
            { status: 400 }
          );
        }
      }

      // 全置き換え（削除 → 挿入）。他組織が使用中のドメインは unique 制約で弾かれる
      const { error: deleteError } = await supabase
        .from('organization_domains')
        .delete()
        .eq('organization_id', orgId);
      if (deleteError) {
        console.error('Organization domains delete error:', deleteError);
        return NextResponse.json({ error: 'ドメインの更新に失敗しました' }, { status: 500 });
      }

      if (domains.length > 0) {
        const { error: insertError } = await supabase
          .from('organization_domains')
          .insert(domains.map((domain) => ({ domain, organization_id: orgId })));
        if (insertError) {
          if (insertError.code === '23505') {
            return NextResponse.json(
              { error: '指定されたドメインは他の組織で既に使用されています' },
              { status: 409 }
            );
          }
          console.error('Organization domains insert error:', insertError);
          return NextResponse.json({ error: 'ドメインの更新に失敗しました' }, { status: 500 });
        }
      }
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    return NextResponse.json(
      await buildOrganizationResponse(org as Organization, membership.role)
    );
  } catch (error) {
    console.error('Organization update error:', error);
    return NextResponse.json({ error: '組織の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE: 組織を解散（owner のみ。有効な Stripe サブスクがある場合は先に解約が必要）
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const membership = await requireOrgRole(user.email, ['owner']);
    if (!membership) {
      return NextResponse.json({ error: '組織の解散はオーナーのみ実行できます' }, { status: 403 });
    }

    const org = membership.organization;
    if (
      org.billing_type === 'stripe_subscription' &&
      org.stripe_subscription_id &&
      (org.subscription_status === 'active' || org.subscription_status === 'past_due')
    ) {
      return NextResponse.json(
        { error: '有効なサブスクリプションがあります。先に解約してください' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) {
      console.error('Organization delete error:', error);
      return NextResponse.json({ error: '組織の解散に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Organization delete error:', error);
    return NextResponse.json({ error: '組織の解散に失敗しました' }, { status: 500 });
  }
}
