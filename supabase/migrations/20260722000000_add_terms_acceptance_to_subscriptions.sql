alter table public.subscriptions
  add column if not exists terms_accepted_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_acceptance_metadata jsonb;

comment on column public.subscriptions.terms_accepted_version is
  '同意済みの利用規約バージョン。現在の規約バージョンと一致する場合のみ同意済みとして扱う。';
comment on column public.subscriptions.terms_accepted_at is
  '現在記録されている利用規約への初回同意日時。';
comment on column public.subscriptions.terms_acceptance_metadata is
  '規約文書ID、SHA-256、同意取得経路、IPアドレス、User-Agentを保持する監査用メタデータ。';

-- user_email の既存UNIQUEインデックスで1ユーザーを直接特定できるため、
-- 規約カラム専用のインデックスや追加テーブルは作成しない。

