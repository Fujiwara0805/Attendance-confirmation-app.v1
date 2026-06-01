-- 自由回答ボードのスクリーン配置・分類用カラム
-- Supabase SQL Editor で手動実行してください。

alter table public.poll_votes
  add column if not exists display_x numeric(5,2),
  add column if not exists display_y numeric(5,2),
  add column if not exists group_label text,
  add column if not exists display_order integer,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists response_color text not null default 'orange',
  add column if not exists response_author_name text,
  add column if not exists response_is_anonymous boolean not null default true;

-- ブレスト形式は1人が何度でも投稿できるため、(poll_id, participant_id) のユニーク制約を解除する。
-- （これが残っていると 23505 duplicate key エラーで2回目以降の投稿が失敗する）
alter table public.poll_votes drop constraint if exists uniq_poll_vote_freetext;
drop index if exists uniq_poll_vote_freetext;

create index if not exists poll_votes_free_text_layout_idx
  on public.poll_votes (poll_id, group_label, display_order, created_at)
  where cleared_at is null;

comment on column public.poll_votes.display_x is '自由回答ボード上のX座標（0-100%）';
comment on column public.poll_votes.display_y is '自由回答ボード上のY座標（0-100%）';
comment on column public.poll_votes.group_label is '先生がスクリーン上で分類したグループ名';
comment on column public.poll_votes.is_pinned is '自由回答ボード上で優先表示するフラグ';
comment on column public.poll_votes.response_color is '自由回答の付箋カード色（yellow/green/blue/orange）';
comment on column public.poll_votes.response_author_name is '自由回答の表示投稿者名';
comment on column public.poll_votes.response_is_anonymous is '自由回答が匿名投稿かどうか';

update public.poll_votes
set response_color = 'orange'
where response_color = 'gray';

update public.poll_votes
set response_color = 'blue'
where response_color = 'purple';

update public.poll_votes
set response_color = 'orange'
where response_color = 'pink';

-- 以前のデフォルト分類を使っていた回答は、今回の仕様では未分類に戻す。
update public.poll_votes
set group_label = null,
    display_x = null,
    display_y = null
where group_label in ('気持ち・心', '生きもの・自然', 'こと・行動', '想像・未来', 'その他');

-- 既存の自由回答カード設定から、以前のデフォルト分類を削除する。
with cleaned_free_text_polls as (
  select
    id,
    jsonb_set(
      options::jsonb,
      '{0,freeTextGroups}',
      coalesce(
        (
          select jsonb_agg(group_label)
          from jsonb_array_elements_text(options::jsonb -> 0 -> 'freeTextGroups') as group_label
          where group_label not in ('気持ち・心', '生きもの・自然', 'こと・行動', '想像・未来', 'その他')
        ),
        '[]'::jsonb
      ),
      true
    ) as next_options
  from public.polls
  where jsonb_typeof(options::jsonb) = 'array'
    and options::jsonb -> 0 ->> '__pollMeta' = 'true'
    and options::jsonb -> 0 ->> 'mode' = 'free_text'
    and options::jsonb -> 0 ? 'freeTextGroups'
)
update public.polls
set options = cleaned_free_text_polls.next_options
from cleaned_free_text_polls
where public.polls.id = cleaned_free_text_polls.id;
