// 規約本文を変更したときは必ずバージョン、文書ID、TermsDocument.tsxのSHA-256を更新する。
// 既存の有料ユーザーには新しいバージョンへの再同意が求められる。
export const TERMS_VERSION = '2026-07-22';
export const TERMS_EFFECTIVE_DATE = '2026年7月22日';
export const TERMS_DOCUMENT_ID = 'zaseki-kun-terms-2026-07-22-v1';
export const TERMS_DOCUMENT_SHA256 =
  '6fe408f2b5cdd9a7549421d36aba5c450b5867b930819ba4b8599741deff9420';
export const TERMS_ACCEPTANCE_REQUIRED_CODE = 'TERMS_ACCEPTANCE_REQUIRED';

export type TermsAcceptanceSource =
  | 'paid_user_gate'
  | 'personal_checkout'
  | 'organization_checkout'
  | 'institutional_billing';
