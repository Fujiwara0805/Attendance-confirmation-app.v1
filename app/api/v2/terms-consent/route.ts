import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserSubscription } from '@/lib/subscription';
import {
  TERMS_DOCUMENT_ID,
  TERMS_DOCUMENT_SHA256,
  TERMS_VERSION,
  type TermsAcceptanceSource,
} from '@/lib/terms';
import {
  getLatestTermsAcceptance,
  recordLatestTermsAcceptance,
} from '@/lib/terms.server';

const ACCEPTANCE_SOURCES = new Set<TermsAcceptanceSource>([
  'paid_user_gate',
  'personal_checkout',
  'organization_checkout',
  'institutional_billing',
]);

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const [subscription, acceptanceResult] = await Promise.allSettled([
      getUserSubscription(session.user.email),
      getLatestTermsAcceptance(session.user.email),
    ]);

    if (subscription.status === 'rejected') throw subscription.reason;
    const resolvedSubscription = subscription.value;
    const isPaidUser =
      resolvedSubscription.plan === 'paid' || resolvedSubscription.plan === 'enterprise';

    if (acceptanceResult.status === 'fulfilled') {
      const acceptance = acceptanceResult.value;
      return NextResponse.json(
        {
          accepted: Boolean(acceptance),
          acceptedAt: acceptance?.acceptedAt ?? null,
          required: isPaidUser && !acceptance,
          termsVersion: TERMS_VERSION,
          documentId: TERMS_DOCUMENT_ID,
          documentSha256: TERMS_DOCUMENT_SHA256,
          plan: resolvedSubscription.plan,
        },
        { headers: noStoreHeaders }
      );
    } else {
      // 有料ユーザーの確認に失敗した場合はフェイルクローズし、利用を継続させない。
      return NextResponse.json(
        {
          error: '利用規約の同意状態を確認できませんでした。時間をおいて再度お試しください。',
          accepted: false,
          required: isPaidUser,
          verificationError: true,
          termsVersion: TERMS_VERSION,
          documentId: TERMS_DOCUMENT_ID,
          documentSha256: TERMS_DOCUMENT_SHA256,
          plan: resolvedSubscription.plan,
        },
        { status: 503, headers: noStoreHeaders }
      );
    }
  } catch (error) {
    console.error('[terms] プラン情報を確認できませんでした:', error);
    return NextResponse.json(
      { error: '利用規約の確認処理に失敗しました' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const body = await request.json();
    const source = body?.source as TermsAcceptanceSource;
    if (
      body?.termsVersion !== TERMS_VERSION ||
      body?.documentId !== TERMS_DOCUMENT_ID ||
      body?.documentSha256 !== TERMS_DOCUMENT_SHA256
    ) {
      return NextResponse.json(
        { error: '利用規約が更新されました。画面を再読み込みして内容をご確認ください' },
        { status: 409, headers: noStoreHeaders }
      );
    }
    if (body?.accepted !== true || !ACCEPTANCE_SOURCES.has(source)) {
      return NextResponse.json(
        { error: '利用規約への同意を確認できません' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
    const acceptance = await recordLatestTermsAcceptance({
      email: session.user.email,
      source,
      ipAddress,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      {
        accepted: true,
        acceptedAt: acceptance.acceptedAt,
        termsVersion: TERMS_VERSION,
        documentId: TERMS_DOCUMENT_ID,
        documentSha256: TERMS_DOCUMENT_SHA256,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('[terms] 同意APIでエラーが発生しました:', error);
    return NextResponse.json(
      { error: '利用規約への同意を保存できませんでした' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
