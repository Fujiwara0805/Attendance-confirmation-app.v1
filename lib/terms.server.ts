import { createServerClient } from '@/lib/supabase';
import {
  TERMS_DOCUMENT_ID,
  TERMS_DOCUMENT_SHA256,
  TERMS_VERSION,
  type TermsAcceptanceSource,
} from '@/lib/terms';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

type SubscriptionTermsRow = {
  terms_accepted_at?: unknown;
  terms_accepted_version?: unknown;
  terms_acceptance_metadata?: unknown;
};

function parseLatestTermsAcceptance(data: SubscriptionTermsRow | null | undefined) {
  const metadata = data?.terms_acceptance_metadata as Record<string, unknown> | null;
  if (
    !data?.terms_accepted_at ||
    data.terms_accepted_version !== TERMS_VERSION ||
    metadata?.documentId !== TERMS_DOCUMENT_ID ||
    metadata?.documentSha256 !== TERMS_DOCUMENT_SHA256
  ) {
    return null;
  }

  return {
    acceptedAt: data.terms_accepted_at as string,
    termsVersion: data.terms_accepted_version as string,
    documentId: metadata.documentId as string,
    documentSha256: metadata.documentSha256 as string,
  };
}

export async function getLatestTermsAcceptance(email: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('terms_accepted_at, terms_accepted_version, terms_acceptance_metadata')
    .eq('user_email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    console.error('[terms] 利用規約の同意状態を取得できませんでした:', error);
    throw error;
  }

  return parseLatestTermsAcceptance(data);
}

export async function hasAcceptedLatestTerms(email: string) {
  return Boolean(await getLatestTermsAcceptance(email));
}

export async function recordLatestTermsAcceptance(input: {
  email: string;
  source: TermsAcceptanceSource;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = createServerClient();
  const normalizedEmail = normalizeEmail(input.email);
  const acceptedAt = new Date().toISOString();

  const { data: currentSubscription, error: selectError } = await supabase
    .from('subscriptions')
    .select('id, terms_accepted_at, terms_accepted_version, terms_acceptance_metadata')
    .eq('user_email', normalizedEmail)
    .maybeSingle();

  if (selectError) {
    console.error('[terms] サブスクリプション行を確認できませんでした:', selectError);
    throw selectError;
  }

  const existing = parseLatestTermsAcceptance(currentSubscription);
  if (existing) return existing;

  const acceptanceFields = {
    terms_accepted_version: TERMS_VERSION,
    terms_accepted_at: acceptedAt,
    terms_acceptance_metadata: {
      documentId: TERMS_DOCUMENT_ID,
      documentSha256: TERMS_DOCUMENT_SHA256,
      source: input.source,
      ipAddress: input.ipAddress?.slice(0, 128) || null,
      userAgent: input.userAgent?.slice(0, 1024) || null,
    },
    updated_at: acceptedAt,
  };

  if (currentSubscription) {
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(acceptanceFields)
      .eq('user_email', normalizedEmail);

    if (updateError) {
      console.error('[terms] 利用規約の同意を更新できませんでした:', updateError);
      throw updateError;
    }
  } else {
    const { error: insertError } = await supabase.from('subscriptions').insert({
      user_email: normalizedEmail,
      plan: 'free',
      status: 'active',
      ...acceptanceFields,
    });

    if (insertError?.code === '23505') {
      // 複数タブで同時に初回同意された場合は、先に作成された行を更新する。
      const { error: retryError } = await supabase
        .from('subscriptions')
        .update(acceptanceFields)
        .eq('user_email', normalizedEmail);
      if (retryError) throw retryError;
    } else if (insertError) {
      console.error('[terms] 同意用のサブスクリプション行を作成できませんでした:', insertError);
      throw insertError;
    }
  }

  return {
    acceptedAt,
    termsVersion: TERMS_VERSION,
    documentId: TERMS_DOCUMENT_ID,
    documentSha256: TERMS_DOCUMENT_SHA256,
  };
}
