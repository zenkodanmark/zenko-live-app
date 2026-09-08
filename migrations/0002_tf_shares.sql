-- Public share snapshots for tekniske forespørgsler.
-- Unguessable token is the only access key. Rows are unowned (no login).
create table if not exists tf_shares (
  token        text primary key,
  tf_id        text not null,
  payload      jsonb not null,
  answer       text not null default '',
  answered_at  timestamptz,
  answered_by  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tf_shares_tf_id_idx on tf_shares (tf_id);
