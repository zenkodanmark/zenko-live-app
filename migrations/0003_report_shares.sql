-- Public customer snapshots for KS, aftaleseddel, TF and ER.
-- Looked up by kind + number. Unguessable tokens are not required;
-- customers receive an explicit link. Rows are unowned (no login).
create table if not exists report_shares (
  kind         text not null,
  number       text not null,
  report_id    text not null,
  payload      jsonb not null,
  answer       text not null default '',
  answered_at  timestamptz,
  answered_by  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (kind, number)
);
create index if not exists report_shares_report_id_idx on report_shares (report_id);
