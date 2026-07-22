'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomModal } from '@/components/ui/custom-modal';
import { TermsDocument } from '@/components/legal/TermsDocument';
import {
  TERMS_EFFECTIVE_DATE,
  TERMS_DOCUMENT_ID,
  TERMS_DOCUMENT_SHA256,
  TERMS_VERSION,
  type TermsAcceptanceSource,
} from '@/lib/terms';

interface TermsAgreementModalProps {
  isOpen: boolean;
  source: TermsAcceptanceSource;
  onAccepted: () => void | Promise<void>;
  onClose?: () => void;
  mandatory?: boolean;
  billingSummary?: ReactNode;
  submitLabel?: string;
  verificationError?: string | null;
}

export function TermsAgreementModal({
  isOpen,
  source,
  onAccepted,
  onClose,
  mandatory = false,
  billingSummary,
  submitLabel = '同意して続ける',
  verificationError,
}: TermsAgreementModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setChecked(false);
    setError('');
  }, [isOpen, source]);

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/v2/terms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted: true,
          source,
          termsVersion: TERMS_VERSION,
          documentId: TERMS_DOCUMENT_ID,
          documentSha256: TERMS_DOCUMENT_SHA256,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.accepted) {
        throw new Error(data.error || '利用規約への同意を保存できませんでした');
      }
      window.dispatchEvent(new CustomEvent('terms-acceptance-updated'));
      await onAccepted();
      if (!mandatory) onClose?.();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : '利用規約への同意を保存できませんでした'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose ?? (() => undefined)}
      title={mandatory ? '利用規約への同意が必要です' : 'お申込み前の利用規約確認'}
      description={
        mandatory
          ? '有料プランのご利用を続けるには、現在の利用規約をご確認のうえ同意してください。'
          : '有料プランへ進む前に、契約条件と利用規約をご確認ください。'
      }
      dismissible={!mandatory && !submitting}
      showCloseButton={!mandatory}
      className="max-w-4xl"
      dialogContentClassName="p-3 sm:p-4"
    >
      <div className="space-y-4">
        {verificationError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{verificationError}</span>
          </div>
        )}

        {billingSummary && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-slate-700">
            <div className="mb-2 flex items-center gap-2 font-bold text-indigo-900">
              <ShieldCheck className="h-4 w-4" />
              お申込み内容の確認
            </div>
            {billingSummary}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-slate-500">
            <span>利用規約（バージョン {TERMS_VERSION}）</span>
            <span>制定・最終改定日: {TERMS_EFFECTIVE_DATE}</span>
          </div>
          <div className="max-h-[42vh] overflow-y-auto overscroll-contain rounded-lg bg-white p-4 ring-1 ring-black/5 sm:p-5">
            <TermsDocument />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            className="mt-0.5"
            aria-label="利用規約に同意する"
          />
          <span className="text-sm leading-6 text-slate-700">
            上記の利用規約を最後まで確認し、その内容に同意します。
            <span className="mt-1 block text-xs text-slate-500">
              個人情報の取扱いは
              <Link
                href="/legal/privacy"
                target="_blank"
                className="mx-1 font-semibold text-indigo-600 hover:underline"
              >
                プライバシーポリシー
              </Link>
              もご確認ください。
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!mandatory && (
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              キャンセル
            </Button>
          )}
          <Button type="button" onClick={handleAccept} disabled={!checked || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                同意を記録中...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </CustomModal>
  );
}
