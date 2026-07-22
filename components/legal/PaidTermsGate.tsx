'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { TermsAgreementModal } from '@/components/legal/TermsAgreementModal';

type TermsStatus = {
  required?: boolean;
  verificationError?: boolean;
  error?: string;
};

export function PaidTermsGate() {
  const { status } = useSession();
  const [isRequired, setIsRequired] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const checkTerms = useCallback(async () => {
    if (status !== 'authenticated') {
      setIsRequired(false);
      setVerificationError(null);
      return;
    }

    try {
      const response = await fetch('/api/v2/terms-consent', { cache: 'no-store' });
      const data = (await response.json()) as TermsStatus;
      setIsRequired(data.required === true);
      setVerificationError(data.verificationError ? data.error || '同意状態を確認できませんでした。' : null);
    } catch {
      // プランを確認できない通信エラーだけでは、無料ユーザーまで全画面ブロックしない。
      setVerificationError(null);
    }
  }, [status]);

  useEffect(() => {
    void checkTerms();
  }, [checkTerms]);

  useEffect(() => {
    const handleUpdate = () => void checkTerms();
    window.addEventListener('terms-acceptance-updated', handleUpdate);
    return () => window.removeEventListener('terms-acceptance-updated', handleUpdate);
  }, [checkTerms]);

  return (
    <TermsAgreementModal
      isOpen={isRequired}
      source="paid_user_gate"
      mandatory
      verificationError={verificationError}
      submitLabel="同意してサービスを利用する"
      onAccepted={() => {
        setIsRequired(false);
        setVerificationError(null);
      }}
    />
  );
}

